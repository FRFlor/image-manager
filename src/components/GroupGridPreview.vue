<template>
  <div class="group-grid-preview">
    <div class="grid-header">
      <input
        type="text"
        :value="groupName"
        @input="handleNameChange"
        class="group-name-input"
        placeholder="Group name"
        spellcheck="false" />
      <span class="image-count">{{ images.length }} {{ images.length === 1 ? 'image' : 'images' }}</span>
    </div>

    <!-- Reorder Controls (shown when an image is selected) -->
    <div v-if="selectedImageId" class="reorder-controls">
      <button
        v-if="selectedImageIndex > 0"
        @click="moveImage(selectedImageIndex, 'left')"
        class="reorder-btn"
        title="Move left">
        ← Move Left
      </button>
      <span class="selected-image-name">{{ selectedImageName }}</span>
      <button
        v-if="selectedImageIndex < images.length - 1"
        @click="moveImage(selectedImageIndex, 'right')"
        class="reorder-btn"
        title="Move right">
        Move Right →
      </button>
    </div>

    <div class="grid-container">
      <div
        v-for="image in images"
        :key="image.id"
        class="grid-item"
        :class="{ highlighted: selectedImageId === image.id }"
        @click="selectImage(image.id)"
        @dblclick="$emit('imageSelected', image.id)"
        :title="image.name">
        <img
          :src="image.assetUrl"
          :alt="image.name"
          class="grid-thumbnail"
          @error="handleImageError" />
        <!-- Favourite Star Indicator -->
        <div v-if="isImageInFavourites(image.path)" class="favourite-star-indicator">
          ⭐
        </div>
        <div class="grid-item-name">{{ image.name }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ImageData } from '../types'
import { useTabControls } from '../composables/useTabControls'

// Props
const props = defineProps<{
  groupName: string
  images: ImageData[]
  tabIds: string[] // Tab IDs corresponding to images array
}>()

// Emits
const emit = defineEmits<{
  imageSelected: [imageId: string]
  nameChanged: [newName: string]
  imageReordered: [direction: 'left' | 'right', tabId: string]
}>()

// Get favourites functions from composable
const { isImageFavourited, toggleFavouriteForTab } = useTabControls()

// State
const selectedImageId = ref<string | null>(null)

// Computed properties for selected image
const selectedImageIndex = computed(() => {
  if (!selectedImageId.value) return -1
  return props.images.findIndex(img => img.id === selectedImageId.value)
})

const selectedImageName = computed(() => {
  if (selectedImageIndex.value === -1) return ''
  return props.images[selectedImageIndex.value]?.name || ''
})

const selectImage = (imageId: string) => {
  selectedImageId.value = imageId
}

const moveImage = (fromIndex: number, direction: 'left' | 'right') => {
  const tabId = props.tabIds[fromIndex]
  if (tabId) {
    emit('imageReordered', direction, tabId)
  }
}

const handleNameChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  emit('nameChanged', input.value)
}

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// Check if an image is favourited
const isImageInFavourites = (imagePath: string): boolean => {
  return isImageFavourited(imagePath)
}

// Handle keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  // Don't handle keyboard shortcuts when typing in input
  if (event.target instanceof HTMLInputElement) {
    return
  }

  // Ctrl+F / Cmd+F to toggle favourite for selected image
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()

    if (selectedImageId.value) {
      // Find the corresponding tab ID for the selected image
      const selectedIndex = props.images.findIndex(img => img.id === selectedImageId.value)
      const tabId = props.tabIds[selectedIndex]

      if (tabId) {
        // Toggle favourite without switching tabs
        toggleFavouriteForTab(tabId)
      }
    }
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.group-grid-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #1a1a1a;
  overflow: hidden;
}

.grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2rem 2rem 1rem 2rem;
  border-bottom: 1px solid #333;
}

.reorder-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 2rem 1rem 2rem;
  border-bottom: 1px solid #333;
  background: #1a1a1a;
}

.reorder-btn {
  padding: 0.5rem 1rem;
  background: #0ea5e9;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.reorder-btn:hover {
  background: #0284c7;
  transform: translateY(-1px);
}

.reorder-btn:active {
  transform: translateY(0);
}

.selected-image-name {
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-name-input {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
  font-weight: 500;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 0.25rem 0.5rem;
  outline: none;
  transition: border-color 0.2s ease;
  font-family: inherit;
  min-width: 200px;
  max-width: 500px;
}

.group-name-input:hover {
  border-bottom-color: #444;
}

.group-name-input:focus {
  border-bottom-color: #0ea5e9;
}

.image-count {
  color: #888;
  font-size: 1rem;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 3px;
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
  align-content: start;
}

.grid-item {
  position: relative;
  width: 100%;
  height: 200px;
  background: #252525;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.grid-item:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
}

.grid-item.highlighted {
  outline: 3px solid #0ea5e9;
  outline-offset: -3px;
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.5);
}

.grid-thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.grid-item-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.5rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
  color: #fff;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.grid-item:hover .grid-item-name {
  opacity: 1;
}

/* Favourite Star Indicator */
.favourite-star-indicator {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 20px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  z-index: 10;
  opacity: 0.95;
}

/* Scrollbar styling */
.grid-container::-webkit-scrollbar {
  width: 8px;
}

.grid-container::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.grid-container::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.grid-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
