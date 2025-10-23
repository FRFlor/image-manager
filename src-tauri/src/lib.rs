use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    is_image: bool,
    size: Option<u64>,
    last_modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageData {
    id: String,
    name: String,
    path: String,
    asset_url: String,
    dimensions: ImageDimensions,
    file_size: u64,
    last_modified: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImageDimensions {
    width: u32,
    height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionData {
    name: Option<String>,
    tabs: Vec<SessionTab>,
    active_tab_id: Option<String>,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionTab {
    id: String,
    image_path: String,
    order: u32,
}

// Placeholder commands - will be implemented in future tasks
#[tauri::command]
async fn browse_folder(path: Option<String>) -> Result<Vec<FileEntry>, String> {
    // Implementation will be added in task 3
    Ok(vec![])
}

#[tauri::command]
async fn read_image_file(path: String) -> Result<ImageData, String> {
    // Implementation will be added in task 3
    Err("Not implemented yet".to_string())
}

#[tauri::command]
async fn get_supported_image_types() -> Vec<String> {
    // Implementation will be added in task 3
    vec!["jpg".to_string(), "jpeg".to_string(), "png".to_string(), "gif".to_string(), "webp".to_string(), "bmp".to_string()]
}

#[tauri::command]
async fn open_folder_dialog() -> Result<Option<String>, String> {
    // Implementation will be added in task 3
    Ok(None)
}

#[tauri::command]
async fn save_session_dialog(session_data: SessionData) -> Result<Option<String>, String> {
    // Implementation will be added in task 11
    Ok(None)
}

#[tauri::command]
async fn load_session_dialog() -> Result<Option<SessionData>, String> {
    // Implementation will be added in task 11
    Ok(None)
}

#[tauri::command]
async fn save_auto_session(session_data: SessionData) -> Result<(), String> {
    // Implementation will be added in task 10
    Ok(())
}

#[tauri::command]
async fn load_auto_session() -> Result<Option<SessionData>, String> {
    // Implementation will be added in task 10
    Ok(None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            browse_folder,
            read_image_file,
            get_supported_image_types,
            open_folder_dialog,
            save_session_dialog,
            load_session_dialog,
            save_auto_session,
            load_auto_session
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
