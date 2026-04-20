use tauri::{Manager, Window};
use tauri::api::process::Command;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use futures_util::StreamExt;
use crate::models::{AnalysisResult, VideoClip};
use crate::video::{probe_dimensions, calculate_deterministic_crop};

fn shift_srt_timestamps(content: &str, offset_seconds: f64) -> String {
    let re = regex::Regex::new(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})").unwrap();
    re.replace_all(content, |caps: &regex::Captures| {
        let h: f64 = caps[1].parse().unwrap_or(0.0);
        let m: f64 = caps[2].parse().unwrap_or(0.0);
        let s: f64 = caps[3].parse().unwrap_or(0.0);
        let ms: f64 = caps[4].parse().unwrap_or(0.0);
        let total_seconds = h * 3600.0 + m * 60.0 + s + ms / 1000.0;
        
        let new_total = (total_seconds - offset_seconds).max(0.0);
        let rh = (new_total / 3600.0).floor();
        let rm = ((new_total % 3600.0) / 60.0).floor();
        let rs = (new_total % 60.0).floor();
        let rms = ((new_total - new_total.floor()) * 1000.0).round();
        
        format!("{:02}:{:02}:{:02},{:03}", rh as u32, rm as u32, rs as u32, rms as u32)
    }).to_string()
}

#[derive(Clone, serde::Serialize)]
struct DownloadProgress {
    filename: String,
    downloaded: u64,
    total: u64,
    percentage: f64,
}

#[tauri::command]
pub async fn download_model(window: Window, url: String, filename: String) -> Result<String, String> {
    let app_dir = window.app_handle().path_resolver().app_data_dir().unwrap_or_else(|| PathBuf::from("./"));
    std::fs::create_dir_all(&app_dir).unwrap_or_default();
    
    // Help identify script path reliably
    
    
    let file_path = app_dir.join(&filename);
    
    if file_path.exists() {
        if let Ok(metadata) = std::fs::metadata(&file_path) {
            if metadata.len() > 1024 * 1024 {
                return Ok(format!("Model {} already exists at {:?}", filename, file_path));
            }
        }
    }

    let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    let total_size = response.content_length().unwrap_or(0);

    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        let percentage = if total_size > 0 {
            (downloaded as f64 / total_size as f64) * 100.0
        } else {
            0.0
        };

        let _ = window.emit("download_progress", DownloadProgress {
            filename: filename.clone(),
            downloaded,
            total: total_size,
            percentage,
        });
    }

    Ok(format!("Successfully downloaded {} to {:?}", filename, file_path))
}

#[tauri::command]
pub async fn run_whisper_analysis(window: Window, video_path: String, model_size: String) -> Result<AnalysisResult, String> {
    let app_dir = window.app_handle().path_resolver().app_data_dir().unwrap_or_else(|| PathBuf::from("./"));
    std::fs::create_dir_all(&app_dir).unwrap_or_default();
    
    let output_dir_str = app_dir.to_str().unwrap();
    let json_path = app_dir.join("analysis_output.json");
    let transcript_json = app_dir.join("transcript_output.json");
    let transcript_srt = app_dir.join("transcript_output.srt");

    // Pre-run Cleanup: Remove stale files to ensure we only read fresh data
    let _ = std::fs::remove_file(&json_path);
    let _ = std::fs::remove_file(&transcript_json);
    let _ = std::fs::remove_file(&transcript_srt);

    window.emit("process_log", format!("Starting Transcription (Whisper {})...", model_size)).unwrap();

    let (mut rx_whisper, _child_whisper) = Command::new_sidecar("whisper")
        .map_err(|e| format!("Whisper sidecar binary missing: {}", e))?
        .args(["--video", &video_path, "--output-dir", output_dir_str])
        .spawn()
        .map_err(|e| format!("Failed to spawn Whisper sidecar: {}", e))?;

    while let Some(event) = rx_whisper.recv().await {
        match event {
            tauri::api::process::CommandEvent::Stdout(line) => {
                if line.starts_with("PROGRESS:") {
                    if let Ok(p) = line.replace("PROGRESS:", "").trim().parse::<u32>() {
                        let _ = window.emit("process_progress", p);
                    }
                } else {
                    window.emit("process_log", &line).unwrap();
                }
            }
            tauri::api::process::CommandEvent::Stderr(line) => {
                window.emit("process_log", format!("AI_DEBUG (Whisper): {}", line)).unwrap();
            }
            tauri::api::process::CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) {
                    return Err(format!("Whisper AI failed with exit code: {:?}", payload.code));
                }
            }
            _ => {}
        }
    }

    window.emit("process_log", "Initializing Smart Analysis Engine...").unwrap();
    
    let transcript_json_str = app_dir.join("transcript_output.json").to_string_lossy().to_string();
    let output_dir_str_llama = app_dir.to_string_lossy().to_string();

    window.emit("process_log", "Initializing Smart Analysis Engine...").unwrap();

    // Positional Arguments as expected by the new llama sidecar: [Transcript Path] [Output Dir]
    let (mut rx_llama, _child_llama) = Command::new_sidecar("llama")
        .map_err(|e| format!("Llama sidecar binary missing: {}", e))?
        .args([&transcript_json_str, &output_dir_str_llama])
        .spawn()
        .map_err(|e| format!("Failed to spawn Smart Analysis sidecar: {}", e))?;

    while let Some(event) = rx_llama.recv().await {
        use tauri::api::process::CommandEvent;
        match event {
            CommandEvent::Stdout(line) => {
                if line.starts_with("PROGRESS:") {
                    if let Ok(p) = line.replace("PROGRESS:", "").trim().parse::<u32>() {
                        let _ = window.emit("process_progress", p);
                    }
                } else {
                    window.emit("process_log", &line).unwrap();
                }
            }
            CommandEvent::Stderr(line) => {
                window.emit("process_log", format!("AI_DEBUG (Llama): {}", line)).unwrap();
            }
            CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) {
                    return Err(format!("Llama Analysis failed with exit code: {:?}", payload.code));
                }
            }
            _ => {}
        }
    }

    if !json_path.exists() {
        return Err("AI analysis failed to generate result file. The engine may have crashed silently.".into());
    }

    let json_content = std::fs::read_to_string(&json_path).map_err(|e| format!("Failed to read analysis result: {}", e))?;
    
    // DEBUG: Log first 200 chars to help trace "missing field" errors
    println!("DEBUG: AI JSON Output (Start): {}", &json_content.chars().take(200).collect::<String>());
    
    // Agnostic Parsing: Handle multiple possible formats from different sidecar versions
    let result: AnalysisResult = if let Ok(res) = serde_json::from_str::<AnalysisResult>(&json_content) {
        res
    } else if let Ok(clip) = serde_json::from_str::<VideoClip>(&json_content) {
        println!("INFO: Detected Legacy Single-Clip format. Adapting...");
        AnalysisResult {
            clips: vec![clip],
            total_clips: 1,
        }
    } else if let Ok(clips) = serde_json::from_str::<Vec<VideoClip>>(&json_content) {
        println!("INFO: Detected Raw Array format. Adapting...");
        let count = clips.len();
        AnalysisResult {
            clips,
            total_clips: count,
        }
    } else {
        return Err(format!("DATA ERROR: AI output format was unrecognized. Content Preview: {}", &json_content.chars().take(100).collect::<String>()));
    };
    
    window.emit("process_log", format!("AI Pipeline Complete! Found {} clips.", result.clips.len())).unwrap();
    Ok(result)
}

#[tauri::command]
pub async fn render_final_video(
    window: Window, 
    video_path: String, 
    export_path: String, 
    style: String,
    start_time: f64,
    end_time: f64,
    clip_hook: String
) -> Result<String, String> {
    println!("Rendering Clip: {} ({}s - {}s) with Style: {}", clip_hook, start_time, end_time, style);
    
    let app_handle = window.app_handle();
    let app_dir = app_handle.path_resolver().app_data_dir().unwrap_or_else(|| PathBuf::from("./"));
    std::fs::create_dir_all(&app_dir).unwrap_or_default();
    
    let srt_path = app_dir.join("transcript_output.srt");
    let face_json_path = app_dir.join("face_tracking_output.json");
    let output_dir_str = app_dir.to_str().unwrap();

    if !srt_path.exists() {
        return Err("Missing transcript_output.srt. Please run analysis first.".into());
    }

    // --- STEP 1: AI FACE TRACKING ---
    window.emit("process_log", "AI Face Tracking: Optimizing subject focus...").unwrap();
    
    // Clear old state to prevent bleeding crop positions from previous videos
    let _ = std::fs::remove_file(&face_json_path);
    
    window.emit("process_log", "AI_DEBUG: Running FaceTracker sidecar...").unwrap();

    // FaceTracker is optional — gracefully skip if sidecar is missing
    if let Ok(cmd) = Command::new_sidecar("facetracker") {
        if let Ok((mut rx_face, _child_face)) = cmd
            .args(["--video", &video_path, "--output-dir", output_dir_str])
            .spawn()
        {
            while let Some(event) = rx_face.recv().await {
                match event {
                    tauri::api::process::CommandEvent::Stdout(line) => {
                        if line.starts_with("PROGRESS:") {
                            if let Ok(p) = line.replace("PROGRESS:", "").trim().parse::<u32>() {
                                let _ = window.emit("process_progress", p);
                            }
                        } else {
                            window.emit("process_log", &line).unwrap();
                        }
                    }
                    tauri::api::process::CommandEvent::Stderr(line) => {
                        window.emit("process_log", format!("AI_DEBUG (Face): {}", line)).unwrap();
                    }
                    tauri::api::process::CommandEvent::Terminated(payload) => {
                        if payload.code != Some(0) {
                            window.emit("process_log", format!("AI_WARNING: Face Tracker exited with code {:?}. Using default centering.", payload.code)).unwrap();
                        }
                    }
                    _ => {}
                }
            }
        }
    } else {
        window.emit("process_log", "AI_INFO: FaceTracker sidecar not found, using centered framing.").unwrap();
    }

    let mut center_x_ratio = 0.5;

    if face_json_path.exists() {
        if let Ok(content) = std::fs::read_to_string(&face_json_path) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                center_x_ratio = v["center_x_ratio"].as_f64().unwrap_or(0.5);
            }
        }
    }

    // --- STEP 2: PROFESSIONAL DETERMINISTIC RENDER ---
    window.emit("process_log", "Stage 2: Deterministic Scene Composition...").unwrap();
    window.emit("process_log", &format!("Target Clip: {:.2}s - {:.2}s", start_time, end_time)).unwrap();
    
    // Extract real metadata
    let dims = probe_dimensions(&video_path).await
        .ok_or_else(|| "Failed to calibrate video dimensions. Please ensure the video file is valid.".to_string())?;

    // Calculate exact crop box on Rust side
    let cb = calculate_deterministic_crop(&dims, center_x_ratio);

    // FIX SUBTITLE DESYNC: Fast-seeking with FFmpeg (-ss before -i) resets video timestamps to 0.
    // If we burn subtitle.srt directly, subtitles won't appear for the first N seconds.
    // We perfectly solve this by dynamically shifting the SRT timestamps backwards in Rust!
    let srt_content = std::fs::read_to_string(&srt_path).unwrap_or_default();
    let shifted_srt_content = shift_srt_timestamps(&srt_content, start_time);
    let clipped_srt_path = app_dir.join("transcript_clipped.srt");
    let _ = std::fs::write(&clipped_srt_path, shifted_srt_content);

    // Create rock-solid filter script with NO SPACES between filters
    let filter_path = app_dir.join("render_filter.txt");
    let srt_path_script = clipped_srt_path.to_str().unwrap()
        .replace("\\", "/")
        .replace(":", "\\:")
        .replace("'", "'\\''"); // Escape single quotes for FFmpeg subtitles
    
    let filter_content = format!(
        "crop={}:{}:{}:{},scale=720:1280,subtitles=filename='{}':force_style='FontName=Arial,FontSize=14,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=60'",
        cb.w, cb.h, cb.x, cb.y, srt_path_script
    );
    std::fs::write(&filter_path, &filter_content)
        .map_err(|e| format!("Failed to secure render context: {}", e))?;
    
    println!("DETERMINISTIC FILTER: {}", filter_content);

    window.emit("process_log", "Stage 3: High-Fidelity AI Video Generation...").unwrap();

    let (mut rx_ffmpeg, _child_ffmpeg) = Command::new_sidecar("ffmpeg")
        .map_err(|e| format!("FFmpeg binary missing: {}", e))?
        .args([
            "-y",
            "-ss", &start_time.to_string(),
            "-to", &end_time.to_string(),
            "-i", &video_path,
            "-filter_complex_script", filter_path.to_str().unwrap(),
            "-c:v", "libx264",
            "-crf", "22",
            "-preset", "veryfast",
            "-c:a", "aac", // Force aac for compatibility
            "-b:a", "128k",
            &export_path
        ])
        .spawn()
        .map_err(|e| format!("Failed to initiate rendering engine: {}", e))?;

    while let Some(event) = rx_ffmpeg.recv().await {
        match event {
            tauri::api::process::CommandEvent::Stdout(line) | tauri::api::process::CommandEvent::Stderr(line) => {
                window.emit("process_log", &line).unwrap();
            }
            tauri::api::process::CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) {
                   return Err(format!("Rendering engine failed (Code: {:?}). This usually happens if video files are moved or corrupted during processing.", payload.code));
                }
            }
            _ => {}
        }
    }

    window.emit("process_log", "Smart Portrait Generation Successful!").unwrap();
    Ok(format!("File ready at: {}", export_path))
}

#[tauri::command]
pub fn show_in_folder(path: String) {
    let mut path_buf = PathBuf::from(path);
    if path_buf.is_file() {
        path_buf.pop();
    }
    
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path_buf.to_str().unwrap_or(""))
            .spawn();
    }
}
