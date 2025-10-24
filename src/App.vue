<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import ImageViewer from './components/ImageViewer.vue'
import type { ApplicationState } from './types'

// Application state
const appState = ref<ApplicationState>({
  openTabs: new Map(),
  activeTabId: null,
  supportedFormats: []
})

const isLoading = ref(true)
const error = ref<string | null>(null)
const imageViewer = ref<InstanceType<typeof ImageViewer>>()

onMounted(async () => {
  try {
    const formats = await invoke<string[]>('get_supported_image_types')
    appState.value.supportedFormats = formats
    isLoading.value = false
    
    // Set up Tauri event listeners
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
      
      // Listen for menu save session event
      await listen('menu-save-session', async () => {
        console.log('Menu save session requested')
        try {
          if (imageViewer.value) {
            await imageViewer.value.saveSessionDialog()
          } else {
            console.log('No active session to save')
          }
        } catch (error) {
          console.error('Failed to save session from menu:', error)
        }
      })
      
      // Listen for menu load session event
      await listen('menu-load-session', async () => {
        console.log('Menu load session requested')
        try {
          // Wait for component to mount
          setTimeout(async () => {
            try {
              await imageViewer.value?.loadSessionDialog()
            } catch (error) {
              console.error('Failed to load session from menu:', error)
            }
          }, 100)
        } catch (error) {
          console.error('Failed to handle menu load session:', error)
        }
      })
      
      console.log('Event listeners set up successfully')
    } catch (error) {
      console.error('Failed to set up event listeners:', error)
    }
    
    // Try to load auto-session after components are ready
    setTimeout(async () => {
      try {
        console.log('Attempting to load auto-session...')
        
        // Wait for the component to be fully mounted
        setTimeout(async () => {
          try {
            const sessionLoaded = await imageViewer.value?.loadAutoSession()
            if (sessionLoaded) {
              console.log('Auto-session loaded and restored')
            } else {
              console.log('No auto-session found')
            }
          } catch (error) {
            console.error('Failed to load auto-session:', error)
          }
        }, 200)
      } catch (error) {
        console.error('Failed to load auto-session on startup:', error)
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

// Handle open image request from ImageViewer
const handleOpenImageRequest = async () => {
  try {
    console.log('Opening image dialog...')
    
    // Open file dialog to select an image
    const selectedPath = await invoke<string | null>('open_image_dialog')
    
    if (selectedPath) {
      console.log('Selected image:', selectedPath)
      
      // Read the image data
      const imageData = await invoke('read_image_file', { path: selectedPath })
      
      // Get the folder path and load other images in the same folder
      const folderPath = selectedPath.substring(0, selectedPath.lastIndexOf('/'))
      const folderEntries = await invoke<any[]>('browse_folder', { path: folderPath })
      
      // Filter and transform image files in the folder
      const imageEntries = folderEntries.filter(entry => entry.is_image)
      const folderImagePromises = imageEntries.map(async (entry) => {
        const rawData = await invoke<any>('read_image_file', { path: entry.path })
        return {
          id: rawData.id,
          name: rawData.name,
          path: rawData.path,
          assetUrl: rawData.asset_url,
          dimensions: rawData.dimensions,
          fileSize: rawData.file_size,
          lastModified: new Date(rawData.last_modified)
        }
      })
      
      const folderImages = await Promise.all(folderImagePromises)
      folderImages.sort((a, b) => a.name.localeCompare(b.name))
      
      // Transform the selected image data to match the expected format
      const transformedImageData = {
        id: imageData.id,
        name: imageData.name,
        path: imageData.path,
        assetUrl: imageData.asset_url,
        dimensions: imageData.dimensions,
        fileSize: imageData.file_size,
        lastModified: new Date(imageData.last_modified)
      }
      
      // Open the image in the viewer
      imageViewer.value?.openImage(transformedImageData, folderImages)
      
      console.log(`Opened image: ${transformedImageData.name}`)
      console.log(`Folder contains ${folderImages.length} images`)
    } else {
      console.log('No image selected (user cancelled)')
    }
  } catch (error) {
    console.error('Failed to open image:', error)
    // You could show an error message to the user here
  }
}
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
        <!-- Image Viewer -->
        <ImageViewer
          ref="imageViewer"
          @openImageRequested="handleOpenImageRequest"
        />
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
}
</style>
