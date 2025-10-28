<template>
  <div class="image-viewer-container" ref="viewerContainer">
    <!-- Image Display Area -->
    <div class="image-container" ref="imageContainer" @wheel="handleWheel" @mousedown="handleImageMouseDown" :class="{
      'dragging': isDragging,
      'pannable': fitMode !== 'fit-to-window',
      'scrollable': fitMode === 'actual-size' && zoomLevel > 1
    }">
      <!-- Corrupted Image Placeholder -->
      <div v-if="isCorrupted" class="corrupted-placeholder">
        <svg viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg" class="corrupted-svg">
          <!-- Background -->
          <rect width="1920" height="1080" fill="#1a1a1a"/>

          <!-- Warning Icon Circle -->
          <circle cx="960" cy="440" r="80" fill="none" stroke="#ff6b6b" stroke-width="6"/>

          <!-- Warning Icon Exclamation -->
          <line x1="960" y1="390" x2="960" y2="460" stroke="#ff6b6b" stroke-width="8" stroke-linecap="round"/>
          <circle cx="960" cy="485" r="6" fill="#ff6b6b"/>

          <!-- Text: Corrupted File -->
          <text x="960" y="580" font-family="system-ui, -apple-system, sans-serif" font-size="48"
                fill="#ff6b6b" text-anchor="middle" font-weight="500">
            Corrupted File
          </text>

          <!-- File Name -->
          <text x="960" y="640" font-family="system-ui, -apple-system, sans-serif" font-size="28"
                fill="#999" text-anchor="middle">
            {{ currentFileEntry?.name || 'Unknown' }}
          </text>
        </svg>
      </div>

      <!-- Valid Image -->
      <img v-else-if="imageData" ref="imageElement" :src="imageData.assetUrl" :alt="imageData.name" class="main-image"
        :class="{
          'fit-to-window': fitMode === 'fit-to-window',
          'fit-by-width': fitMode === 'fit-by-width',
          'fit-by-height': fitMode === 'fit-by-height'
        }" :style="{
          transform: fitMode === 'actual-size'
            ? `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`
            : fitMode === 'fit-to-window'
              ? 'none'
              : `translate(${panOffset.x}px, ${panOffset.y}px)`
        }" @load="onImageLoad" @error="onImageError" @dragstart.prevent />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ImageData, FileEntry } from '../types'
import { useZoomControls } from '../composables/useZoomControls'

// Props
defineProps<{
  imageData: ImageData | null
  isCorrupted: boolean
  currentFileEntry: FileEntry | null
}>()

// Composables for zoom/pan state
const {
  zoomLevel,
  fitMode,
  panOffset,
  isDragging,
  handleWheel,
  handleMouseDown: handleZoomMouseDown,
} = useZoomControls()

// Refs
const imageContainer = ref<HTMLElement>()
const viewerContainer = ref<HTMLElement>()
const imageElement = ref<HTMLImageElement>()

const emit = defineEmits(['image-clicked'])

// Event handlers
const handleImageMouseDown = (event: MouseEvent) => {
  emit('image-clicked')
  handleZoomMouseDown(event)
}

const onImageLoad = () => {
  console.log('Image loaded successfully')
}

const onImageError = () => {
  console.error('Failed to load image')
}
</script>

<style scoped>
.image-viewer-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  overflow: hidden;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
  position: relative;
}

/* Enable scrolling when image is zoomed beyond viewport */
.image-container.scrollable {
  overflow: auto;
}

/* Ultra-slim dark scrollbars (WebKit: Chrome, Edge, Safari) */
.image-container.scrollable::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.image-container.scrollable::-webkit-scrollbar-track {
  background: transparent;
}

.image-container.scrollable::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 10px;
}

.image-container.scrollable::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.45);
}

/* Firefox scrollbar styling */
.image-container.scrollable {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}

/* Panning and dragging states */
.image-container.pannable {
  cursor: grab;
}

.image-container.dragging {
  cursor: grabbing;
}

.main-image {
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  transition: transform 0.1s ease-out;
  user-select: none;
  pointer-events: none;
}

.main-image.fit-to-window {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.main-image.fit-by-width {
  width: 100%;
  height: auto;
  max-height: none;
}

.main-image.fit-by-height {
  height: 100%;
  width: auto;
  max-width: none;
}

/* Corrupted Image Placeholder */
.corrupted-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
}

.corrupted-svg {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
</style>