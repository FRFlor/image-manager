# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tauri-based desktop image viewer** application built with Vue 3, TypeScript, and Rust. The application features tabbed image browsing, lazy loading, session management, and advanced memory optimization.

**Tech Stack:**
- **Frontend**: Vue 3 (Composition API with `<script setup>`), TypeScript, Vite
- **Backend**: Tauri 2.x, Rust
- **Image Processing**: Rust `image` crate for metadata extraction
- **State Management**: Vue reactive refs and Maps (no Vuex/Pinia)

## Development Commands

```bash
# Development (runs both Vite dev server and Tauri)
pnpm tauri:dev

# Build for production
pnpm tauri:build

# Frontend only (for UI testing without Tauri)
pnpm dev

# TypeScript compilation check
pnpm build
```

## Architecture Overview

### Frontend-Backend Communication

The app uses **Tauri commands** for all frontend-backend communication via `invoke()`:

```typescript
// Example: Opening an image file
const imageData = await invoke<any>('read_image_file', { path: selectedPath })
```

**Key Tauri commands** (defined in `src-tauri/src/lib.rs`):
- `browse_folder` - List files in a directory
- `read_image_file` - Load image with metadata (dimensions, file size)
- `open_image_dialog` / `open_folder_dialog` - Native file pickers
- `save_session_dialog` / `load_session_dialog` - Session persistence
- `save_auto_session` / `load_auto_session` - Auto-save on app close
- `get_supported_image_types` - Supported formats list

### Data Flow Architecture

1. **User opens image** → Native file dialog (Rust) → Returns file path
2. **Load image metadata** → Rust reads image dimensions/size → Returns `ImageData`
3. **Load folder context** → Rust reads directory → Returns `FileEntry[]`
4. **Lazy loading** → Frontend caches metadata in `FolderContext.loadedImages` Map
5. **Display image** → Convert path to Tauri asset URL via `convertFileSrc()`

### Memory Management Strategy

The app implements **lazy loading** to handle large image folders efficiently:

- **FolderContext** (`src/types/index.ts:34-38`): Contains lightweight `FileEntry[]` list and a `loadedImages` Map
- Only **±2 images** around current image are preloaded (metadata + browser cache)
- **MemoryManager** (`src/utils/memoryManager.ts`): Tracks image cache, performs cleanup when memory usage > 80%
- **LazyImageLoader** (`src/utils/lazyLoader.ts`): Handles browser-level image preloading with priority queues

**When navigating folders:**
- File list is loaded immediately (cheap)
- Image metadata loaded on-demand as user navigates
- Browser preloads adjacent images for smooth navigation

### Tab Management

Tabs are managed in `ImageViewer.vue` with the following state:

```typescript
tabs: Map<string, TabData>           // All open tabs
activeTabId: string | null           // Current tab
tabFolderContexts: Map<string, FolderContext>  // Folder data per tab
```

Each tab maintains its own `FolderContext`, allowing independent navigation within folder contents.

### Session Persistence

Sessions save/restore open tabs and their positions:

- **Auto-session**: Saved on app close to `~/Library/Application Support/image-viewer/auto-session.json` (macOS)
- **Manual session**: User can save/load via File menu to custom location
- Sessions store only **image paths** and tab order, not full metadata

## Component Structure

**Main App Flow:**
1. `App.vue` - Root component, handles Tauri event listeners, session restoration
2. `ImageViewer.vue` - Core viewer with tab management, zoom/pan, navigation
3. `LoadingIndicator.vue` - Fullscreen loading overlay

**ImageViewer.vue** is the heart of the app (~1400 lines):
- Tab management and switching
- Image navigation (prev/next within folder)
- Zoom and pan controls
- Lazy loading orchestration
- Keyboard shortcuts handling
- Session save/restore logic

## Keyboard Shortcuts

Shortcuts are centralized in `src/config/keyboardShortcuts.ts`:

**Image Navigation:**
- `←` / `→` or `A` / `D` - Previous/Next image in folder
- `Shift + ←` / `→` - Switch tabs
- `Enter` - Open next image in new tab

**Tab Management:**
- `Ctrl/Cmd + T` - New tab
- `Ctrl/Cmd + W` or `Esc` - Close tab
- `Alt + ←` / `→` - Reorder tabs

**Zoom:**
- `Ctrl/Cmd + +/-` - Zoom in/out
- `Ctrl/Cmd + 0` - Reset zoom
- `Ctrl/Cmd + /` - Toggle fit mode
- Mouse wheel - Zoom

## File System Paths

**Image Loading:**
- Rust receives absolute file system paths (e.g., `/Users/foo/image.jpg`)
- Frontend converts to Tauri asset URLs via `convertFileSrc(path)` → `asset://localhost/...`
- Asset protocol is enabled in `src-tauri/tauri.conf.json` with scope `["**"]`

**Path Handling:**
- Cross-platform path separators handled in Rust and frontend
- Use `path.replace("\\", "/")` when building asset URLs
- Use `Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))` to find directory separator

## Important Implementation Details

### Lazy Loading Implementation

When opening an image from folder:
1. Load all file entries (lightweight, just names/paths)
2. Load selected image metadata immediately
3. Load ±2 adjacent images in parallel
4. As user navigates, load next/prev images on-demand
5. Preload upcoming images in background with low priority

See `App.vue:handleOpenImageRequest()` and `ImageViewer.vue:loadImageMetadata()`.

### Session Restoration

On app startup (`App.vue:onMounted`):
1. Load auto-session from disk
2. For each saved tab, verify image file still exists
3. Re-create tabs with stored image paths
4. Load folder context for each tab
5. Restore active tab

This happens after a 200ms delay to ensure components are mounted.

### Type Definitions

All core types are in `src/types/index.ts`:
- `ImageData` - Image with metadata
- `FileEntry` - Lightweight file list entry
- `FolderContext` - Folder with lazy-loaded images Map
- `TabData` - Tab with image and state
- `SessionData` - Serializable session state

### Rust Backend Notes

- Uses `image` crate to read dimensions without loading full image
- `browse_folder` filters and sorts entries (directories first, then alphabetical)
- Session files stored in platform-specific app data directory via `dirs::data_dir()`
- All commands are `async` and return `Result<T, String>` for error handling

## Common Development Patterns

**Adding a new Tauri command:**
1. Define function in `src-tauri/src/lib.rs` with `#[tauri::command]`
2. Add to `invoke_handler!` in `run()` function
3. Call from frontend with `invoke<ReturnType>('command_name', { params })`

**Adding a keyboard shortcut:**
1. Add entry to `src/config/keyboardShortcuts.ts`
2. Implement action in `ImageViewer.vue:handleKeyDown()` switch statement
3. No need to modify multiple files - single source of truth

**Memory optimization:**
- Keep `fileEntries` as lightweight objects (no full ImageData)
- Only populate `loadedImages` Map as needed
- Clean up tab resources in `cleanupTabResources()` when closing tabs
- Use `memoryManager.removeCachedImage()` to free browser cache

## Testing the Application

Since there are no automated tests, verify functionality manually:

1. **Open image** - File dialog works, image displays
2. **Navigate folder** - Arrow keys cycle through images
3. **Multiple tabs** - Open several images, switch between them
4. **Session save/restore** - Close app, verify tabs restore on reopen
5. **Memory usage** - Open folder with 100+ images, check RAM usage stays reasonable
6. **Zoom/pan** - Mouse wheel zoom, drag to pan in actual-size mode
7. **Cross-platform paths** - Test on both macOS and Windows if possible
