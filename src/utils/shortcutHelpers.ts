// Utility functions for working with keyboard shortcuts

import { KEYBOARD_SHORTCUTS, formatShortcut, type KeyboardShortcut } from '../config/keyboardShortcuts'

// Group shortcuts by category for display
export interface ShortcutCategory {
    name: string
    shortcuts: KeyboardShortcut[]
}

export function getShortcutsByCategory(): ShortcutCategory[] {
    return [
        {
            name: 'Image Navigation',
            shortcuts: KEYBOARD_SHORTCUTS.filter(s =>
                s.action === 'nextImage' || s.action === 'previousImage'
            )
        },
        {
            name: 'Tab Switching',
            shortcuts: KEYBOARD_SHORTCUTS.filter(s =>
                s.action === 'nextTab' || s.action === 'previousTab'
            )
        },
        {
            name: 'Tab Management',
            shortcuts: KEYBOARD_SHORTCUTS.filter(s =>
                s.action === 'openImageInNewTab' ||
                s.action === 'createNewTab' ||
                s.action === 'closeCurrentTab'
            )
        }
    ]
}

// Generate a help text for all shortcuts
export function generateShortcutHelpText(): string {
    const categories = getShortcutsByCategory()

    return categories.map(category => {
        const shortcutList = category.shortcuts
            .map(shortcut => `  ${formatShortcut(shortcut)}: ${shortcut.description}`)
            .join('\n')

        return `${category.name}:\n${shortcutList}`
    }).join('\n\n')
}

// Get all shortcuts for a specific action (useful for showing multiple ways to do the same thing)
export function getShortcutsForAction(action: string): string[] {
    return KEYBOARD_SHORTCUTS
        .filter(shortcut => shortcut.action === action)
        .map(shortcut => formatShortcut(shortcut))
}