<template>
  <div class="folder-grid-preview">
    <div class="grid-header">
      <div class="folder-info">
        <h2 class="folder-name">Folder Grid View</h2>
        <span class="image-count">{{ fileEntries.length }} {{ fileEntries.length === 1 ? 'image' : 'images' }}</span>
      </div>
      <div class="header-hint">
        Use arrow keys to navigate • Enter to view • Shift+Enter to exit
      </div>
    </div>

    <VirtualImageGrid
      :items="fileEntries"
      :focusedIndex="focusedIndex"
      :keyboardNavigation="true"
      :getKey="(item) => item.path || ''"
      :getTitle="(item) => item.name || ''"
      :getAssetUrl="(item) => getImageAssetUrl(item.path || '')"
      :isLoaded="(item) => isImageLoaded(item.path || '')"
      :getClasses="(item) => ({ active: isActiveImage(item.path || '') })"
      @itemClick="handleItemClick"
      @itemActivate="handleItemActivate"
      @itemsVisible="handleItemsVisible">
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
import { computed } from 'vue'
import type { FolderContext } from '../types'
import { useTabControls } from '../composables/useTabControls'
import { useUIConfigurations } from '../composables/useUIConfigurations'
import { convertFileSrc } from '@tauri-apps/api/core'
import VirtualImageGrid from './VirtualImageGrid.vue'

// Props
const props = defineProps<{
  folderContext: FolderContext
  currentImagePath: string
  focusedIndex: number
}>()

// Emits
const emit = defineEmits<{
  imageSelected: [index: number] // Click to focus
  imageActivated: [index: number] // Enter to switch view
  metadataNeeded: [indices: number[]] // Request metadata loading
}>()

// Get functions from composables
const { isImageFavourited } = useTabControls()
const { setFolderGridFocus } = useUIConfigurations()

// Computed
const fileEntries = computed(() => props.folderContext.fileEntries)
const loadedImages = computed(() => props.folderContext.loadedImages)
const focusedIndex = computed(() => props.focusedIndex)

// Helper functions for VirtualImageGrid
const isImageLoaded = (path: string): boolean => {
  return loadedImages.value.has(path)
}

const isActiveImage = (path: string): boolean => {
  return path === props.currentImagePath
}

const getImageAssetUrl = (path: string): string => {
  const imageData = loadedImages.value.get(path)
  return imageData?.assetUrl || convertFileSrc(path.replace(/\\/g, '/'))
}

const isImageInFavourites = (imagePath: string): boolean => {
  return isImageFavourited(imagePath)
}

// Event handlers for VirtualImageGrid
const handleItemClick = (index: number) => {
  emit('imageSelected', index)
  setFolderGridFocus(index)
}

const handleItemActivate = (index: number) => {
  emit('imageActivated', index)
}

// Debounced batch loading for visible items
let metadataRequestTimer: number | null = null
const pendingIndices: number[] = []

const handleItemsVisible = (indices: number[]) => {
  indices.forEach((index) => {
    const entry = fileEntries.value[index]
    if (entry && !isImageLoaded(entry.path)) {
      if (!pendingIndices.includes(index)) {
        pendingIndices.push(index)
      }
    }
  })

  // Debounce: batch emit after 50ms to avoid overwhelming the backend
  if (metadataRequestTimer !== null) {
    clearTimeout(metadataRequestTimer)
  }

  if (pendingIndices.length > 0) {
    metadataRequestTimer = setTimeout(() => {
      emit('metadataNeeded', [...pendingIndices])
      pendingIndices.length = 0
      metadataRequestTimer = null
    }, 50) as unknown as number
  }
}
</script>

<style scoped>
.folder-grid-preview {
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

.folder-info {
  display: flex;
  align-items: baseline;
  gap: 1rem;
}

.folder-name {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
  font-weight: 500;
}

.image-count {
  color: #888;
  font-size: 1rem;
}

.header-hint {
  color: #666;
  font-size: 0.875rem;
}

/* Custom styles for this grid (extends VirtualImageGrid) */
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

/* Active state styling for folder grid */
:deep(.grid-item.active) {
  outline: 3px solid #22c55e;
  outline-offset: -3px;
}

:deep(.grid-item.focused.active) {
  outline: 3px solid #0ea5e9;
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.5);
}
</style>
