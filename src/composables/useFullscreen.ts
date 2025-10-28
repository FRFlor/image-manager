import { ref } from 'vue'

const isFullscreen = ref(false)

export function useFullscreen() {
  const toggleFullscreen = async () => {
    try {
      isFullscreen.value = !isFullscreen.value
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
