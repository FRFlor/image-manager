<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
  } catch (err) {
    error.value = err as string
    isLoading.value = false
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
