# Keyboard Shortcuts Configuration

This directory contains the centralized keyboard shortcuts configuration for the Image Viewer application.

## Files

- `keyboardShortcuts.ts` - The main configuration file containing all keyboard shortcuts
- This is the **single source of truth** for all keyboard shortcuts in the application

## How to Modify Shortcuts

To add, remove, or modify keyboard shortcuts, edit the `KEYBOARD_SHORTCUTS` array in `keyboardShortcuts.ts`.

### Adding a New Shortcut

```typescript
{
  key: 'n',                    // The key to press
  modifiers: { ctrl: true },   // Optional modifiers (ctrl, shift, alt, meta)
  action: 'newAction',         // Action name (must be handled in ImageViewer.vue)
  description: 'Do something'  // Human-readable description
}
```

### Supported Actions

The following actions are currently supported in the ImageViewer component:

- `nextImage` - Navigate to next image in current tab
- `previousImage` - Navigate to previous image in current tab  
- `nextTab` - Switch to next tab
- `previousTab` - Switch to previous tab
- `openImageInNewTab` - Open next image in new tab and switch to it
- `createNewTab` - Open file picker to create new tab
- `closeCurrentTab` - Close the current tab

### Modifiers

- `ctrl` - Ctrl key (Cmd on Mac)
- `shift` - Shift key
- `alt` - Alt key (Option on Mac)
- `meta` - Meta key (Cmd on Mac, Windows key on PC)

## Current Shortcuts

The configuration currently includes:

**Image Navigation:**
- Arrow keys and A/D for navigating images within tabs

**Tab Switching:**
- Ctrl+Tab, Shift+Arrow keys, Shift+A/D for switching between tabs

**Tab Management:**
- Enter to open next image in new tab
- Ctrl+O/Ctrl+T to create new tabs
- Ctrl+W/Escape to close tabs

## Usage in Components

The keyboard shortcuts are automatically handled by the `handleKeyDown` function in `ImageViewer.vue`, which uses the `matchesShortcut` helper function to determine which action to execute.

## Utilities

Helper functions are available in `../utils/shortcutHelpers.ts` for:
- Grouping shortcuts by category
- Formatting shortcuts for display
- Generating help text