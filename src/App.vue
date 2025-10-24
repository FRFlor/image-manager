<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import ImageViewer from './components/ImageViewer.vue'
import LoadingIndicator from './components/LoadingIndicator.vue'
import type { ApplicationState, LoadingState } from './types'

// Application state
const appState = ref<ApplicationState>({
  openTabs: new Map(),
  activeTabId: null,
  supportedFormats: []
})

const loadingState = ref<LoadingState>({
  isLoading: true,
  operation: 'Initializing application...'
})
const imageViewer = ref<InstanceType<typeof ImageViewer>>()

onMounted(async () => {
  
  try {
    loadingState.value = {
      isLoading: true,
      operation: 'Loading supported image formats...'
    }

    const formats = await invoke<string[]>('get_supported_image_types')
    appState.value.supportedFormats = formats
    
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
          } finally {
            // Application is ready
            loadingState.value = {
              isLoading: false,
              operation: ''
            }
            
            console.log('🚀 Application initialized successfully')
          }
        }, 200)
      } catch (error) {
        console.error('Failed to load auto-session on startup:', error)
        loadingState.value = {
          isLoading: false,
          operation: ''
        }

      }
    }, 100)
    
  } catch (err) {
    console.error('Application initialization error:', err)
    loadingState.value = {
      isLoading: false,
      operation: ''
    }

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
    console.log('🔍 Opening image dialog...')
    console.log('🔍 Current loading state:', loadingState.value)
    
    loadingState.value = {
      isLoading: true,
      operation: 'Opening image dialog...'
    }
    
    // Test Tauri connection first
    console.log('🔍 Testing Tauri connection...')
    try {
      const supportedTypes = await invoke<string[]>('get_supported_image_types')
      console.log('✅ Tauri connection OK, supported types:', supportedTypes)
    } catch (testError) {
      console.error('💥 Tauri connection failed:', testError)
      throw new Error('Tauri backend not responding')
    }
    
    // Open file dialog to select an image
    console.log('🔍 About to call open_image_dialog...')
    const selectedPath = await invoke<string | null>('open_image_dialog')
    console.log('🔍 Dialog result:', selectedPath)
    
    if (selectedPath) {
      console.log('✅ Selected image:', selectedPath)
      
      loadingState.value = {
        isLoading: true,
        operation: 'Loading image...'
      }
      
      // Read the image data
      const imageData = await invoke<any>('read_image_file', { path: selectedPath })

      // Get the folder path and load other images in the same folder
      // Handle both Windows (\) and Unix (/) path separators
      const lastSeparatorIndex = Math.max(selectedPath.lastIndexOf('/'), selectedPath.lastIndexOf('\\'))
      const folderPath = selectedPath.substring(0, lastSeparatorIndex)
      const folderEntries = await invoke<any[]>('browse_folder', { path: folderPath })
      
      // Filter and transform image files in the folder
      const imageEntries = folderEntries.filter(entry => entry.is_image)
      const folderImagePromises = imageEntries.map(async (entry) => {
        const rawData = await invoke<any>('read_image_file', { path: entry.path })
        return {
          id: rawData.id,
          name: rawData.name,
          path: rawData.path,
          assetUrl: convertFileSrc(rawData.path),
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
        assetUrl: convertFileSrc(imageData.path),
        dimensions: imageData.dimensions,
        fileSize: imageData.file_size,
        lastModified: new Date(imageData.last_modified)
      }
      
      // Open the image in the viewer
      imageViewer.value?.openImage(transformedImageData, folderImages)
      
      console.log(`Opened image: ${transformedImageData.name}`)
      console.log(`Folder contains ${folderImages.length} images`)
    } else {
      console.log('❌ No image selected (user cancelled)')
    }
  } catch (error) {
    console.error('💥 Failed to open image:', error)
    console.error('💥 Error details:', error)
  } finally {
    loadingState.value = {
      isLoading: false,
      operation: ''
    }
  }
}
</script>

<template>
  <div class="app">
    <main>
      <div class="app-content">
        <!-- Image Viewer -->
        <ImageViewer
          ref="imageViewer"
          @openImageRequested="handleOpenImageRequest"
        />
        
        <!-- Loading Indicator -->
        <LoadingIndicator
          :loading="loadingState.isLoading"
          :message="loadingState.message"
          :operation="loadingState.operation"
          :progress="loadingState.progress"
          :show-progress="loadingState.progress !== undefined"
          :fullscreen="true"
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



.app-content {
  height: 100%;
}
</style>
