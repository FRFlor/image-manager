import { ref } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'

const isFullscreen = ref(false)

export function useFullscreen() {
  const toggleFullscreen = async () => {
    try {
      const window = getCurrentWindow()
      const currentlyFullscreen = await window.isFullscreen()
      await window.setFullscreen(!currentlyFullscreen)
      await window.setDecorations(currentlyFullscreen)
      isFullscreen.value = !currentlyFullscreen
      console.log(`Fullscreen ${isFullscreen.value ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Failed to toggle fullscreen:', error)
    }
  }


  return {
    isFullscreen,
    toggleFullscreen,
  }
}
