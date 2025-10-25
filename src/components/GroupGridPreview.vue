<template>
  <div class="group-grid-preview">
    <div class="grid-header">
      <h3>{{ groupName }}</h3>
      <span class="image-count">{{ images.length }} {{ images.length === 1 ? 'image' : 'images' }}</span>
    </div>
    <div class="grid-container">
      <div
        v-for="image in images"
        :key="image.id"
        class="grid-item"
        @click="$emit('imageSelected', image.id)"
        :title="image.name">
        <img
          :src="image.assetUrl"
          :alt="image.name"
          class="grid-thumbnail"
          @error="handleImageError" />
        <div class="grid-item-name">{{ image.name }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ImageData } from '../types'

// Props
defineProps<{
  groupName: string
  images: ImageData[]
}>()

// Emits
defineEmits<{
  imageSelected: [imageId: string]
}>()

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}
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
  padding: 2rem;
  border-bottom: 1px solid #333;
}

.grid-header h3 {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
  font-weight: 500;
}

.image-count {
  color: #888;
  font-size: 1rem;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
}

.grid-item {
  position: relative;
  aspect-ratio: 1;
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
