// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod video;
mod commands;

use commands::*;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            download_model, 
            run_whisper_analysis, 
            render_final_video,
            show_in_folder
        ])
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let window = event.window().clone();
                api.prevent_close();
                
                let window_clone = window.clone();
                tauri::api::dialog::ask(
                    Some(&window),
                    "Exit ClipGenius AI?",
                    "Any unsaved progress will be lost. Are you sure you want to exit?",
                    move |answer| {
                        if answer {
                            // We use unwrap here as this is a terminal action
                            window_clone.close().unwrap();
                        }
                    },
                );
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
