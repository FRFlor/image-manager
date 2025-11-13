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
      @itemClick="handleItemClick"
      @itemActivate="handleItemActivate"
      @itemsVisible="handleItemsVisible">
    </VirtualImageGrid>
  </div>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import type { FolderContext } from '../types'
import VirtualImageGrid from './VirtualImageGrid.vue'

// Props
const props = defineProps<{
  folderContext: FolderContext
  focusedIndex: number
}>()

// Emits
const emit = defineEmits<{
  imageSelected: [index: number] // Click to focus
  imageActivated: [index: number] // Enter to switch view
  metadataNeeded: [indices: number[]] // Request metadata loading
}>()

// Direct access to folder context data
const fileEntries = props.folderContext.fileEntries
const loadedImages = props.folderContext.loadedImages

// Helper functions for VirtualImageGrid
const isImageLoaded = (path: string): boolean => {
  return loadedImages.has(path)
}

const getImageAssetUrl = (path: string): string => {
  const imageData = loadedImages.get(path)
  return imageData?.assetUrl || convertFileSrc(path.replace(/\\/g, '/'))
}

// Event handlers for VirtualImageGrid
const handleItemClick = (index: number) => {
  emit('imageSelected', index)
}

const handleItemActivate = (index: number) => {
  emit('imageActivated', index)
}

// Debounced batch loading for visible items
let metadataRequestTimer: number | null = null
const pendingIndices: number[] = []

const handleItemsVisible = (indices: number[]) => {
  indices.forEach((index) => {
    const entry = fileEntries[index]
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

</style>
