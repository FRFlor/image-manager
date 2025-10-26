<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import ImageViewer from './components/ImageViewer.vue'
import LoadingIndicator from './components/LoadingIndicator.vue'
import type { ApplicationState, LoadingState, FolderContext, ImageData, FileEntry } from './types'
import { useUIConfigurations } from './composables/useUIConfigurations'

const { toggleControlsVisibility } = useUIConfigurations()

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
          // Save session before closing
          await imageViewer.value?.saveAutoSession()
          console.log('Session saved successfully, exiting app...')

          // Call exit_app command to close the application
          await invoke('exit_app')
        } catch (error) {
          console.error('Failed to save session on close:', error)
          // Exit anyway even if save fails
          try {
            await invoke('exit_app')
          } catch (exitError) {
            console.error('Failed to exit app:', exitError)
          }
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

      // Listen for menu toggle controls event
      await listen('menu-toggle-controls', async () => {
        console.log('Menu toggle controls requested')
        try {
          toggleControlsVisibility()
        } catch (error) {
          console.error('Failed to toggle controls from menu:', error)
        }
      })

      // Listen for menu load auto-session event
      await listen('menu-load-auto-session', async () => {
        console.log('Menu load auto-session requested')
        try {
          await imageViewer.value?.loadAutoSession()
        } catch (error) {
          console.error('Failed to load auto-session from menu:', error)
        }
      })

      // Listen for menu reload session event
      await listen('menu-reload-session', async () => {
        console.log('Menu reload session requested')
        try {
          await imageViewer.value?.reloadCurrentSession()
        } catch (error) {
          console.error('Failed to reload session from menu:', error)
        }
      })

      // Listen for menu update session event
      await listen('menu-update-session', async () => {
        console.log('Menu update session requested')
        try {
          await imageViewer.value?.updateCurrentSession()
        } catch (error) {
          console.error('Failed to update session from menu:', error)
        }
      })

      // Listen for menu load recent session event
      await listen<string>('menu-load-recent-session', async (event) => {
        console.log('Menu load recent session requested:', event.payload)
        try {
          const sessionPath = event.payload
          const sessionData = await invoke<any>('load_session_from_path', { path: sessionPath })
          if (sessionData && imageViewer.value) {
            await imageViewer.value.restoreFromSession(sessionData)

            // Set the current session path and name in the ImageViewer component
            // Extract session name from path
            const pathParts = sessionPath.split(/[\\/]/)
            const fileName = pathParts[pathParts.length - 1]
            const sessionName = fileName.replace('.session.json', '')

            // Update session tracking in the component
            if (imageViewer.value) {
              (imageViewer.value as any).currentSessionPath = sessionPath;
              (imageViewer.value as any).currentSessionName = sessionName
            }
          }
        } catch (error) {
          console.error('Failed to load recent session from menu:', error)
        }
      })

      console.log('Event listeners set up successfully')
    } catch (error) {
      console.error('Failed to set up event listeners:', error)
    }
    
    // Wait for component to be ready with proper async handling
    await waitForComponent()

  } catch (err) {
    console.error('Application initialization error:', err)
    loadingState.value = {
      isLoading: false,
      operation: ''
    }
  }
})

// Helper function to wait for component to be ready
const waitForComponent = async () => {
  return new Promise<void>((resolve) => {
    // Use nextTick to ensure component is mounted
    nextTick(async () => {
      try {
        console.log('Attempting to load auto-session...')
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
        resolve()
      }
    })
  })
}

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
      
      // Read the selected image data
      const imageData = await invoke<any>('read_image_file', { path: selectedPath })

      // Get the folder path and browse folder contents
      // Handle both Windows (\) and Unix (/) path separators
      const lastSeparatorIndex = Math.max(selectedPath.lastIndexOf('/'), selectedPath.lastIndexOf('\\'))
      const folderPath = selectedPath.substring(0, lastSeparatorIndex)
      const folderEntries = await invoke<any[]>('browse_folder', { path: folderPath })

      // Filter image files and convert to FileEntry format
      const imageFileEntries: FileEntry[] = folderEntries
        .filter(entry => entry.is_image)
        .map(entry => ({
          name: entry.name,
          path: entry.path,
          isDirectory: false,
          isImage: true,
          size: entry.size,
          lastModified: entry.last_modified ? new Date(entry.last_modified) : undefined
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      // Transform the selected image data
      const transformedImageData: ImageData = {
        id: imageData.id,
        name: imageData.name,
        path: imageData.path,
        assetUrl: convertFileSrc(imageData.path),
        dimensions: imageData.dimensions,
        fileSize: imageData.file_size,
        lastModified: new Date(imageData.last_modified)
      }

      // Find the index of the selected image in the sorted list
      const selectedIndex = imageFileEntries.findIndex(entry => entry.path === selectedPath)

      // Lazy loading: Only load nearby images (±2 from selected)
      const loadedImages = new Map<string, ImageData>()
      loadedImages.set(selectedPath, transformedImageData) // Add the selected image

      // Load adjacent images for better UX
      const PRELOAD_RANGE = 2
      const startIndex = Math.max(0, selectedIndex - PRELOAD_RANGE)
      const endIndex = Math.min(imageFileEntries.length - 1, selectedIndex + PRELOAD_RANGE)

      // Start preloading adjacent images in background (non-blocking)
      const adjacentLoadPromises: Promise<void>[] = []
      for (let i = startIndex; i <= endIndex; i++) {
        if (i !== selectedIndex) { // Skip the selected image, already loaded
          const entry = imageFileEntries[i]
          if (entry) {
            adjacentLoadPromises.push(
              invoke<any>('read_image_file', { path: entry.path })
                .then(rawData => {
                  loadedImages.set(entry.path, {
                    id: rawData.id,
                    name: rawData.name,
                    path: rawData.path,
                    assetUrl: convertFileSrc(rawData.path),
                    dimensions: rawData.dimensions,
                    fileSize: rawData.file_size,
                    lastModified: new Date(rawData.last_modified)
                  })
                })
                .catch(err => {
                  // Silently skip corrupted images during preloading
                  console.warn(`Skipping corrupted image during preload: ${entry.path}`, err)
                })
            )
          }
        }
      }

      // Fire and forget - don't wait for preloading to complete
      // Images will be available when they finish loading in background
      Promise.all(adjacentLoadPromises).then(() => {
        console.log(`✅ Preloaded ${adjacentLoadPromises.length} adjacent images in background`)
      }).catch(err => {
        console.warn('Some adjacent images failed to preload:', err)
      })

      // Create folder context
      const folderContext: FolderContext = {
        fileEntries: imageFileEntries,
        loadedImages,
        folderPath
      }

      // Open the image in the viewer with lazy loading support
      imageViewer.value?.openImage(transformedImageData, folderContext)

      console.log(`✨ Opened image: ${transformedImageData.name}`)
      console.log(`📁 Folder contains ${imageFileEntries.length} images (loaded ${loadedImages.size} initially)`)
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
