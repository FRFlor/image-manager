import { readonly, ref } from 'vue'
import { KEYBOARD_SHORTCUTS, matchesShortcut } from '../config/keyboardShortcuts'
import {useZoomControls} from "./useZoomControls.ts"

export type ShortcutContext = 'default' | 'image-pan'

const context = ref<ShortcutContext>('default')

// Navigation throttling state
const lastKeyPressTime = ref(0)
const KEY_REPEAT_THRESHOLD = 50 // ms - minimum time between key presses
const KEYBOARD_PAN_STEP: number = 40
const KEYBOARD_SHORTCUT_THROTTLE = 30 // ms - minimum time between shortcut handling
const lastShortcutHandleTime = ref(0)

export interface KeyboardActions {
  // Image navigation
  nextImage: () => void
  previousImage: () => void

  // Tab management
  nextTab: () => void
  previousTab: () => void
  openImageInNewTab: () => void
  createNewTab: () => void
  closeCurrentTab: () => void

  // Tab reordering
  moveTabRight: () => void
  moveTabLeft: () => void

  // Tab groupingmmm
  joinWithLeft: () => void
  joinWithRight: () => void

  // Favourites management
  toggleFavourite: () => void

  // Zoom controls
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  toggleFitMode: () => void

  // Session management
  saveAutoSession: () => void

  // Keyboard panning
  panImageBy: (deltaX: number, deltaY: number) => void
}

export function useShortcutContext(actions?: KeyboardActions) {
  const {isZoomLocked} = useZoomControls()

  const setShortcutContext = (value: ShortcutContext) => {
    context.value = value
  }

  const resetShortcutContext = () => {
    context.value = 'default'
  }

  /**
   * Handle keyboard panning with arrow keys
   * Returns true if the event was handled as a pan action
   */
  const tryHandleKeyboardPan = (event: KeyboardEvent): boolean => {
    console.log("Attempting to handle keyboard pan:")
    if (context.value !== 'image-pan' || isZoomLocked.value) {
      console.log("Keyboard pan rejected: ", {shortcutContext: context.value, isZoomLocked: isZoomLocked.value})
      resetShortcutContext()
      return false
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      console.log("Keyboard pan rejected due to modifier key pressed")
      return false
    }

    if (!actions) return false

    let deltaX = 0
    let deltaY = 0

    switch (event.key) {
      case 'ArrowUp':
      case 'w':
        deltaY = KEYBOARD_PAN_STEP
        break
      case 'ArrowDown':
      case 's':
        deltaY = -KEYBOARD_PAN_STEP
        break
      case 'ArrowLeft':
      case 'a':
        deltaX = KEYBOARD_PAN_STEP
        break
      case 'ArrowRight':
      case 'd':
        deltaX = -KEYBOARD_PAN_STEP
        break
      case 'e':
        actions.zoomIn()
        break
      case 'q':
        actions.zoomOut()
        break
      default:
        return false
    }

    event.preventDefault()
    actions.panImageBy(deltaX, deltaY)
    return true
  }

  /**
   * Main keyboard event handler
   * Filters input elements, handles keyboard panning, and dispatches shortcut actions
   */
  const handleKeyDown = (event: KeyboardEvent) => {
    // Don't handle keyboard shortcuts when typing in inputs
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    const currentTime = Date.now()
    if (currentTime - lastShortcutHandleTime.value < KEYBOARD_SHORTCUT_THROTTLE) {
      return
    }
    lastShortcutHandleTime.value = currentTime

    // Try to handle as keyboard pan first
    if (tryHandleKeyboardPan(event)) {
      return
    }

    if (!actions) return

    // Find matching shortcut from configuration
    console.log(`Keyboard event:`, {event})

    const matchingShortcut = KEYBOARD_SHORTCUTS.find(shortcut => matchesShortcut(event, shortcut))

    if (matchingShortcut) {
      event.preventDefault()

      // Throttle rapid key repeats for navigation actions
      if (matchingShortcut.action === 'nextImage' || matchingShortcut.action === 'previousImage') {
        const now = Date.now()
        const timeSinceLastPress = now - lastKeyPressTime.value

        // If key is being held down (rapid repeat), throttle to avoid queuing too many navigations
        if (event.repeat && timeSinceLastPress < KEY_REPEAT_THRESHOLD) {
          return // Skip this repeat event
        }

        lastKeyPressTime.value = now
      }

      // Execute the action based on the shortcut configuration
      switch (matchingShortcut.action) {
        case 'nextImage':
          actions.nextImage()
          break
        case 'previousImage':
          actions.previousImage()
          break
        case 'nextTab':
          actions.nextTab()
          break
        case 'previousTab':
          actions.previousTab()
          break
        case 'openImageInNewTab':
          actions.openImageInNewTab()
          break
        case 'createNewTab':
          actions.createNewTab()
          break
        case 'closeCurrentTab':
          actions.closeCurrentTab()
          break
        case 'moveTabRight':
          actions.moveTabRight()
          break
        case 'moveTabLeft':
          actions.moveTabLeft()
          break
        case 'joinWithLeft':
          actions.joinWithLeft()
          break
        case 'joinWithRight':
          actions.joinWithRight()
          break
        case 'zoomIn':
          actions.zoomIn()
          break
        case 'zoomOut':
          actions.zoomOut()
          break
        case 'resetZoom':
          actions.resetZoom()
          break
        case 'toggleFitMode':
          actions.toggleFitMode()
          break
        case 'toggleFavourite':
          actions.toggleFavourite()
          break
        case 'saveAutoSession':
          actions.saveAutoSession()
          break
        default:
          console.warn(`Unknown action: ${matchingShortcut.action}`)
      }
    }
  }

  return {
    shortcutContext: readonly(context),
    setShortcutContext,
    resetShortcutContext,
    handleKeyDown,
    tryHandleKeyboardPan
  }
}
