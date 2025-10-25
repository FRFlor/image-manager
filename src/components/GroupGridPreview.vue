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
    <div class="grid-container">
      <div
        v-for="(image, index) in images"
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
        <div class="grid-item-name">{{ image.name }}</div>

        <!-- Arrow Controls (shown when highlighted) -->
        <div v-if="selectedImageId === image.id" class="arrow-controls">
          <button
            v-if="index > 0"
            @click.stop="moveImage(index, 'left')"
            class="arrow-btn arrow-left"
            title="Move left">
            ←
          </button>
          <button
            v-if="index < images.length - 1"
            @click.stop="moveImage(index, 'right')"
            class="arrow-btn arrow-right"
            title="Move right">
            →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ImageData } from '../types'

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

// State
const selectedImageId = ref<string | null>(null)

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

.arrow-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.5rem;
  pointer-events: none;
}

.arrow-btn {
  pointer-events: auto;
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid #0ea5e9;
  border-radius: 50%;
  color: #0ea5e9;
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
}

.arrow-btn:hover {
  background: #0ea5e9;
  color: #fff;
  transform: scale(1.1);
}

.arrow-btn:active {
  transform: scale(0.95);
}

.arrow-left {
  margin-right: auto;
}

.arrow-right {
  margin-left: auto;
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
