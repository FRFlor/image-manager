use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};
use image::io::Reader as ImageReader;
use uuid::Uuid;
use tauri::{
    Emitter,
    Manager,
    menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem},
};

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
    #[serde(rename = "activeTabId")]
    active_tab_id: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionTab {
    id: String,
    #[serde(rename = "imagePath")]
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
            match reader.with_guessed_format() {
                Ok(reader_with_format) => {
                    match reader_with_format.into_dimensions() {
                        Ok((width, height)) => ImageDimensions { width, height },
                        Err(e) => return Err(format!("Failed to read image dimensions: {}", e)),
                    }
                }
                Err(e) => return Err(format!("Failed to detect image format: {}", e)),
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
async fn open_image_dialog(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::{Arc, Mutex};
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    let supported_extensions = get_supported_image_extensions();
    let extensions: Vec<&str> = supported_extensions.iter().map(|s| s.as_str()).collect();
    
    app_handle.dialog().file()
        .add_filter("Image Files", &extensions)
        .pick_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(tx) = sender.take() {
                    let _ = tx.send(file_path);
                }
            }
        });
    
    match rx.await {
        Ok(Some(file_path)) => {
            let path_str = file_path.to_string();
            Ok(Some(path_str))
        }
        Ok(None) => Ok(None), // User cancelled the dialog
        Err(_) => Err("Dialog operation failed".to_string()),
    }
}

#[tauri::command]
async fn save_session_dialog(app_handle: tauri::AppHandle, session_data: SessionData) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::{Arc, Mutex};
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    // Create a default filename with timestamp if no name is provided
    let default_name = match &session_data.name {
        Some(name) => format!("{}.session.json", name),
        None => {
            let now = chrono::Utc::now();
            format!("session_{}.session.json", now.format("%Y%m%d_%H%M%S"))
        }
    };
    
    app_handle.dialog().file()
        .add_filter("Session Files", &["json"])
        .set_file_name(&default_name)
        .save_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(tx) = sender.take() {
                    let _ = tx.send(file_path);
                }
            }
        });
    
    match rx.await {
        Ok(Some(file_path)) => {
            let path_buf = file_path.as_path().unwrap();
            let path_str = path_buf.to_string_lossy().to_string();
            
            // Serialize session data to JSON
            let json_data = serde_json::to_string_pretty(&session_data)
                .map_err(|e| format!("Failed to serialize session data: {}", e))?;
            
            // Write to file
            std::fs::write(&path_buf, json_data)
                .map_err(|e| format!("Failed to write session file: {}", e))?;
            
            println!("Session saved to: {}", path_str);
            Ok(Some(path_str))
        }
        Ok(None) => Ok(None), // User cancelled the dialog
        Err(_) => Err("Dialog operation failed".to_string()),
    }
}

#[tauri::command]
async fn load_session_dialog(app_handle: tauri::AppHandle) -> Result<Option<SessionData>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::{Arc, Mutex};
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    let tx = Arc::new(Mutex::new(Some(tx)));
    
    app_handle.dialog().file()
        .add_filter("Session Files", &["json"])
        .pick_file(move |file_path| {
            if let Ok(mut sender) = tx.lock() {
                if let Some(tx) = sender.take() {
                    let _ = tx.send(file_path);
                }
            }
        });
    
    match rx.await {
        Ok(Some(file_path)) => {
            let path_buf = file_path.as_path().unwrap();
            let path_str = path_buf.to_string_lossy().to_string();
            
            // Read the file
            let json_data = std::fs::read_to_string(&path_buf)
                .map_err(|e| format!("Failed to read session file: {}", e))?;
            
            // Deserialize JSON data
            let session_data: SessionData = serde_json::from_str(&json_data)
                .map_err(|e| format!("Failed to parse session data: {}", e))?;
            
            println!("Session loaded from: {}", path_str);
            Ok(Some(session_data))
        }
        Ok(None) => Ok(None), // User cancelled the dialog
        Err(_) => Err("Dialog operation failed".to_string()),
    }
}

#[tauri::command]
async fn save_auto_session(session_data: SessionData) -> Result<(), String> {
    use std::fs;
    use dirs;
    
    // Get the application data directory
    let app_data_dir = dirs::data_dir()
        .ok_or("Failed to get application data directory")?
        .join("image-viewer");
    
    // Create the directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    
    let session_file = app_data_dir.join("auto-session.json");
    
    // Serialize session data to JSON
    let json_data = serde_json::to_string_pretty(&session_data)
        .map_err(|e| format!("Failed to serialize session data: {}", e))?;
    
    // Write to file
    fs::write(&session_file, json_data)
        .map_err(|e| format!("Failed to write session file: {}", e))?;
    
    println!("Auto-session saved to: {}", session_file.display());
    Ok(())
}

#[tauri::command]
async fn load_auto_session() -> Result<Option<SessionData>, String> {
    use std::fs;
    use dirs;

    // Get the application data directory
    let app_data_dir = dirs::data_dir()
        .ok_or("Failed to get application data directory")?
        .join("image-viewer");

    let session_file = app_data_dir.join("auto-session.json");

    // Check if the session file exists
    if !session_file.exists() {
        return Ok(None);
    }

    // Read the file
    let json_data = fs::read_to_string(&session_file)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    // Deserialize JSON data
    let session_data: SessionData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse session data: {}", e))?;

    println!("Auto-session loaded from: {}", session_file.display());
    Ok(Some(session_data))
}

#[tauri::command]
async fn exit_app(app: tauri::AppHandle) -> Result<(), String> {
    println!("Exiting application...");
    app.exit(0);
    Ok(())
}

// Menu functionality will be implemented separately

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
            open_image_dialog,
            save_session_dialog,
            load_session_dialog,
            save_auto_session,
            load_auto_session,
            exit_app
        ])
        .setup(|app| {
            // --- Build the application menu ---
            // "File" submenu with our custom items and the native Close Window
            let file_menu = SubmenuBuilder::new(app, "File")
                .text("save_session",  "Save Session")
                .text("load_session", "Load Session")
                .separator()
                // Keep the platform-native Close Window (Cmd/Ctrl+W etc.)
                .item(&PredefinedMenuItem::close_window(app, Some("Close Window"))?)
                .build()?;

            let app_menu = MenuBuilder::new(app)
                .items(&[&file_menu]) // add more submenus here if you like
                .build()?;

            app.set_menu(app_menu)?;

            // --- Handle menu clicks ---
            // Dispatch simple events to the frontend. (Or perform Rust logic here)
            app.on_menu_event(|app_handle, event| {
                match event.id().0.as_str() {
                    "save_session" => {
                        // Frontend can listen to this and call save routine / command
                        let _ = app_handle.emit("menu-save-session", ());
                    }
                    "load_session" => {
                        let _ = app_handle.emit("menu-load-session", ());
                    }
                    _ => {}
                }
            });

            // --- Handle window close events ---
            // Prevent immediate window close to allow session save on all platforms
            // This ensures consistent behavior across macOS and Windows
            for (_, window) in app.webview_windows() {
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Prevent default close behavior to allow async session save
                        api.prevent_close();
                        // The tauri://close-requested event will be emitted to the frontend
                        // Frontend will save the session and then call exit_app command
                    }
                });
            }

            // keep your existing logging init
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
