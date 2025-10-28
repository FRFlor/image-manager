import { ref } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'

// Shared fullscreen state (module-level for cross-component access)
const isFullscreen = ref(false)

/**
 * Composable for managing fullscreen mode
 * Provides shared state and methods to enter/exit fullscreen using Tauri window API
 */
export function useFullscreen() {
  /**
   * Toggle fullscreen mode on/off
   */
  const toggleFullscreen = async () => {
    try {
      const window = getCurrentWindow()
      const currentlyFullscreen = await window.isFullscreen()
      await window.setFullscreen(!currentlyFullscreen)
      isFullscreen.value = !currentlyFullscreen
      console.log(`Fullscreen ${isFullscreen.value ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error)
    }
  }

  /**
   * Enter fullscreen mode
   */
  const enterFullscreen = async () => {
    if (!isFullscreen.value) {
      await toggleFullscreen()
    }
  }

  /**
   * Exit fullscreen mode
   */
  const exitFullscreen = async () => {
    if (isFullscreen.value) {
      await toggleFullscreen()
    }
  }

  return {
    isFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen
  }
}
