use regex::Regex;
use tauri::api::process::{Command, CommandEvent};

pub struct VideoDimensions {
    pub width: u32,
    pub height: u32,
}

pub struct CropBox {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}

/// Probes video metadata using the FFmpeg sidecar to extract exact dimensions.
pub async fn probe_dimensions(video_path: &str) -> Option<VideoDimensions> {
    println!("Probing video dimensions for: {}", video_path);
    
    // FFmpeg prints info to stderr when started with -i
    let (mut rx, _) = Command::new_sidecar("ffmpeg")
        .expect("Failed to create sidecar")
        .args(["-i", video_path])
        .spawn()
        .ok()?;

    let mut output = String::new();
    while let Some(event) = rx.recv().await {
        if let CommandEvent::Stderr(line) = event {
            output.push_str(&line);
            output.push('\n');
            // Optimization: Stop if we found the video stream info
            if line.contains("Stream #0:0") && line.contains("Video:") {
                break;
            }
        }
    }

    // Regex to find patterns like "1920x1080" or "32x32"
    let re = Regex::new(r"(\d{2,})x(\d{2,})").ok()?;
    
    // Only search in lines that actually define a Video stream
    for line in output.lines() {
        if line.contains("Video:") {
            if let Some(caps) = re.captures(line) {
                let w = caps.get(1)?.as_str().parse::<u32>().ok()?;
                let h = caps.get(2)?.as_str().parse::<u32>().ok()?;
                println!("Detected Dimensions: {}x{}", w, h);
                return Some(VideoDimensions { width: w, height: h });
            }
        }
    }

    None
}

/// Calculates a perfectly centered 9:16 crop box based on AI center_x_ratio.
/// All math is done in Rust to ensure the values are valid for FFmpeg.
pub fn calculate_deterministic_crop(dim: &VideoDimensions, center_x_ratio: f64) -> CropBox {
    let input_w = dim.width as f64;
    let input_h = dim.height as f64;
    
    // Target ratio: 9/16 = 0.5625
    // We want the maximum possible 9:16 box inside the source.
    let target_ratio = 9.0 / 16.0;
    
    let crop_w;
    let crop_h;
    
    if input_w / input_h > target_ratio {
        // Landscape or Square: Height is the constraint
        crop_h = input_h;
        crop_w = input_h * target_ratio;
    } else {
        // Very Narrow Portrait: Width is the constraint
        crop_w = input_w;
        crop_h = input_w / target_ratio;
    }
    
    // Calculate starting X based on AI centering
    let mut start_x = (input_w * center_x_ratio) - (crop_w / 2.0);
    
    // Clamp to ensure it doesn't go off-screen
    if start_x < 0.0 { start_x = 0.0; }
    if start_x > (input_w - crop_w) { start_x = input_w - crop_w; }
    
    let box_result = CropBox {
        x: start_x.round() as u32,
        y: 0,
        w: crop_w.round() as u32,
        h: crop_h.round() as u32,
    };
    
    println!("Calculated Deterministic Crop: {}x{} at {},{}", box_result.w, box_result.h, box_result.x, box_result.y);
    box_result
}
