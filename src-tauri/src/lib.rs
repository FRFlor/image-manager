use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use image::io::Reader as ImageReader;
use uuid::Uuid;

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

// File system operations
#[tauri::command]
async fn browse_folder(path: Option<String>) -> Result<Vec<FileEntry>, String> {
    let target_path = match path {
        Some(p) => PathBuf::from(p),
        None => std::env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?,
    };

    if !target_path.exists() {
        return Err(format!("Path does not exist: {}", target_path.display()));
    }

    if !target_path.is_dir() {
        return Err(format!("Path is not a directory: {}", target_path.display()));
    }

    let mut entries = Vec::new();
    let supported_extensions = get_supported_image_extensions();

    match fs::read_dir(&target_path) {
        Ok(dir_entries) => {
            for entry in dir_entries {
                match entry {
                    Ok(dir_entry) => {
                        let path = dir_entry.path();
                        let name = path.file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("Unknown")
                            .to_string();

                        let is_directory = path.is_dir();
                        let is_image = if is_directory {
                            false
                        } else {
                            path.extension()
                                .and_then(|ext| ext.to_str())
                                .map(|ext| supported_extensions.contains(&ext.to_lowercase()))
                                .unwrap_or(false)
                        };

                        let metadata = fs::metadata(&path).ok();
                        let size = metadata.as_ref().and_then(|m| if m.is_file() { Some(m.len()) } else { None });
                        let last_modified = metadata.and_then(|m| {
                            m.modified().ok().and_then(|time| {
                                DateTime::<Utc>::from(time).format("%Y-%m-%d %H:%M:%S UTC").to_string().into()
                            })
                        });

                        entries.push(FileEntry {
                            name,
                            path: path.to_string_lossy().to_string(),
                            is_directory,
                            is_image,
                            size,
                            last_modified,
                        });
                    }
                    Err(e) => {
                        // Log error but continue processing other entries
                        eprintln!("Error reading directory entry: {}", e);
                    }
                }
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }

    // Sort entries: directories first, then files, both alphabetically
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

#[tauri::command]
async fn read_image_file(path: String) -> Result<ImageData, String> {
    let image_path = Path::new(&path);
    
    if !image_path.exists() {
        return Err(format!("Image file does not exist: {}", path));
    }

    if !image_path.is_file() {
        return Err(format!("Path is not a file: {}", path));
    }

    // Validate file extension
    let supported_extensions = get_supported_image_extensions();
    let extension = image_path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase())
        .ok_or_else(|| "File has no extension".to_string())?;

    if !supported_extensions.contains(&extension) {
        return Err(format!("Unsupported image format: {}", extension));
    }

    // Get file metadata
    let metadata = fs::metadata(&image_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    let file_size = metadata.len();
    let last_modified = metadata.modified()
        .map_err(|e| format!("Failed to get file modification time: {}", e))
        .and_then(|time| {
            Ok(DateTime::<Utc>::from(time).format("%Y-%m-%d %H:%M:%S UTC").to_string())
        })?;

    // Read image dimensions
    let dimensions = match ImageReader::open(&image_path) {
        Ok(reader) => {
            match reader.into_dimensions() {
                Ok((width, height)) => ImageDimensions { width, height },
                Err(e) => return Err(format!("Failed to read image dimensions: {}", e)),
            }
        }
        Err(e) => return Err(format!("Failed to open image file: {}", e)),
    };

    // Generate unique ID and asset URL
    let id = Uuid::new_v4().to_string();
    let name = image_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    
    // Create asset URL for Tauri's asset protocol
    let asset_url = format!("asset://localhost/{}", path.replace("\\", "/"));

    Ok(ImageData {
        id,
        name,
        path,
        asset_url,
        dimensions,
        file_size,
        last_modified,
    })
}

fn get_supported_image_extensions() -> Vec<String> {
    vec![
        "jpg".to_string(),
        "jpeg".to_string(),
        "png".to_string(),
        "gif".to_string(),
        "webp".to_string(),
        "bmp".to_string(),
        "tiff".to_string(),
        "tif".to_string(),
        "ico".to_string(),
    ]
}

#[tauri::command]
async fn get_supported_image_types() -> Vec<String> {
    get_supported_image_extensions()
}

#[tauri::command]
async fn open_folder_dialog(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::{Arc, Mutex};
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    app_handle.dialog().file().pick_folder(move |folder_path| {
        if let Ok(mut sender) = tx.lock() {
            if let Some(tx) = sender.take() {
                let _ = tx.send(folder_path);
            }
        }
    });
    
    match rx.await {
        Ok(Some(folder_path)) => {
            let path_str = folder_path.to_string();
            Ok(Some(path_str))
        }
        Ok(None) => Ok(None), // User cancelled the dialog
        Err(_) => Err("Dialog operation failed".to_string()),
    }
}

#[tauri::command]
async fn save_session_dialog(_session_data: SessionData) -> Result<Option<String>, String> {
    // Implementation will be added in task 11
    Ok(None)
}

#[tauri::command]
async fn load_session_dialog() -> Result<Option<SessionData>, String> {
    // Implementation will be added in task 11
    Ok(None)
}

#[tauri::command]
async fn save_auto_session(_session_data: SessionData) -> Result<(), String> {
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
