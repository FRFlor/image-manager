use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc}; // Still needed for read_image_file
use image::io::Reader as ImageReader;
use uuid::Uuid;
use tauri::{
    Emitter,
    Manager,
    State,
    menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem},
};
use std::sync::{Arc, Mutex};

mod metadata_cache;
use metadata_cache::MetadataCache;

// Struct to track currently loaded session information
#[derive(Debug, Clone)]
struct LoadedSessionInfo {
    name: String,
    #[allow(dead_code)]
    path: String, // Used for reload functionality, but not directly accessed in Rust
}

// Application state to track if we're in the process of exiting
struct AppState {
    is_exiting: Arc<Mutex<bool>>,
    metadata_cache: Arc<MetadataCache>,
    recent_sessions: Arc<Mutex<Vec<String>>>, // Stores paths to recent manual sessions
    loaded_session: Arc<Mutex<Option<LoadedSessionInfo>>>, // Currently loaded session
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
pub struct TabGroup {
    id: String,
    name: String,
    color: String, // "blue" or "orange"
    order: u32,
    #[serde(rename = "tabIds")]
    tab_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    collapsed: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionData {
    name: Option<String>,
    tabs: Vec<SessionTab>,
    #[serde(skip_serializing_if = "Option::is_none")]
    groups: Option<Vec<TabGroup>>,
    #[serde(rename = "activeTabId")]
    active_tab_id: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
    // UI state
    #[serde(rename = "layoutPosition", skip_serializing_if = "Option::is_none")]
    layout_position: Option<String>,
    #[serde(rename = "layoutSize", skip_serializing_if = "Option::is_none")]
    layout_size: Option<String>,
    #[serde(rename = "treeCollapsed", skip_serializing_if = "Option::is_none")]
    tree_collapsed: Option<bool>,
    #[serde(rename = "controlsVisible", skip_serializing_if = "Option::is_none")]
    controls_visible: Option<bool>,
    // Loaded session tracking (only saved in auto-session)
    #[serde(rename = "loadedSessionName", skip_serializing_if = "Option::is_none")]
    loaded_session_name: Option<String>,
    #[serde(rename = "loadedSessionPath", skip_serializing_if = "Option::is_none")]
    loaded_session_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PanOffset {
    x: f64,
    y: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionTab {
    id: String,
    #[serde(rename = "imagePath")]
    image_path: String,
    order: u32,
    #[serde(rename = "groupId", skip_serializing_if = "Option::is_none")]
    group_id: Option<String>,
    #[serde(rename = "zoomLevel", skip_serializing_if = "Option::is_none")]
    zoom_level: Option<f64>,
    #[serde(rename = "fitMode", skip_serializing_if = "Option::is_none")]
    fit_mode: Option<String>,
    #[serde(rename = "panOffset", skip_serializing_if = "Option::is_none")]
    pan_offset: Option<PanOffset>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedFolderResult {
    entries: Vec<FileEntry>,
    total_count: usize,
    has_more: bool,
    offset: usize,
    limit: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadedSessionResult {
    #[serde(rename = "sessionData")]
    session_data: SessionData,
    path: String,
    name: String,
}

// Helper function to collect image files from a directory
fn collect_image_files(target_path: &Path) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let supported_extensions = get_supported_image_extensions();

    match fs::read_dir(target_path) {
        Ok(dir_entries) => {
            for entry in dir_entries {
                if let Ok(dir_entry) = entry {
                    // Skip directories entirely - only process files
                    if let Ok(file_type) = dir_entry.file_type() {
                        if file_type.is_dir() {
                            continue;
                        }
                    }

                    let path = dir_entry.path();

                    // Only include files with supported image extensions
                    let is_image = path.extension()
                        .and_then(|ext| ext.to_str())
                        .map(|ext| supported_extensions.contains(&ext.to_lowercase()))
                        .unwrap_or(false);

                    if !is_image {
                        continue;
                    }

                    let name = path.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string();

                    entries.push(FileEntry {
                        name: name.clone(),
                        path: path.to_string_lossy().to_string(),
                        is_directory: false,
                        is_image: true,
                        size: None,
                        last_modified: None,
                    });
                }
            }
        }
        Err(e) => return Err(format!("Failed to read directory: {}", e)),
    }

    // Sort entries alphabetically by name for consistent ordering
    entries.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(entries)
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

    collect_image_files(&target_path)
}

#[tauri::command]
async fn browse_folder_paginated(
    path: Option<String>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> Result<PaginatedFolderResult, String> {
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

    // Collect all image files
    let all_entries = collect_image_files(&target_path)?;
    let total_count = all_entries.len();

    // Apply pagination
    let offset = offset.unwrap_or(0);
    let limit = limit.unwrap_or(500); // Default to 500 items per page

    let end_index = std::cmp::min(offset + limit, total_count);
    let entries: Vec<FileEntry> = if offset < total_count {
        all_entries[offset..end_index].to_vec()
    } else {
        Vec::new()
    };

    let has_more = end_index < total_count;

    Ok(PaginatedFolderResult {
        entries,
        total_count,
        has_more,
        offset,
        limit,
    })
}

#[tauri::command]
async fn get_folder_image_count(path: String) -> Result<usize, String> {
    let target_path = PathBuf::from(path);

    if !target_path.exists() {
        return Err(format!("Path does not exist: {}", target_path.display()));
    }

    if !target_path.is_dir() {
        return Err(format!("Path is not a directory: {}", target_path.display()));
    }

    let entries = collect_image_files(&target_path)?;
    Ok(entries.len())
}

#[tauri::command]
async fn read_image_file(path: String, state: State<'_, AppState>) -> Result<ImageData, String> {
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

    // Check cache first
    let dimensions = if let Some(cached) = state.metadata_cache.get(&path, &last_modified)? {
        // Cache hit! Use cached dimensions
        ImageDimensions {
            width: cached.width,
            height: cached.height,
        }
    } else {
        // Cache miss - read image dimensions from file
        let dims = match ImageReader::open(&image_path) {
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

        // Store in cache for future use
        state.metadata_cache.set(&path, &last_modified, dims.width, dims.height, file_size)?;

        dims
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
async fn save_session_dialog(app_handle: tauri::AppHandle, session_data: SessionData, state: State<'_, AppState>) -> Result<Option<String>, String> {
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

            // Add to recent sessions list and persist
            add_recent_session(&state.recent_sessions, &path_str)?;
            save_recent_sessions(&state.recent_sessions)?;

            // Set this as the currently loaded session
            let path_obj = Path::new(&path_str);
            let session_name = path_obj.file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();
            *state.loaded_session.lock().unwrap() = Some(LoadedSessionInfo {
                name: session_name.clone(),
                path: path_str.clone(),
            });

            // Update window title to show loaded session
            let window_title = format!("Image Viewer: {}", session_name);
            if let Err(e) = set_window_title(app_handle.clone(), window_title).await {
                eprintln!("Warning: Failed to update window title: {}", e);
            }

            // Update the menu to reflect the new recent sessions list and loaded session
            let recent_sessions = state.recent_sessions.lock().unwrap().clone();
            let loaded_session = state.loaded_session.lock().unwrap().clone();
            if let Err(e) = update_full_menu(&app_handle, &recent_sessions, &loaded_session) {
                eprintln!("Warning: Failed to update menu: {}", e);
            }

            Ok(Some(path_str))
        }
        Ok(None) => Ok(None), // User cancelled the dialog
        Err(_) => Err("Dialog operation failed".to_string()),
    }
}

#[tauri::command]
async fn load_session_dialog(app_handle: tauri::AppHandle, state: State<'_, AppState>) -> Result<Option<LoadedSessionResult>, String> {
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

            // Add to recent sessions list
            add_recent_session(&state.recent_sessions, &path_str)?;
            save_recent_sessions(&state.recent_sessions)?;

            // Set this as the currently loaded session
            let session_name = path_buf.file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();
            *state.loaded_session.lock().unwrap() = Some(LoadedSessionInfo {
                name: session_name.clone(),
                path: path_str.clone(),
            });

            // Update window title to show loaded session
            let window_title = format!("Image Viewer: {}", session_name);
            if let Err(e) = set_window_title(app_handle.clone(), window_title).await {
                eprintln!("Warning: Failed to update window title: {}", e);
            }

            // Update the menu to reflect the new recent sessions list and loaded session
            let recent_sessions = state.recent_sessions.lock().unwrap().clone();
            let loaded_session = state.loaded_session.lock().unwrap().clone();
            if let Err(e) = update_full_menu(&app_handle, &recent_sessions, &loaded_session) {
                eprintln!("Warning: Failed to update menu: {}", e);
            }

            println!("Session loaded from: {}", path_str);
            Ok(Some(LoadedSessionResult {
                session_data,
                path: path_str,
                name: session_name,
            }))
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

// Helper function to add a session to the recent list (max 10 items)
fn add_recent_session(recent_sessions: &Arc<Mutex<Vec<String>>>, path: &str) -> Result<(), String> {
    let mut sessions = recent_sessions.lock().unwrap();

    // Remove the path if it already exists (to move it to the front)
    sessions.retain(|p| p != path);

    // Add to the front
    sessions.insert(0, path.to_string());

    // Keep only the most recent 10
    if sessions.len() > 10 {
        sessions.truncate(10);
    }

    Ok(())
}

// Helper function to save recent sessions to disk
fn save_recent_sessions(recent_sessions: &Arc<Mutex<Vec<String>>>) -> Result<(), String> {
    use dirs;

    let app_data_dir = dirs::data_dir()
        .ok_or("Failed to get application data directory")?
        .join("image-viewer");

    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let recent_sessions_file = app_data_dir.join("recent-sessions.json");

    let sessions = recent_sessions.lock().unwrap();
    let json_data = serde_json::to_string_pretty(&*sessions)
        .map_err(|e| format!("Failed to serialize recent sessions: {}", e))?;

    fs::write(&recent_sessions_file, json_data)
        .map_err(|e| format!("Failed to write recent sessions file: {}", e))?;

    Ok(())
}

// Helper function to load recent sessions from disk
fn load_recent_sessions() -> Vec<String> {
    use dirs;

    let app_data_dir = match dirs::data_dir() {
        Some(dir) => dir.join("image-viewer"),
        None => return Vec::new(),
    };

    let recent_sessions_file = app_data_dir.join("recent-sessions.json");

    if !recent_sessions_file.exists() {
        return Vec::new();
    }

    match fs::read_to_string(&recent_sessions_file) {
        Ok(json_data) => {
            match serde_json::from_str::<Vec<String>>(&json_data) {
                Ok(sessions) => {
                    // Validate that files still exist and filter out missing ones
                    sessions.into_iter()
                        .filter(|path| Path::new(path).exists())
                        .collect()
                }
                Err(e) => {
                    eprintln!("Failed to parse recent sessions: {}", e);
                    Vec::new()
                }
            }
        }
        Err(e) => {
            eprintln!("Failed to read recent sessions file: {}", e);
            Vec::new()
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecentSessionInfo {
    path: String,
    name: String,
}

#[tauri::command]
async fn get_recent_sessions(state: State<'_, AppState>) -> Result<Vec<RecentSessionInfo>, String> {
    let sessions = state.recent_sessions.lock().unwrap();

    let mut result = Vec::new();
    for path in sessions.iter() {
        // Extract filename from path
        let path_obj = Path::new(path);
        let name = path_obj.file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        result.push(RecentSessionInfo {
            path: path.clone(),
            name,
        });
    }

    Ok(result)
}

#[tauri::command]
async fn load_session_from_path(app: tauri::AppHandle, path: String, state: State<'_, AppState>) -> Result<SessionData, String> {
    let path_obj = Path::new(&path);

    if !path_obj.exists() {
        return Err(format!("Session file does not exist: {}", path));
    }

    // Read the file
    let json_data = fs::read_to_string(&path_obj)
        .map_err(|e| format!("Failed to read session file: {}", e))?;

    // Deserialize JSON data
    let session_data: SessionData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse session data: {}", e))?;

    // Add to recent sessions list
    add_recent_session(&state.recent_sessions, &path)?;
    save_recent_sessions(&state.recent_sessions)?;

    // Set this as the currently loaded session
    let session_name = path_obj.file_stem()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    *state.loaded_session.lock().unwrap() = Some(LoadedSessionInfo {
        name: session_name.clone(),
        path: path.clone(),
    });

    // Update window title to show loaded session
    let window_title = format!("Image Viewer: {}", session_name);
    set_window_title(app.clone(), window_title).await?;

    // Update the menu to reflect the new recent sessions list and loaded session
    let recent_sessions = state.recent_sessions.lock().unwrap().clone();
    let loaded_session = state.loaded_session.lock().unwrap().clone();
    if let Err(e) = update_full_menu(&app, &recent_sessions, &loaded_session) {
        eprintln!("Warning: Failed to update menu: {}", e);
    }

    println!("Session loaded from: {}", path);
    Ok(session_data)
}

#[tauri::command]
async fn refresh_menu(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let recent_sessions = state.recent_sessions.lock().unwrap().clone();
    let loaded_session = state.loaded_session.lock().unwrap().clone();
    update_full_menu(&app, &recent_sessions, &loaded_session)?;
    println!("Menu updated");
    Ok(())
}

#[tauri::command]
async fn set_loaded_session(app: tauri::AppHandle, name: String, path: String, state: State<'_, AppState>) -> Result<(), String> {
    let session_info = LoadedSessionInfo { name: name.clone(), path };
    *state.loaded_session.lock().unwrap() = Some(session_info);

    // Update window title to show loaded session
    let window_title = format!("Image Viewer: {}", name);
    set_window_title(app.clone(), window_title).await?;

    // Update menu to show the loaded session
    let recent_sessions = state.recent_sessions.lock().unwrap().clone();
    let loaded_session = state.loaded_session.lock().unwrap().clone();
    update_full_menu(&app, &recent_sessions, &loaded_session)?;

    println!("Loaded session menu updated");
    Ok(())
}

#[tauri::command]
async fn clear_loaded_session(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    *state.loaded_session.lock().unwrap() = None;

    // Reset window title to default
    set_window_title(app.clone(), "Image Viewer".to_string()).await?;

    // Update menu to remove the loaded session
    let recent_sessions = state.recent_sessions.lock().unwrap().clone();
    let loaded_session = state.loaded_session.lock().unwrap().clone();
    update_full_menu(&app, &recent_sessions, &loaded_session)?;

    println!("Loaded session cleared from menu");
    Ok(())
}

#[tauri::command]
async fn update_session_file(path: String, session_data: SessionData) -> Result<(), String> {
    let path_obj = Path::new(&path);

    // Serialize session data to JSON
    let json_data = serde_json::to_string_pretty(&session_data)
        .map_err(|e| format!("Failed to serialize session data: {}", e))?;

    // Write to file
    fs::write(&path_obj, json_data)
        .map_err(|e| format!("Failed to write session file: {}", e))?;

    println!("Session file updated at: {}", path);
    Ok(())
}

#[tauri::command]
async fn set_window_title(app: tauri::AppHandle, title: String) -> Result<(), String> {
    // Get the main window and set its title
    for (_, window) in app.webview_windows() {
        window.set_title(&title)
            .map_err(|e| format!("Failed to set window title: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
async fn exit_app(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    println!("Exiting application...");

    // Set the exiting flag so window close events won't prevent close
    *state.is_exiting.lock().unwrap() = true;

    // Flush metadata cache to ensure all data is written to disk
    if let Ok(stats) = state.metadata_cache.get_stats() {
        println!("Flushing metadata cache ({} entries)...", stats.entry_count);
        if let Err(e) = state.metadata_cache.flush() {
            eprintln!("Warning: Failed to flush cache on exit: {}", e);
        }
    }
    // The SQLite connection will be automatically closed when the Arc is dropped

    // Close all windows gracefully
    // When all windows are closed, Tauri will exit naturally with code 0
    for (_, window) in app.webview_windows() {
        let _ = window.close();
    }

    Ok(())
}

// Helper function to build the Recent Sessions submenu
fn build_recent_sessions_submenu(app: &tauri::AppHandle, recent_sessions: &[String]) -> Result<tauri::menu::Submenu<tauri::Wry>, tauri::Error> {
    use tauri::menu::SubmenuBuilder;
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

    let mut recent_menu_builder = SubmenuBuilder::new(app, "Recent Saved Sessions");

    // Add "Last Autosaved Session" at the top
    recent_menu_builder = recent_menu_builder
        .text("load_auto_session_menu", "Last Autosaved Session");

    if !recent_sessions.is_empty() {
        recent_menu_builder = recent_menu_builder.separator();

        // Add up to 10 recent manual sessions
        for session_path in recent_sessions.iter().take(10) {
            let path_obj = Path::new(session_path);
            let name = path_obj.file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();

            // Encode the full path in the menu ID (base64 to handle special characters)
            let encoded_path = URL_SAFE_NO_PAD.encode(session_path.as_bytes());
            let menu_id = format!("load_recent_path_{}", encoded_path);
            recent_menu_builder = recent_menu_builder.text(&menu_id, name);
        }
    }

    recent_menu_builder.build()
}

// Helper function to build the Loaded Session submenu (if a session is loaded)
fn build_loaded_session_menu(app: &tauri::AppHandle, loaded_session: &Option<LoadedSessionInfo>) -> Result<Option<tauri::menu::Submenu<tauri::Wry>>, tauri::Error> {
    use tauri::menu::SubmenuBuilder;

    if let Some(session_info) = loaded_session {
        // Platform-specific menu title:
        // - Windows: Use generic "Session" (due to 10-character truncation bug)
        // - macOS: Use full session name (works correctly)
        #[cfg(target_os = "windows")]
        let menu_title = "Session";

        #[cfg(not(target_os = "windows"))]
        let menu_title = session_info.name.as_str();

        println!("Building loaded session menu with name: '{}' (length: {})", session_info.name, session_info.name.len());
        let loaded_menu = SubmenuBuilder::new(app, menu_title)
            .text("reload_session", "Reload")
            .text("update_session", "Update")
            .build()?;
        Ok(Some(loaded_menu))
    } else {
        Ok(None)
    }
}

// Update the menu with current recent sessions and loaded session
fn update_full_menu(app: &tauri::AppHandle, recent_sessions: &[String], loaded_session: &Option<LoadedSessionInfo>) -> Result<(), String> {
    use tauri::menu::{MenuBuilder, SubmenuBuilder, PredefinedMenuItem};

    // Build the new recent sessions submenu
    let recent_menu = build_recent_sessions_submenu(app, recent_sessions)
        .map_err(|e| format!("Failed to build recent sessions submenu: {}", e))?;

    // Rebuild the entire menu with the updated submenu
    let file_menu = SubmenuBuilder::new(app, "File")
        .text("save_session", "Save Session")
        .text("load_session", "Load Session")
        .item(&recent_menu)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, Some("Close Window"))
            .map_err(|e| format!("Failed to create close window menu item: {}", e))?)
        .build()
        .map_err(|e| format!("Failed to build File menu: {}", e))?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .text("toggle_controls", "Toggle Controls")
        .build()
        .map_err(|e| format!("Failed to build View menu: {}", e))?;

    // Build menu bar with File, View, and optionally Loaded Session
    let mut menu_builder = MenuBuilder::new(app);
    menu_builder = menu_builder.item(&file_menu);

    menu_builder = menu_builder.item(&view_menu);

    // Add loaded session menu if a session is loaded
    if let Some(loaded_menu) = build_loaded_session_menu(app, loaded_session)
        .map_err(|e| format!("Failed to build loaded session menu: {}", e))? {
        menu_builder = menu_builder.item(&loaded_menu);
    }

    let app_menu = menu_builder.build()
        .map_err(|e| format!("Failed to build menu: {}", e))?;

    app.set_menu(app_menu)
        .map_err(|e| format!("Failed to set menu: {}", e))?;

    Ok(())
}

// Menu functionality will be implemented separately

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize metadata cache
    let metadata_cache = match MetadataCache::new(100_000) {
        Ok(cache) => {
            if let Ok(stats) = cache.get_stats() {
                println!("Metadata cache loaded: {}/{} entries", stats.entry_count, stats.max_entries);
            }
            Arc::new(cache)
        }
        Err(e) => {
            eprintln!("Failed to initialize metadata cache: {}", e);
            eprintln!("The app will continue without caching (performance will be degraded)");
            // This will panic - we need cache to work properly
            panic!("Cannot start app without metadata cache");
        }
    };

    // Initialize app state
    let recent_sessions = load_recent_sessions();
    println!("Loaded {} recent sessions", recent_sessions.len());

    let app_state = AppState {
        is_exiting: Arc::new(Mutex::new(false)),
        metadata_cache,
        recent_sessions: Arc::new(Mutex::new(recent_sessions)),
        loaded_session: Arc::new(Mutex::new(None)), // No session loaded initially
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            browse_folder,
            browse_folder_paginated,
            get_folder_image_count,
            read_image_file,
            get_supported_image_types,
            open_folder_dialog,
            open_image_dialog,
            save_session_dialog,
            load_session_dialog,
            save_auto_session,
            load_auto_session,
            get_recent_sessions,
            load_session_from_path,
            refresh_menu,
            set_loaded_session,
            clear_loaded_session,
            update_session_file,
            set_window_title,
            exit_app
        ])
        .setup(|app| {
            // --- Build the application menu ---
            // Get recent sessions from state
            let app_state: State<AppState> = app.state();
            let recent_sessions = app_state.recent_sessions.lock().unwrap().clone();

            // Build "Recent Saved Sessions" submenu using helper function
            let recent_menu = build_recent_sessions_submenu(&app.handle(), &recent_sessions)?;

            // "File" submenu with our custom items and the native Close Window
            let file_menu = SubmenuBuilder::new(app, "File")
                .text("save_session",  "Save Session")
                .text("load_session", "Load Session")
                .item(&recent_menu)
                .separator()
                // Keep the platform-native Close Window (Cmd/Ctrl+W etc.)
                .item(&PredefinedMenuItem::close_window(app, Some("Close Window"))?)
                .build()?;

            // "View" submenu with Toggle Controls option
            let view_menu = SubmenuBuilder::new(app, "View")
                .text("toggle_controls", "Toggle Controls")
                .build()?;

            let app_menu = MenuBuilder::new(app)
                .items(&[&file_menu, &view_menu]) // add more submenus here if you like
                .build()?;

            app.set_menu(app_menu)?;

            // --- Handle menu clicks ---
            // Dispatch simple events to the frontend. (Or perform Rust logic here)
            app.on_menu_event(move |app_handle, event| {
                use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};

                let event_id = event.id().0.as_str();
                match event_id {
                    "save_session" => {
                        // Frontend can listen to this and call save routine / command
                        let _ = app_handle.emit("menu-save-session", ());
                    }
                    "load_session" => {
                        let _ = app_handle.emit("menu-load-session", ());
                    }
                    "load_auto_session_menu" => {
                        let _ = app_handle.emit("menu-load-auto-session", ());
                    }
                    "toggle_controls" => {
                        let _ = app_handle.emit("menu-toggle-controls", ());
                    }
                    "reload_session" => {
                        let _ = app_handle.emit("menu-reload-session", ());
                    }
                    "update_session" => {
                        let _ = app_handle.emit("menu-update-session", ());
                    }
                    id if id.starts_with("load_recent_path_") => {
                        // Extract and decode the path from menu ID
                        if let Some(encoded_path) = id.strip_prefix("load_recent_path_") {
                            if let Ok(decoded_bytes) = URL_SAFE_NO_PAD.decode(encoded_path) {
                                if let Ok(session_path) = String::from_utf8(decoded_bytes) {
                                    let _ = app_handle.emit("menu-load-recent-session", session_path);
                                }
                            }
                        }
                    }
                    _ => {}
                }
            });

            // --- Handle window close events ---
            // Prevent immediate window close to allow session save on all platforms
            // This ensures consistent behavior across macOS and Windows
            let app_state: State<AppState> = app.state();
            let is_exiting_clone = app_state.is_exiting.clone();

            for (_, window) in app.webview_windows() {
                let is_exiting = is_exiting_clone.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // Check if we're already in the exit process
                        let exiting = *is_exiting.lock().unwrap();
                        if exiting {
                            // Allow the close to proceed during exit
                            return;
                        }

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
