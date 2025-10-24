<template>
  <div class="file-picker">
    <div class="picker-content">
      <div class="welcome-message">
        <h2>Image Viewer</h2>
        <p>Select an image to start viewing</p>
      </div>

      <div class="picker-actions">
        <button @click="openImageDialog" class="open-image-btn" :disabled="isLoading">
          <span class="btn-icon">🖼️</span>
          <span class="btn-text">Open Image</span>
        </button>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading image...</p>
      </div>

      <div v-if="error" class="error-state">
        <p class="error-message">{{ error }}</p>
        <button @click="clearError" class="retry-btn">Dismiss</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { ImageData } from '../types'

// Props and Emits
const emit = defineEmits<{
  imageOpened: [imageData: ImageData, folderImages: ImageData[]]
}>()

// Reactive state
const isLoading = ref(false)
const error = ref<string | null>(null)

// Methods
const openImageDialog = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    // Use Tauri's file dialog to select an image
    const selectedPath = await invoke<string | null>('open_image_dialog')
    
    if (selectedPath) {
      // Load the selected image
      const rawImageData = await invoke<any>('read_image_file', { path: selectedPath })
      
      // Transform snake_case to camelCase to match TypeScript interface
      const imageData: ImageData = {
        id: rawImageData.id,
        name: rawImageData.name,
        path: rawImageData.path,
        assetUrl: rawImageData.asset_url,
        dimensions: rawImageData.dimensions,
        fileSize: rawImageData.file_size,
        lastModified: new Date(rawImageData.last_modified)
      }
      
      // Get the folder containing this image and load all images in it
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
        } as ImageData
      })
      
      const folderImages = await Promise.all(folderImagePromises)
      
      // Sort images by name for consistent navigation
      folderImages.sort((a, b) => a.name.localeCompare(b.name))
      
      emit('imageOpened', imageData, folderImages)
    }
  } catch (err) {
    error.value = `Failed to open image: ${err}`
    console.error('Open image error:', err)
  } finally {
    isLoading.value = false
  }
}

const clearError = () => {
  error.value = null
}
</script>

<style scoped>
.file-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #ffffff;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
}

.picker-content {
  text-align: center;
  padding: 40px;
  max-width: 400px;
}

.welcome-message {
  margin-bottom: 32px;
}

.welcome-message h2 {
  color: #2c3e50;
  margin: 0 0 8px 0;
  font-size: 28px;
  font-weight: 600;
}

.welcome-message p {
  color: #6c757d;
  margin: 0;
  font-size: 16px;
}

.picker-actions {
  margin-bottom: 24px;
}

.open-image-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 32px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 200px;
}

.open-image-btn:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
}

.open-image-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-icon {
  font-size: 20px;
}

.btn-text {
  font-weight: 500;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #6c757d;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-state {
  color: #dc3545;
  padding: 20px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
  margin-top: 16px;
}

.error-message {
  margin: 0 0 12px 0;
  font-weight: 500;
}

.retry-btn {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.retry-btn:hover {
  background: #c82333;
}
</style>