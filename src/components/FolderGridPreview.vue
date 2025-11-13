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

    <div ref="gridContainerRef" class="grid-container" @keydown="handleGridKeyDown" tabindex="0">
      <div
        v-for="(entry, index) in fileEntries"
        :key="entry.path"
        :ref="el => setItemRef(el, index)"
        :data-index="index"
        class="grid-item"
        :class="{
          focused: focusedIndex === index,
          active: isActiveImage(entry.path)
        }"
        @click="handleItemClick(index)"
        :title="entry.name">
        <div v-if="!isImageLoaded(entry.path)" class="loading-placeholder">
          <div class="loading-spinner"></div>
          <div class="loading-text">{{ entry.name }}</div>
        </div>
        <template v-else>
          <img
            :src="getImageAssetUrl(entry.path)"
            :alt="entry.name"
            class="grid-thumbnail"
            @error="handleImageError" />
          <!-- Favourite Star Indicator -->
          <div v-if="isImageInFavourites(entry.path)" class="favourite-star-indicator">
            ⭐
          </div>
          <div class="grid-item-name">{{ entry.name }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import type { FolderContext } from '../types'
import { useTabControls } from '../composables/useTabControls'
import { useUIConfigurations } from '../composables/useUIConfigurations'
import { convertFileSrc } from '@tauri-apps/api/core'

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

// State
const gridContainerRef = ref<HTMLElement | null>(null)
const itemRefs = new Map<number, HTMLElement>()

// Computed
const fileEntries = computed(() => props.folderContext.fileEntries)
const loadedImages = computed(() => props.folderContext.loadedImages)

const focusedIndex = computed(() => props.focusedIndex)

// Cached maps for expensive lookups (avoids Map.has() calls in render loop)
const loadedStatusMap = computed(() => {
  const map = new Map<string, boolean>()
  fileEntries.value.forEach(entry => {
    map.set(entry.path, loadedImages.value.has(entry.path))
  })
  return map
})

const assetUrlMap = computed(() => {
  const map = new Map<string, string>()
  loadedImages.value.forEach((imageData, path) => {
    map.set(path, imageData.assetUrl)
  })
  return map
})

// Calculate grid columns dynamically
const gridColumns = ref(6) // Default value

const updateGridColumns = () => {
  if (gridContainerRef.value) {
    const containerWidth = gridContainerRef.value.clientWidth
    const minCellWidth = 200
    const gap = 3
    const padding = 32 // 2rem on each side
    const availableWidth = containerWidth - padding * 2
    const columns = Math.floor((availableWidth + gap) / (minCellWidth + gap))
    gridColumns.value = Math.max(1, columns)
  }
}

// Set item ref and observe for lazy loading (optimized to avoid watcher overhead)
const setItemRef = (el: any, index: number) => {
  if (el) {
    const element = el as HTMLElement
    itemRefs.set(index, element)

    // Observe new item immediately if observer is ready
    if (observerRef.value) {
      nextTick(() => {
        observerRef.value?.observe(element)
      })
    }
  } else {
    // Unobserve and remove when element is unmounted
    const existing = itemRefs.get(index)
    if (existing && observerRef.value) {
      observerRef.value.unobserve(existing)
    }
    itemRefs.delete(index)
  }
}

// Check if image is loaded (using cached map for performance)
const isImageLoaded = (path: string): boolean => {
  return loadedStatusMap.value.get(path) ?? false
}

// Check if this is the active image
const isActiveImage = (path: string): boolean => {
  return path === props.currentImagePath
}

// Get image asset URL (using cached map for performance)
const getImageAssetUrl = (path: string): string => {
  return assetUrlMap.value.get(path) || convertFileSrc(path.replace(/\\/g, '/'))
}

// Check if an image is favourited
const isImageInFavourites = (imagePath: string): boolean => {
  return isImageFavourited(imagePath)
}

// Handle click on grid item
const handleItemClick = (index: number) => {
  emit('imageSelected', index)
  setFolderGridFocus(index)
}

// Handle image load error
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// 2D Grid Navigation
const handleGridKeyDown = (event: KeyboardEvent) => {
  const current = focusedIndex.value

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    const next = Math.min(current + 1, fileEntries.value.length - 1)
    emit('imageSelected', next)
    setFolderGridFocus(next)
    scrollToIndex(next)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    const prev = Math.max(current - 1, 0)
    emit('imageSelected', prev)
    setFolderGridFocus(prev)
    scrollToIndex(prev)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    const next = Math.min(current + gridColumns.value, fileEntries.value.length - 1)
    emit('imageSelected', next)
    setFolderGridFocus(next)
    scrollToIndex(next)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const prev = Math.max(current - gridColumns.value, 0)
    emit('imageSelected', prev)
    setFolderGridFocus(prev)
    scrollToIndex(prev)
  } else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('imageActivated', focusedIndex.value)
  }
}

// Scroll focused item into view (centered vertically)
const scrollToIndex = (index: number) => {
  nextTick(() => {
    const element = itemRefs.get(index)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

// Intersection Observer for lazy loading with debounced batching
const observerRef = ref<IntersectionObserver | null>(null)
let metadataRequestTimer: number | null = null
const pendingIndices: number[] = []

const setupIntersectionObserver = () => {
  if (!gridContainerRef.value) return

  observerRef.value = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement
          const index = parseInt(element.dataset.index || '-1', 10)

          if (index >= 0 && !isImageLoaded(fileEntries.value[index]?.path || '')) {
            // Add to pending batch
            if (!pendingIndices.includes(index)) {
              pendingIndices.push(index)
            }
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
          pendingIndices.length = 0 // Clear the array
          metadataRequestTimer = null
        }, 50) as unknown as number
      }
    },
    {
      root: gridContainerRef.value,
      rootMargin: '200px', // Preload images 200px before they enter viewport
      threshold: 0.01
    }
  )

  // Observe all grid items
  itemRefs.forEach((element) => {
    observerRef.value?.observe(element)
  })
}

// Focus the grid container on mount
onMounted(async () => {
  await nextTick()
  updateGridColumns()
  window.addEventListener('resize', updateGridColumns)

  // Focus the grid for keyboard navigation
  if (gridContainerRef.value) {
    gridContainerRef.value.focus()
  }

  // Scroll to focused index
  scrollToIndex(focusedIndex.value)

  // Setup lazy loading observer
  setupIntersectionObserver()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateGridColumns)
  if (observerRef.value) {
    observerRef.value.disconnect()
  }
  // Clean up pending metadata request timer
  if (metadataRequestTimer !== null) {
    clearTimeout(metadataRequestTimer)
    metadataRequestTimer = null
  }
})

// Watch for focusedIndex changes to scroll
watch(focusedIndex, (newIndex) => {
  scrollToIndex(newIndex)
})
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

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 3px;
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
  align-content: start;
  outline: none;
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

.grid-item.focused {
  outline: 3px solid #0ea5e9;
  outline-offset: -3px;
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.5);
}

.grid-item.active {
  outline: 3px solid #22c55e;
  outline-offset: -3px;
}

.grid-item.focused.active {
  outline: 3px solid #0ea5e9;
  box-shadow: 0 0 20px rgba(14, 165, 233, 0.5);
}

.loading-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  color: #666;
  gap: 0.5rem;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #444;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 0.75rem;
  max-width: 90%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
