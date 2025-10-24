<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import FolderNavigator from './components/FolderNavigator.vue'
import ImageViewer from './components/ImageViewer.vue'
import type { ImageData, ApplicationState } from './types'

// Application state
const appState = ref<ApplicationState>({
  currentView: 'folder-browser',
  openTabs: new Map(),
  activeTabId: null,
  supportedFormats: []
})

const isLoading = ref(true)
const error = ref<string | null>(null)
const imageViewer = ref<InstanceType<typeof ImageViewer>>()

// Event handlers
const handleImageOpened = (imageData: ImageData, folderImages: ImageData[]) => {
  console.log('Image opened:', imageData.name)
  console.log('Folder contains:', folderImages.length, 'images')
  
  // Switch to image viewer and open the image
  appState.value.currentView = 'image-viewer'
  
  // Use nextTick to ensure the ImageViewer component is mounted
  setTimeout(() => {
    imageViewer.value?.openImage(imageData, folderImages)
  }, 0)
}

const handleOpenImageRequested = () => {
  // Switch back to file picker
  appState.value.currentView = 'folder-browser'
}

onMounted(async () => {
  try {
    const formats = await invoke<string[]>('get_supported_image_types')
    appState.value.supportedFormats = formats
    isLoading.value = false
    
    // Set up Tauri window close event listener
    try {
      const { listen } = await import('@tauri-apps/api/event')
      
      // Listen for window close event
      await listen('tauri://close-requested', async () => {
        console.log('Window close requested, saving session...')
        try {
          await imageViewer.value?.saveAutoSession()
          console.log('Session saved successfully')
        } catch (error) {
          console.error('Failed to save session on close:', error)
        }
      })
      
      console.log('Window close listener set up successfully')
    } catch (error) {
      console.error('Failed to set up window close listener:', error)
    }
    
    // Try to load auto-session after components are ready
    setTimeout(async () => {
      try {
        console.log('Attempting to load auto-session...')
        
        // First switch to image viewer to ensure the component is mounted
        appState.value.currentView = 'image-viewer'
        
        // Wait a bit more for the component to be fully mounted
        setTimeout(async () => {
          try {
            const sessionLoaded = await imageViewer.value?.loadAutoSession()
            if (sessionLoaded) {
              console.log('Auto-session loaded and restored')
            } else {
              console.log('No auto-session found, switching back to folder browser')
              appState.value.currentView = 'folder-browser'
            }
          } catch (error) {
            console.error('Failed to load auto-session:', error)
            appState.value.currentView = 'folder-browser'
          }
        }, 200)
      } catch (error) {
        console.error('Failed to load auto-session on startup:', error)
        appState.value.currentView = 'folder-browser'
      }
    }, 100)
    
  } catch (err) {
    error.value = err as string
    isLoading.value = false
  }
})

onUnmounted(async () => {
  // Also save session when component unmounts as a fallback
  try {
    await imageViewer.value?.saveAutoSession()
  } catch (error) {
    console.error('Failed to save session on unmount:', error)
  }
})
</script>

<template>
  <div class="app">
    <main>
      <div v-if="isLoading" class="loading-screen">
        <div class="spinner"></div>
        <p>Loading application...</p>
      </div>

      <div v-else-if="error" class="error-screen">
        <h2>Connection Error</h2>
        <p class="error-message">{{ error }}</p>
        <p>Please ensure the Tauri backend is running properly.</p>
      </div>

      <div v-else class="app-content">
        <!-- File Picker View -->
        <div v-if="appState.currentView === 'folder-browser'" class="picker-view">
          <FolderNavigator
            @image-opened="handleImageOpened"
          />
        </div>

        <!-- Image Viewer View -->
        <div v-else-if="appState.currentView === 'image-viewer'" class="viewer-view">
          <ImageViewer
            ref="imageViewer"
            @open-image-requested="handleOpenImageRequested"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  background: #f8f9fa;
}

main {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.loading-screen,
.error-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px;
  background: white;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-screen h2 {
  color: #dc3545;
  margin-bottom: 16px;
}

.error-message {
  color: #dc3545;
  font-weight: bold;
  margin-bottom: 8px;
}

.app-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.picker-view {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.viewer-view {
  height: 100%;
}
</style>
