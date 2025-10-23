<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const supportedFormats = ref<string[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const formats = await invoke<string[]>('get_supported_image_types')
    supportedFormats.value = formats
    isLoading.value = false
  } catch (err) {
    error.value = err as string
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
</style>
