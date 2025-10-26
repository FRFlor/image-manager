# Dynamic Menu Updates

This document explains how the application updates menu items dynamically at runtime.

## Overview

The application now supports **dynamic menu updates**, specifically for the "Recent Saved Sessions" submenu. The menu automatically updates when:

1. A user saves a new session via the file dialog
2. A user loads a session from a file path
3. The frontend explicitly requests a menu refresh

## How It Works

### Backend (Rust)

**Helper Functions:**
- `build_recent_sessions_submenu()` - Builds the recent sessions submenu from a list of session paths
- `update_recent_sessions_menu()` - Rebuilds the entire menu with updated recent sessions

**Tauri Commands:**
- `refresh_recent_sessions_menu` - Can be called from frontend to manually refresh the menu
- `save_session_dialog` - Automatically updates menu after saving
- `load_session_from_path` - Automatically updates menu after loading

**Location:** `src-tauri/src/lib.rs:719-782`

### Frontend (TypeScript)

**SessionService Method:**
```typescript
async refreshRecentSessionsMenu(): Promise<void>
```

**Usage Example:**
```typescript
import { sessionService } from './services/sessionService'

// Manually refresh the menu (if needed)
await sessionService.refreshRecentSessionsMenu()
```

**Location:** `src/services/sessionService.ts:69-80`

## Automatic Updates

The menu is automatically updated in the following scenarios:

### 1. When Saving a Session
When a user saves a session via "File > Save Session", the session path is:
1. Added to the recent sessions list (moved to top if already exists)
2. Persisted to disk
3. **Menu is automatically rebuilt** to show the updated list

### 2. When Loading a Session from Path
When a session is loaded (either from the "Recent Saved Sessions" menu or via direct path):
1. The session path is moved to the top of the recent list
2. The list is persisted to disk
3. **Menu is automatically rebuilt** to reflect the new order

### 3. Manual Refresh (Optional)
If needed, the frontend can manually trigger a menu refresh:

```typescript
await sessionService.refreshRecentSessionsMenu()
```

## Technical Details

### Menu Rebuilding Process

1. Get current recent sessions from app state
2. Build new "Recent Saved Sessions" submenu with current list
3. Rebuild "File" menu with new submenu
4. Rebuild "View" menu (unchanged)
5. Call `app.set_menu()` to replace the entire menu

**Note:** Tauri requires rebuilding the entire menu structure to update a submenu. Individual menu items cannot be updated in isolation.

### Recent Sessions Limit

The recent sessions list is limited to **10 items** (most recent first). When an 11th session is added, the oldest is automatically removed.

## Menu Structure

```
File
├── Save Session
├── Load Session
├── Recent Saved Sessions
│   ├── Last Autosaved Session
│   ├── ───────────────────────
│   ├── session-1.session.json
│   ├── session-2.session.json
│   └── ... (up to 10 items)
├── ───────────────────────
└── Close Window

View
└── Toggle Controls
```

## Future Enhancements

Possible improvements:
- Add keyboard shortcuts for recent sessions (⌘1-9)
- Show session metadata (date created, number of tabs) in menu
- Add "Clear Recent Sessions" option
- Update other menu items dynamically (e.g., toggle states)
