# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tauri-based desktop image viewer** application built with Vue 3, TypeScript, and Rust. The application features tabbed image browsing with grouping, lazy loading, session management, advanced memory optimization, and a flexible tab layout system with multiple viewing modes.

**Tech Stack:**
- **Frontend**: Vue 3 (Composition API with `<script setup>`), TypeScript, Vite
- **Backend**: Tauri 2.x, Rust
- **Image Processing**: Rust `image` crate for metadata extraction
- **State Management**: Composables pattern with shared state (transitioning from props/emits to centralized composables)
- **Caching**: SQLite-based persistent metadata cache with LRU eviction

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

# Clear metadata cache
pnpm cache:clear
```

## Code Quality Principles

**CRITICAL: Read this section before making ANY changes to the codebase.**

### 1. Avoid Redundant Implementation
- **ALWAYS search for existing functionality before implementing anything new**
- Check composables, utils, services, and components for reusable code
- If similar logic exists, refactor and reuse it instead of duplicating
- Example: Before adding image loading logic, check if `lazyLoader.ts` or `memoryManager.ts` already handles it

### 2. Delete Clutter and Unnecessary Code
- **Remove unused imports, variables, functions, and components immediately**
- Delete commented-out code blocks (use git history if needed)
- If a feature is removed, delete ALL associated code (components, types, utils)
- Simplify complex conditionals and remove redundant checks

### 3. Extract Logic from Large Files
- **Strive to keep components below 1500 lines**
- **Large component files could indicate missing composables or utils**

### 4. Maintain Cohesive Modules
- Each file should have a **single, clear responsibility**
- Group related functions in the same module
- Use descriptive file and function names that indicate purpose
- Keep related types close to where they're used

## Architecture Overview

### State Management Philosophy

The app uses a **composables-based architecture** with shared state to minimize prop drilling and emit chains. The pattern is:

1. **Composables export shared reactive state** (refs, computed, Maps)
2. **Components import and use composables directly** (minimal props/emits)
3. **State is centralized** in composables for reusability

**Current composables:**
- `useTabControls()` (`src/composables/useTabControls.ts`) - Manages all tab state, groups, layout preferences, and operations

**When to create a new composable:**
- When state needs to be shared across multiple components
- When component logic exceeds ~100 lines and can be extracted
- When the same logic pattern is duplicated in 2+ places

### Frontend-Backend Communication

The app uses **Tauri commands** for all frontend-backend communication via `invoke()`:

```typescript
// Example: Opening an image file
const imageData = await invoke<any>('read_image_file', { path: selectedPath })
```

**Key Tauri commands** (defined in `src-tauri/src/lib.rs`):
- `browse_folder` - List files in a directory (with pagination support)
- `read_image_file` - Load image with metadata (dimensions, file size) - uses metadata cache
- `open_image_dialog` / `open_folder_dialog` - Native file pickers
- `save_session_dialog` / `load_session_dialog` - Session persistence with groups
- `save_auto_session` / `load_auto_session` - Auto-save on app close
- `get_supported_image_types` - Supported formats list

### Data Flow Architecture

1. **User opens image** → Native file dialog (Rust) → Returns file path
2. **Load image metadata** → Rust checks SQLite cache → If miss, reads image dimensions/size → Returns `ImageData`
3. **Load folder context** → Rust reads directory → Returns `FileEntry[]` (with pagination for large folders)
4. **Lazy loading** → Frontend caches metadata in `FolderContext.loadedImages` Map
5. **Display image** → Convert path to Tauri asset URL via `convertFileSrc()`

### Memory Management Strategy

The app implements **lazy loading** and **persistent caching** to handle large image folders efficiently:

- **FolderContext** (`src/types/index.ts:45-49`): Contains lightweight `FileEntry[]` list and a `loadedImages` Map
- Only **±2 images** around current image are preloaded (metadata + browser cache)
- **MemoryManager** (`src/utils/memoryManager.ts`): Tracks image cache, performs cleanup when memory usage > 80%
- **LazyImageLoader** (`src/utils/lazyLoader.ts`): Handles browser-level image preloading with priority queues
- **MetadataCache** (`src-tauri/src/metadata_cache.rs`): SQLite-backed persistent cache with LRU eviction (stores image dimensions to avoid re-reading)

**When navigating folders:**
- File list is loaded immediately (cheap)
- Image metadata loaded on-demand as user navigates
- Metadata cache is checked first to avoid disk I/O
- Browser preloads adjacent images for smooth navigation

### Tab Management

Tabs are managed via the `useTabControls()` composable with shared state:

```typescript
const {
  tabs,                    // Map<string, TabData> - All open tabs
  activeTabId,             // string | null - Current tab
  tabFolderContexts,       // Map<string, FolderContext> - Folder data per tab
  tabGroups,               // Map<string, TabGroup> - Tab groups
  selectedGroupId,         // string | null - Selected group (for grid view)
  // ... methods for tab operations
} = useTabControls()
```

Each tab maintains its own `FolderContext`, allowing independent navigation within folder contents. Tabs can be organized into **groups** with visual indicators.

### Tab Groups

Tab groups allow organizing related tabs together:

- **Two visual layouts**: Tree view (indented) and top bar (colored borders)
- **Group operations**: Create, rename, dissolve, merge groups
- **Smart reordering**: Move tabs within groups or swap entire groups
- **Group grid view**: When group header is selected, shows all images in a grid with reordering controls
- **Auto-dissolution**: Groups with ≤1 tab are automatically dissolved
- **Colors**: Alternating blue/orange colors for visual distinction

### Tab Layout System

The app supports **three layout modes** for the tab bar:

1. **Tree Layout** (`layoutPosition: 'tree'`)
   - Vertical sidebar on the left
   - Shows group headers with collapse/expand
   - Tabs indented under groups
   - Collapsible to icon-only mode
   - Supports small (20px) and large (200px) thumbnail sizes

2. **Top Layout** (`layoutPosition: 'top'`)
   - Horizontal tab bar at the top
   - Group membership shown via colored top borders
   - Supports small (20px) and large (200px preview) modes

3. **Invisible Layout** (`layoutPosition: 'invisible'`)
   - Hides tab bar completely
   - Shows only floating controls in top-right corner
   - Maximizes image viewing area

Layout state is managed in `useTabControls()` and persisted in sessions.

### Session Persistence

Sessions save/restore open tabs, groups, and their positions:

- **Auto-session**: Saved on app close to `~/Library/Application Support/image-viewer/auto-session.json` (macOS)
- **Manual session**: User can save/load via File menu to custom location
- Sessions store:
  - Image paths and tab order
  - Tab groups (IDs, names, colors, tab membership)
  - Zoom level and fit mode per tab
  - Pan offset for actual-size mode
  - Layout preferences (position, size, tree collapsed state)

Session management is handled via `sessionService` (`src/services/sessionService.ts`).

**⚠️ CRITICAL: Frontend-Backend Serialization Sync**
- When changing session data types in TypeScript (`src/types/index.ts`), **ALWAYS update Rust structs** in `src-tauri/src/lib.rs`
- Both `SessionData` and `TabGroup` must have matching fields with matching serde attributes

## Component Structure

**Main App Flow:**
1. `App.vue` - Root component, handles Tauri event listeners, session restoration
2. `ImageViewer.vue` - Core viewer with image display, zoom/pan, navigation, keyboard shortcuts
3. `TabBar.vue` - Tab bar component supporting tree/top/invisible layouts with context menus
4. `GroupGridPreview.vue` - Grid view for group contents with reorder controls
5. `LoadingIndicator.vue` - Fullscreen loading overlay

**Component Responsibilities:**

- **App.vue**: Application lifecycle, session auto-save, open image requests
- **ImageViewer.vue**: Image rendering, zoom/pan, keyboard shortcuts, integrates TabBar and GroupGridPreview
- **TabBar.vue**: Tab/group rendering, drag/drop, context menus, layout switching
- **GroupGridPreview.vue**: Grid display of group images, inline renaming, reordering UI

### Composables Pattern

**useTabControls** (`src/composables/useTabControls.ts`):
- Exports shared state (tabs, groups, layout preferences)
- Provides methods for all tab operations (open, close, switch, reorder)
- Provides methods for all group operations (create, rename, dissolve, merge, move)
- Manages context menu state and actions
- **Usage**: Import and destructure needed state/methods in components

```typescript
// Example usage in a component
import { useTabControls } from '../composables/useTabControls'

const {
  tabs,
  activeTabId,
  sortedTabs,
  openTab,
  closeTab,
  createGroup,
  moveTab
} = useTabControls()
```

This pattern eliminates the need to pass tab state via props or coordinate updates via emits.

## Keyboard Shortcuts

Shortcuts are centralized in `src/config/keyboardShortcuts.ts`:

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
2. Load selected image metadata immediately (check cache first)
3. Load ±2 adjacent images in parallel
4. As user navigates, load next/prev images on-demand
5. Preload upcoming images in background with low priority

See `App.vue:handleOpenImageRequest()` and `ImageViewer.vue:loadImageMetadata()`.

### Metadata Caching

The Rust backend maintains a SQLite cache (`src-tauri/src/metadata_cache.rs`):
- Stores image dimensions, file size, and last modified timestamp
- LRU eviction when cache exceeds max entries (default 10,000)
- Validates cache entries against file modification time
- Persists across app restarts
- Significantly improves performance for large folders

### Session Restoration

On app startup (`App.vue:onMounted`):
1. Load auto-session from disk
2. For each saved tab, verify image file still exists
3. Re-create tabs with stored image paths
4. Restore tab groups (with names, colors, membership)
5. Load folder context for each tab
6. Restore active tab and layout preferences

This happens after a 200ms delay to ensure components are mounted.

### Group Grid View

When a group header is selected (via tree view):
- `selectedGroupId` is set, `activeTabId` is cleared
- `ImageViewer.vue` displays `GroupGridPreview` component
- Grid shows all images in the group with thumbnails
- User can click to select, double-click to activate tab
- Reorder controls appear when image is selected
- Group name is editable inline

### Type Definitions

All core types are in `src/types/index.ts`:
- `ImageData` - Image with metadata
- `FileEntry` - Lightweight file list entry
- `FolderContext` - Folder with lazy-loaded images Map
- `VirtualFolderContext` - Extended context with pagination support
- `TabData` - Tab with image, group membership, and view state
- `TabGroup` - Group with name, color, tab IDs, order
- `SessionData` - Serializable session state with groups

### Rust Backend Notes

- Uses `image` crate to read dimensions without loading full image
- `browse_folder` filters and sorts entries (directories first, then alphabetical)
- Supports pagination for very large folders (via `PaginatedFolderResult`)
- Session files stored in platform-specific app data directory via `dirs::data_dir()`
- All commands are `async` and return `Result<T, String>` for error handling
- Metadata cache uses `rusqlite` with WAL mode for concurrent access

## Development Workflow

**BEFORE implementing ANY feature, follow this checklist:**

1. **Search for existing solutions** (5 minutes can save hours of duplicate work):
   - Use Grep to search for similar function names, keywords, or patterns
   - Check `src/composables/`, `src/utils/`, and `src/services/` for reusable code
   - Review `src/types/index.ts` for existing type definitions
   - Look for TODO comments or incomplete implementations

2. **Plan extraction and cleanup**:
   - Identify what can be reused vs. what's truly new
   - If a component will exceed ~300 lines, plan to extract logic into composables/utils
   - List any dead code that should be removed alongside your changes

3. **Implement with minimal duplication**:
   - Refactor existing code if it's close to what you need
   - Create small, focused functions/composables rather than large monolithic ones
   - Delete unused code as you go, not as an afterthought

4. **Clean up immediately**:
   - Remove unused imports (TypeScript will warn you)
   - Delete any commented-out code
   - Remove debug console.logs
   - Simplify complex conditionals

## Common Development Patterns

**Adding a new Tauri command:**
1. **Search first**: Check if a similar command exists in `src-tauri/src/lib.rs`
2. Define function with `#[tauri::command]` attribute
3. Add to `invoke_handler!` in `run()` function
4. Call from frontend with `invoke<ReturnType>('command_name', { params })`

**Adding a keyboard shortcut:**
1. **Search first**: Check `src/config/keyboardShortcuts.ts` for conflicts
2. Add entry to `keyboardShortcuts.ts`
3. Implement action in `ImageViewer.vue:handleKeyDown()` switch statement
4. No need to modify multiple files - single source of truth

**Creating a new composable:**
1. **Check first**: Does similar state/logic exist in another composable?
2. If yes, extend existing composable; if no, create new file in `src/composables/`
3. Export shared reactive state at module level (outside function)
4. Export composable function that returns state + methods
5. Keep focused - if composable handles >3 concerns, split it
6. **Pattern**: Centralize state to avoid prop drilling

**Adding tab/group functionality:**
1. **Always check `useTabControls()` first** - don't duplicate tab logic
2. Add method to `useTabControls()` composable
3. Expose method in composable's return object
4. Use method directly in components (no emit chains needed)

**Extracting logic from large components:**
1. **Trigger**: Component exceeds ~300 lines or has multiple concerns
2. **UI rendering** → keep in component
3. **State management** → extract to composable (e.g., `useZoomPan.ts`)
4. **Calculations/transforms** → extract to utils (e.g., `imageUtils.ts`)
5. **Business logic** → extract to services (e.g., `sessionService.ts`)
6. **Example**: If `ImageViewer.vue` handles zoom/pan in 100+ lines, create `useZoomPan()` composable

**Memory optimization:**
- Keep `fileEntries` as lightweight objects (no full ImageData)
- Only populate `loadedImages` Map as needed
- Clean up tab resources in `cleanupTabResources()` when closing tabs
- Use `memoryManager.removeCachedImage()` to free browser cache

## Testing the Application

Since there are no automated tests, verify functionality manually:

1. **Open image** - File dialog works, image displays
2. **Navigate folder** - Arrow keys cycle through images, cache is hit on revisit
3. **Multiple tabs** - Open several images, switch between them
4. **Tab groups** - Create groups, rename, dissolve, merge, reorder
5. **Layout switching** - Toggle between tree/top/invisible layouts
6. **Tree collapse** - Collapse groups in tree view, collapse entire tree to icons
7. **Group grid view** - Select group header, view grid, reorder images
8. **Session save/restore** - Close app, verify tabs and groups restore on reopen
9. **Memory usage** - Open folder with 100+ images, check RAM usage stays reasonable
10. **Zoom/pan** - Mouse wheel zoom, drag to pan in actual-size mode
11. **Keyboard shortcuts** - Test all shortcut combinations
12. **Corrupted images** - Open corrupted file, verify placeholder displays
13. **Cross-platform paths** - Test on both macOS and Windows if possible

## Project Structure

```
image-manager/
├── src/
│   ├── components/
│   │   ├── App.vue                  # Root component
│   │   ├── ImageViewer.vue          # Main viewer with zoom/pan
│   │   ├── TabBar.vue               # Tab bar with tree/top/invisible layouts
│   │   ├── GroupGridPreview.vue     # Grid view for group contents
│   │   └── LoadingIndicator.vue     # Loading overlay
│   ├── composables/
│   │   └── useTabControls.ts        # Shared tab/group state and operations
│   ├── config/
│   │   └── keyboardShortcuts.ts     # Centralized keyboard shortcuts
│   ├── services/
│   │   ├── interfaces.ts            # Service interface definitions
│   │   └── sessionService.ts        # Session save/load implementation
│   ├── types/
│   │   ├── index.ts                 # Core type definitions
│   │   └── services.ts              # Service-related types
│   ├── utils/
│   │   ├── lazyLoader.ts            # Image preloading with priority
│   │   ├── memoryManager.ts         # Memory cleanup and tracking
│   │   └── shortcutHelpers.ts       # Keyboard shortcut utilities
│   └── main.ts                      # Vue app entry point
├── src-tauri/
│   └── src/
│       ├── lib.rs                   # Tauri commands and app setup
│       ├── main.rs                  # Tauri app entry point
│       └── metadata_cache.rs        # SQLite metadata cache
└── CLAUDE.md                        # This file
```