<template>
  <div v-if="totalImages > 0" class="folder-position-bar">
    <!-- Background container -->
    <div class="bar-background">
      <!-- Individual image segments (blue for loaded) -->
      <div
        v-for="index in totalImages"
        :key="index - 1"
        class="image-segment"
        :class="{ loaded: loadedIndices.has(index - 1) }"
        :style="{ width: segmentWidth }"
      ></div>
    </div>

    <!-- Current position cursor (red line) -->
    <div
      class="position-cursor"
      :style="{ left: cursorPosition }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  currentIndex: number  // Current image index (0-based)
  totalImages: number   // Total images in folder
  loadedIndices: Set<number>  // Set of loaded image indices
}>()

// Calculate width of each segment
const segmentWidth = computed(() => {
  if (props.totalImages === 0) return '0%'
  return `${100 / props.totalImages}%`
})

// Calculate cursor position
const cursorPosition = computed(() => {
  if (props.totalImages === 0) return '0%'
  return `${(props.currentIndex / props.totalImages) * 100}%`
})
</script>

<style scoped>
.folder-position-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  z-index: 9999;
  overflow: hidden;
  background-color: rgba(255, 255, 255, 0.05);
}

.bar-background {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
}

.image-segment {
  height: 100%;
  background-color: transparent;
  transition: background-color 0.2s ease-out;
}

.image-segment.loaded {
  background-color: #4a9eff;
}

.position-cursor {
  position: absolute;
  top: 0;
  height: 100%;
  width: 2px;
  background-color: #ff4444;
  box-shadow: 0 0 4px rgba(255, 68, 68, 0.8);
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 10;
}
</style>
