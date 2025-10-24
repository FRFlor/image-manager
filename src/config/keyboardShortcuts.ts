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
    key: 't',
    modifiers: { ctrl: true },
    action: 'createNewTab',
    description: 'Create new tab'
  },
  {
    key: 'w',
    modifiers: { ctrl: true },
    action: 'closeCurrentTab',
    description: 'Close current tab'
  },
  {
    key: 'Escape',
    action: 'closeCurrentTab',
    description: 'Close current tab'
  },

  // Tab Reordering
  {
    key: 'ArrowRight',
    modifiers: { alt: true },
    action: 'moveTabRight',
    description: 'Move current tab to the right'
  },
  {
    key: 'ArrowLeft',
    modifiers: { alt: true },
    action: 'moveTabLeft',
    description: 'Move current tab to the left'
  },
  {
    key: 'd',
    modifiers: { alt: true },
    action: 'moveTabRight',
    description: 'Move current tab to the right (gaming style)'
  },
  {
    key: 'a',
    modifiers: { alt: true },
    action: 'moveTabLeft',
    description: 'Move current tab to the left (gaming style)'
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