<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const supportedFormats = ref<string[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const testResults = ref<string[]>([])
const currentDirectory = ref<any[]>([])
const selectedImage = ref<any | null>(null)

const addTestResult = (message: string) => {
  testResults.value.push(`${new Date().toLocaleTimeString()}: ${message}`)
}

const testBrowseFolder = async () => {
  try {
    addTestResult('Testing browse_folder command...')
    const files = await invoke<any[]>('browse_folder', { path: null })
    currentDirectory.value = files
    addTestResult(`✅ browse_folder: Found ${files.length} items`)
  } catch (err) {
    addTestResult(`❌ browse_folder failed: ${err}`)
  }
}

const testReadImageFile = async () => {
  try {
    addTestResult('Testing read_image_file command...')
    // Try to read a PNG file from the icons directory
    const imagePath = 'icons/icon.png'
    const imageData = await invoke<any>('read_image_file', { path: imagePath })
    selectedImage.value = imageData
    addTestResult(`✅ read_image_file: Successfully read ${imageData.name} (${imageData.dimensions.width}x${imageData.dimensions.height})`)
  } catch (err) {
    addTestResult(`❌ read_image_file failed: ${err}`)
  }
}

const testOpenFolderDialog = async () => {
  try {
    addTestResult('Testing open_folder_dialog command...')
    const folderPath = await invoke<string | null>('open_folder_dialog')
    if (folderPath) {
      addTestResult(`✅ open_folder_dialog: Selected folder ${folderPath}`)
    } else {
      addTestResult('ℹ️ open_folder_dialog: User cancelled dialog')
    }
  } catch (err) {
    addTestResult(`❌ open_folder_dialog failed: ${err}`)
  }
}

onMounted(async () => {
  try {
    const formats = await invoke<string[]>('get_supported_image_types')
    supportedFormats.value = formats
    addTestResult(`✅ get_supported_image_types: ${formats.length} formats supported`)
    isLoading.value = false
  } catch (err) {
    error.value = err as string
    addTestResult(`❌ get_supported_image_types failed: ${err}`)
    isLoading.value = false
  }
})
</script>

<template>
  <div class="app">
    <header>
      <h1>Image Viewer</h1>
      <p>Tauri + Vue.js Image Viewer Application</p>
    </header>

    <main>
      <div class="status-card">
        <h2>Tauri Connection Status</h2>
        <div v-if="isLoading" class="loading">
          Loading...
        </div>
        <div v-else-if="error" class="error">
          Error: {{ error }}
        </div>
        <div v-else class="success">
          ✅ Tauri backend connected successfully!
          <div class="supported-formats">
            <h3>Supported Image Formats:</h3>
            <ul>
              <li v-for="format in supportedFormats" :key="format">
                {{ format.toUpperCase() }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="test-section">
        <h2>Command Testing</h2>
        <div class="test-buttons">
          <button @click="testBrowseFolder" class="test-btn">Test Browse Folder</button>
          <button @click="testReadImageFile" class="test-btn">Test Read Image</button>
          <button @click="testOpenFolderDialog" class="test-btn">Test Folder Dialog</button>
        </div>
        
        <div v-if="testResults.length > 0" class="test-results">
          <h3>Test Results:</h3>
          <div class="results-log">
            <div v-for="result in testResults" :key="result" class="log-entry">
              {{ result }}
            </div>
          </div>
        </div>

        <div v-if="currentDirectory.length > 0" class="directory-listing">
          <h3>Current Directory Contents:</h3>
          <div class="file-list">
            <div v-for="file in currentDirectory.slice(0, 10)" :key="file.path" class="file-item">
              <span class="file-icon">{{ file.is_directory ? '📁' : (file.is_image ? '🖼️' : '📄') }}</span>
              <span class="file-name">{{ file.name }}</span>
              <span v-if="file.size" class="file-size">({{ Math.round(file.size / 1024) }}KB)</span>
            </div>
            <div v-if="currentDirectory.length > 10" class="more-files">
              ... and {{ currentDirectory.length - 10 }} more items
            </div>
          </div>
        </div>

        <div v-if="selectedImage" class="image-info">
          <h3>Selected Image Info:</h3>
          <div class="image-details">
            <p><strong>Name:</strong> {{ selectedImage.name }}</p>
            <p><strong>Dimensions:</strong> {{ selectedImage.dimensions.width }}x{{ selectedImage.dimensions.height }}</p>
            <p><strong>File Size:</strong> {{ Math.round(selectedImage.file_size / 1024) }}KB</p>
            <p><strong>Asset URL:</strong> {{ selectedImage.asset_url }}</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

header {
  margin-bottom: 2rem;
}

h1 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.status-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 2rem;
  margin: 1rem 0;
}

.loading {
  color: #6c757d;
  font-style: italic;
}

.error {
  color: #dc3545;
  font-weight: bold;
}

.success {
  color: #28a745;
  font-weight: bold;
}

.supported-formats {
  margin-top: 1rem;
  text-align: left;
}

.supported-formats h3 {
  color: #495057;
  margin-bottom: 0.5rem;
}

.supported-formats ul {
  list-style-type: none;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.supported-formats li {
  background: #e9ecef;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: bold;
}

.test-section {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 2rem;
  margin: 1rem 0;
  text-align: left;
}

.test-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.test-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.test-btn:hover {
  background: #0056b3;
}

.test-results {
  margin-top: 1rem;
}

.results-log {
  background: #f1f3f4;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 1rem;
  max-height: 200px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.875rem;
}

.log-entry {
  margin-bottom: 0.25rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.directory-listing, .image-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #ffffff;
  border: 1px solid #e9ecef;
  border-radius: 4px;
}

.file-list {
  max-height: 300px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #f1f3f4;
}

.file-icon {
  font-size: 1.2rem;
}

.file-name {
  flex: 1;
  font-weight: 500;
}

.file-size {
  color: #6c757d;
  font-size: 0.875rem;
}

.more-files {
  padding: 0.5rem 0;
  color: #6c757d;
  font-style: italic;
}

.image-details p {
  margin: 0.5rem 0;
}
</style>
