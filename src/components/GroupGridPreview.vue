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
      <div class="header-right">
        <button
          @click="sortTabsAlphabetically"
          class="sort-button"
          title="Sort tabs alphabetically">
          Sort A-Z
        </button>
        <span class="image-count">{{ images.length }} {{ images.length === 1 ? 'image' : 'images' }}</span>
      </div>
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

    <VirtualImageGrid
      :items="images"
      :focusedIndex="selectedImageIndex"
      :keyboardNavigation="false"
      :getKey="(item) => item.id || ''"
      :getTitle="(item) => item.name || ''"
      :getAssetUrl="(item) => item.assetUrl || ''"
      :isLoaded="() => true"
      :getClasses="(item) => ({ highlighted: selectedImageId === item.id })"
      @itemClick="handleItemClick"
      @itemDoubleClick="handleItemDoubleClick">
      <template #item-overlay="{ item }">
        <!-- Favourite Star Indicator -->
        <div v-if="item && item.path && isImageInFavourites(item.path)" class="favourite-star-indicator">
          ⭐
        </div>
      </template>
    </VirtualImageGrid>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ImageData } from '../types'
import { useTabControls } from '../composables/useTabControls'
import VirtualImageGrid from './VirtualImageGrid.vue'

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
const { isImageFavourited, toggleFavouriteForTab, sortGroupTabsAlphabetically } = useTabControls()

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

// Handle click from VirtualImageGrid (index-based) and convert to ID-based
const handleItemClick = (index: number) => {
  const image = props.images[index]
  if (image) {
    selectImage(image.id)
  }
}

// Handle double-click from VirtualImageGrid (index-based)
const handleItemDoubleClick = (index: number) => {
  const image = props.images[index]
  if (image) {
    emit('imageSelected', image.id)
  }
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

// Check if an image is favourited
const isImageInFavourites = (imagePath: string): boolean => {
  return isImageFavourited(imagePath)
}

// Sort tabs alphabetically
const sortTabsAlphabetically = () => {
  // Need to get groupId from the first tab
  if (props.tabIds.length === 0) return

  // Call the composable function to sort the group
  sortGroupTabsAlphabetically(props.tabIds)
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

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.sort-button {
  padding: 0.5rem 1rem;
  background: #444;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.sort-button:hover {
  background: #555;
  transform: translateY(-1px);
}

.sort-button:active {
  transform: translateY(0);
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

/* Custom styles for group grid (extends VirtualImageGrid) */
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

/* Highlighted state styling for group grid */
:deep(.grid-item.highlighted) {
  outline: 3px solid #0ea5e9;
  outline-offset: -3px;
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.5);
}
</style>
