# Design Document

## Overview

The image viewer application will be built as a desktop application using Tauri with a Vue.js 3 frontend. Tauri provides a Rust backend with native file system access and a web-based frontend using Vue.js 3, TypeScript, and Vite. This approach combines the performance and system integration of native applications with the flexibility and rapid development of web technologies. The design follows a component-based architecture with clear separation between the Rust backend (file operations) and Vue frontend (UI and image management).

## Architecture

The application follows a hybrid architecture with Tauri's frontend-backend separation:

1. **Frontend (Vue.js)**: UI components, image rendering, and user interaction
2. **Backend (Rust/Tauri)**: File system operations, directory traversal, and system integration
3. **IPC Layer**: Communication between frontend and backend via Tauri commands
4. **State Management**: Vue 3 Composition API for frontend state, Rust structs for backend data

### Key Architectural Decisions

- **Desktop Framework**: Tauri for native desktop application with web frontend
- **File System Access**: Native Rust file system APIs through Tauri commands
- **State Management**: Vue 3's Composition API for UI state, Tauri state management for backend
- **Image Loading**: Use Tauri's asset protocol to serve images directly from file system
- **Cross-Platform**: Tauri's native compilation for Mac, Windows, and Linux
- **IPC Communication**: Tauri's invoke system for secure frontend-backend communication

## Components and Interfaces

### Core Components

#### 1. App.vue (Root Component)
- Main application container
- Manages global keyboard shortcuts
- Handles application-level state

#### 2. FolderNavigator.vue
- File system browsing interface
- Directory tree navigation
- Image file filtering and selection
- Thumbnail generation for image files

#### 3. ImageTabs.vue
- Tab management for open images
- Tab creation, switching, and closing
- Tab title management
- Drag-and-drop tab reordering
- Dynamic tab sizing based on number of tabs
- Horizontal scrolling for overflow tabs

#### 4. ImageViewer.vue
- Individual image display component
- Zoom and pan functionality
- Keyboard shortcut handling for image operations
- Fit-to-window and actual size modes

#### 5. ImageTab.vue
- Single tab representation
- Tab title and close button
- Active state management
- Drag-and-drop functionality
- Dynamic width calculation

#### 6. SessionManager.vue
- Session save/load interface with file dialogs
- Save session with .session.json extension
- Load session with file picker filtered to .session.json files

### Service Interfaces

#### Tauri Commands (Rust Backend)
```rust
#[tauri::command]
async fn browse_folder(path: Option<String>) -> Result<Vec<FileEntry>, String>

#[tauri::command]
async fn read_image_file(path: String) -> Result<ImageData, String>

#[tauri::command]
async fn get_supported_image_types() -> Vec<String>

#[tauri::command]
async fn open_folder_dialog() -> Result<Option<String>, String>

#[tauri::command]
async fn save_session_dialog(session_data: SessionData) -> Result<Option<String>, String>

#[tauri::command]
async fn load_session_dialog() -> Result<Option<SessionData>, String>

#[tauri::command]
async fn save_auto_session(session_data: SessionData) -> Result<(), String>

#[tauri::command]
async fn load_auto_session() -> Result<Option<SessionData>, String>
```

#### Frontend Service (TypeScript)
```typescript
interface FileSystemService {
  browseFolder(path?: string): Promise<FileEntry[]>
  readImageFile(path: string): Promise<ImageData>
  getSupportedImageTypes(): Promise<string[]>
  openFolderDialog(): Promise<string | null>
}

#### SessionService
```typescript
interface SessionService {
  saveSessionDialog(sessionData: SessionData): Promise<string | null> // Returns saved file path
  loadSessionDialog(): Promise<SessionData | null>
  saveAutoSession(sessionData: SessionData): Promise<void>
  loadAutoSession(): Promise<SessionData | null>
}
```

#### ImageManager
```typescript
interface ImageManager {
  openImage(imageData: ImageData): string // returns tab ID
  closeImage(tabId: string): void
  switchToImage(tabId: string): void
  getActiveImage(): ImageData | null
  getAllOpenImages(): Map<string, ImageData>
}
```

#### ZoomController
```typescript
interface ZoomController {
  zoomIn(): void
  zoomOut(): void
  toggleFitMode(): void
  setZoomLevel(level: number): void
  getCurrentZoom(): number
  getFitMode(): 'fit-to-window' | 'actual-size'
}

#### TabManager
```typescript
interface TabManager {
  reorderTabs(fromIndex: number, toIndex: number): void
  calculateTabWidth(tabCount: number, containerWidth: number): number
  getVisibleTabRange(scrollPosition: number, containerWidth: number): { start: number, end: number }
  updateTabOrder(tabId: string, newOrder: number): void
}
```

## Data Models

### ImageData
```typescript
interface ImageData {
  id: string
  name: string
  path: string // File system path
  assetUrl: string // Tauri asset:// URL for direct file serving
  dimensions: {
    width: number
    height: number
  }
  fileSize: number
  lastModified: Date
}
```

### FileEntry
```typescript
interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isImage: boolean
  size?: number
  lastModified?: Date
}
```

### TabData
```typescript
interface TabData {
  id: string
  title: string
  imageData: ImageData
  isActive: boolean
  order: number // For drag-and-drop reordering
}

### SessionData
```typescript
interface SessionData {
  name?: string // Optional for auto-session
  tabs: Array<{
    id: string
    imagePath: string
    order: number
  }>
  activeTabId: string | null
  createdAt: Date
}
```

### ApplicationState
```typescript
interface ApplicationState {
  currentView: 'folder-browser' | 'image-viewer'
  openTabs: Map<string, TabData>
  activeTabId: string | null
  supportedFormats: string[]
}
```

## Error Handling

### File System Errors
- **Permission Denied**: Handle Rust file system permission errors with user-friendly messages
- **File Not Found**: Graceful error handling for moved/deleted files
- **Unsupported Format**: Display clear message listing supported formats
- **Path Errors**: Handle invalid paths and special characters across platforms

### Image Loading Errors
- **Corrupted Files**: Rust-level validation before sending to frontend
- **Large Files**: Implement streaming and progress indicators for large images
- **Encoding Errors**: Handle base64 encoding failures gracefully

### Memory Management
- **Asset URL Management**: Proper cleanup of asset URLs when tabs are closed
- **Rust Memory**: Minimal memory usage as images are served directly from disk
- **Frontend Optimization**: Lazy loading and efficient Vue reactivity

### Session Management Errors
- **Session Save Failures**: Handle file system write errors gracefully
- **Session Load Failures**: Handle corrupted or missing session files
- **Missing Image Files**: Skip tabs for images that no longer exist during session restore
- **Session Name Conflicts**: Handle duplicate session names appropriately

## Testing Strategy

### Unit Tests
- File system service methods
- Image data processing functions
- Zoom calculation logic
- Keyboard shortcut handlers

### Component Tests
- Tab creation and management
- Image display and zoom functionality
- Folder navigation behavior
- Keyboard shortcut integration

### Integration Tests
- End-to-end file opening workflow
- Multi-tab management scenarios
- Cross-platform keyboard shortcut behavior
- Image format support validation

### Platform-Specific Tests
- Native file dialog functionality on Mac and Windows
- Keyboard shortcut compatibility across operating systems
- File path handling across different OS path formats
- Image format support validation

### Tauri Integration Tests
- Frontend-backend IPC communication
- Tauri command error handling
- Application packaging and distribution
- Native system integration features

## Implementation Notes

### Cross-Platform Considerations
- Tauri handles OS detection and native integration automatically
- Use Tauri's path utilities for cross-platform file path handling
- Leverage Tauri's window management for responsive design
- Native keyboard shortcuts through Tauri's global shortcut API

### Performance Optimizations
- Direct image serving through Tauri's asset protocol (no conversion overhead)
- Implement efficient Rust-based directory scanning
- Use Vue's lazy loading for tab content
- Images loaded directly from disk without memory duplication
- Efficient session data serialization/deserialization
- Auto-session saves on application close with minimal overhead
- Virtual scrolling for tab bar when dealing with many tabs
- Efficient drag-and-drop with minimal DOM manipulation

### Accessibility
- Proper ARIA labels for all interactive elements
- Native keyboard navigation through Tauri
- Screen reader compatibility for image metadata
- High contrast mode support through CSS

### Security Considerations
- Tauri's security model with allowlisted commands
- File type validation in Rust backend
- Sanitize file paths and names
- Secure IPC communication between frontend and backend
- No external network access required