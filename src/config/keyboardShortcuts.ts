// Keyboard shortcuts configuration for the Image Viewer
// This is the single source of truth for all keyboard shortcuts

export interface KeyboardShortcut {
  key: string
  modifiers?: {
    ctrl?: boolean
    shift?: boolean
    alt?: boolean
    meta?: boolean
  }
  action: string
  description: string
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Image Navigation (within current tab)
  {
    key: 'ArrowRight',
    action: 'nextImage',
    description: 'Next image in current tab'
  },
  {
    key: 'ArrowLeft',
    action: 'previousImage',
    description: 'Previous image in current tab'
  },
  {
    key: 'd',
    action: 'nextImage',
    description: 'Next image in current tab (gaming style)'
  },
  {
    key: 'a',
    action: 'previousImage',
    description: 'Previous image in current tab (gaming style)'
  },

  // Tab Management
  {
    key: 'Tab',
    modifiers: { ctrl: true },
    action: 'nextTab',
    description: 'Switch to next tab'
  },
  {
    key: 'Tab',
    modifiers: { ctrl: true, shift: true },
    action: 'previousTab',
    description: 'Switch to previous tab'
  },
  {
    key: 'ArrowRight',
    modifiers: { shift: true },
    action: 'nextTab',
    description: 'Switch to next tab'
  },
  {
    key: 'ArrowLeft',
    modifiers: { shift: true },
    action: 'previousTab',
    description: 'Switch to previous tab'
  },
  {
    key: 'd',
    modifiers: { shift: true },
    action: 'nextTab',
    description: 'Switch to next tab (gaming style)'
  },
  {
    key: 'a',
    modifiers: { shift: true },
    action: 'previousTab',
    description: 'Switch to previous tab (gaming style)'
  },

  // Tab Creation and Management
  {
    key: 'Enter',
    action: 'openImageInNewTab',
    description: 'Open next image in new tab and switch to it'
  },
  {
    key: 'o',
    modifiers: { ctrl: true },
    action: 'createNewTab',
    description: 'Open new tab (file picker)'
  },
  {
    key: 'f',
    modifiers: { ctrl: true },
    action: 'toggleFavourite',
    description: 'Toggle favourite for current image (Ctrl+F)'
  },
  {
    key: 'f',
    modifiers: { meta: true },
    action: 'toggleFavourite',
    description: 'Toggle favourite for current image (Cmd+F)'
  },
  {
    key: 't',
    modifiers: { ctrl: true },
    action: 'createNewTab',
    description: 'Create new tab'
  },
  {
    key: 'w',
    modifiers: { ctrl: true },
    action: 'closeCurrentTab',
    description: 'Close current tab (Ctrl+W)'
  },
  {
    key: 'w',
    modifiers: { meta: true },
    action: 'closeCurrentTab',
    description: 'Close current tab (Cmd+W)'
  },
  {
    key: 'Escape',
    action: 'closeCurrentTab',
    description: 'Close current tab'
  },

  // Tab Reordering (Smart: swap with tabs/groups, or move within group)
  {
    key: 'ArrowRight',
    modifiers: { alt: true },
    action: 'moveTabRight',
    description: 'Move tab/group right (smart reorder)'
  },
  {
    key: 'ArrowLeft',
    modifiers: { alt: true },
    action: 'moveTabLeft',
    description: 'Move tab/group left (smart reorder)'
  },
  {
    key: 'ArrowDown',
    action: 'moveTabRight',
    description: 'Move tab/group right (smart reorder)'
  },
  {
    key: 'ArrowUp',
    action: 'moveTabLeft',
    description: 'Move tab/group left (smart reorder)'
  },
  {
    key: 'd',
    modifiers: { alt: true },
    action: 'moveTabRight',
    description: 'Move tab/group right (gaming style)'
  },
  {
    key: 'a',
    modifiers: { alt: true },
    action: 'moveTabLeft',
    description: 'Move tab/group left (gaming style)'
  },
  {
    key: 's',
    modifiers: { alt: true },
    action: 'moveTabRight',
    description: 'Move tab/group right (gaming style)'
  },
  {
    key: 'w',
    modifiers: { alt: true },
    action: 'moveTabLeft',
    description: 'Move tab/group left (gaming style)'
  },

  // Tab Grouping (Ctrl+Left/Right to join tabs into groups)
  {
    key: 'ArrowLeft',
    modifiers: { ctrl: true },
    action: 'joinWithLeft',
    description: 'Join with left tab/group or merge into group'
  },
  {
    key: 'ArrowRight',
    modifiers: { ctrl: true },
    action: 'joinWithRight',
    description: 'Join with right tab/group or merge into group'
  },
  {
    key: 'a',
    modifiers: { ctrl: true },
    action: 'joinWithLeft',
    description: 'Join with left tab/group (gaming style)'
  },
  {
    key: 'd',
    modifiers: { ctrl: true },
    action: 'joinWithRight',
    description: 'Join with right tab/group (gaming style)'
  },
  {
    key: ',', // <
    action: 'joinWithLeft',
    description: 'Join with left tab/group'
  },
  {
    key: '.', // >
    action: 'joinWithRight',
    description: 'Join with right tab/group'
  },

  // Zoom and Pan Controls (Windows/Linux)
  {
    key: '=',
    modifiers: { ctrl: true },
    action: 'zoomIn',
    description: 'Zoom in (Ctrl +)'
  },
  {
    key: '+',
    modifiers: { ctrl: true },
    action: 'zoomIn',
    description: 'Zoom in (Ctrl +)'
  },
  {
    key: '-',
    modifiers: { ctrl: true },
    action: 'zoomOut',
    description: 'Zoom out (Ctrl -)'
  },
  {
    key: '0',
    modifiers: { ctrl: true },
    action: 'resetZoom',
    description: 'Reset zoom to fit window (Ctrl 0)'
  },
  {
    key: '/',
    modifiers: { ctrl: true },
    action: 'toggleFitMode',
    description: 'Toggle fit modes (Ctrl /)'
  },

  // Zoom and Pan Controls (Mac)
  {
    key: '=',
    modifiers: { meta: true },
    action: 'zoomIn',
    description: 'Zoom in (Cmd +)'
  },
  {
    key: '+',
    modifiers: { meta: true },
    action: 'zoomIn',
    description: 'Zoom in (Cmd +)'
  },
  {
    key: '-',
    modifiers: { meta: true },
    action: 'zoomOut',
    description: 'Zoom out (Cmd -)'
  },
  {
    key: '0',
    modifiers: { meta: true },
    action: 'resetZoom',
    description: 'Reset zoom to fit window (Cmd 0)'
  },
  {
    key: '/',
    modifiers: { meta: true },
    action: 'toggleFitMode',
    description: 'Toggle fit modes (Cmd /)'
  },

  // Fullscreen Mode
  {
    key: 'Enter',
    modifiers: { meta: true },
    action: 'toggleFullscreen',
    description: 'Toggle fullscreen mode (F11)'
  },
  {
    key: 'Enter',
    modifiers: { ctrl: true },
    action: 'toggleFullscreen',
    description: 'Toggle fullscreen mode (F11)'
  },

  // Session Management (for testing)
  {
    key: 's',
    modifiers: { ctrl: true, shift: true },
    action: 'saveAutoSession',
    description: 'Manually save auto-session (for testing)'
  },
  {
    key: 's',
    modifiers: { meta: true, shift: true },
    action: 'saveAutoSession',
    description: 'Manually save auto-session (for testing - Mac)'
  }
]

// Helper function to check if a keyboard event matches a shortcut
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  // Check if the key matches (case insensitive)
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false
  }

  // Check modifiers
  const modifiers = shortcut.modifiers || {}

  return (
      (!!event.ctrlKey === !!modifiers.ctrl) &&
      (!!event.shiftKey === !!modifiers.shift) &&
      (!!event.altKey === !!modifiers.alt) &&
      (!!event.metaKey === !!modifiers.meta)
  )
}

// Helper function to get shortcut by action
export function getShortcutsByAction(action: string): KeyboardShortcut[] {
  return KEYBOARD_SHORTCUTS.filter(shortcut => shortcut.action === action)
}

// Helper function to format shortcut for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []

  if (shortcut.modifiers?.ctrl) parts.push('Ctrl')
  if (shortcut.modifiers?.shift) parts.push('Shift')
  if (shortcut.modifiers?.alt) parts.push('Alt')
  if (shortcut.modifiers?.meta) parts.push('Cmd')

  // Format key name for display
  let keyName = shortcut.key
  if (keyName.startsWith('Arrow')) {
    keyName = keyName.replace('Arrow', '') + ' Arrow'
  }

  parts.push(keyName)

  return parts.join(' + ')
}
