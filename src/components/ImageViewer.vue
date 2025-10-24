<template>
  <div class="image-viewer">
    <!-- Tab Navigation -->
    <div class="tab-bar">
      <div class="tab-container">
        <div 
          v-for="tab in Array.from(tabs.values())" 
          :key="tab.id"
          @click="switchToTab(tab.id)"
          @contextmenu.prevent="showTabContextMenu($event, tab.id)"
          class="tab"
          :class="{ active: tab.id === activeTabId }"
        >
          <span class="tab-title">{{ tab.title }}</span>
          <button 
            @click.stop="closeTab(tab.id)"
            class="tab-close"
            :title="`Close ${tab.title}`"
          >
            ×
          </button>
        </div>
      </div>
      <div class="tab-controls">
        <button @click="openNewImage" class="new-tab-btn" title="Open new image">
          +
        </button>
      </div>
    </div>

    <!-- Image Display Area -->
    <div class="image-display" v-if="activeImage">
      <div class="image-container" ref="imageContainer">
        <img 
          :src="activeImage.assetUrl" 
          :alt="activeImage.name"
          class="main-image"
          @load="onImageLoad"
          @error="onImageError"
        />
      </div>

      <!-- Image Info Bar -->
      <div class="info-bar">
        <div class="image-info">
          <span class="image-name">{{ activeImage.name }}</span>
          <span class="image-details">
            {{ activeImage.dimensions.width }}×{{ activeImage.dimensions.height }} • 
            {{ formatFileSize(activeImage.fileSize) }}
          </span>
          <span class="folder-position" v-if="currentFolderImages.length > 1">
            {{ currentImageIndex + 1 }} of {{ currentFolderImages.length }}
          </span>
        </div>
        <div class="navigation-controls">
          <button 
            @click="previousImage" 
            :disabled="currentFolderImages.length <= 1"
            class="nav-btn"
            title="Previous image (←)"
          >
            ← Prev
          </button>
          <button 
            @click="nextImage" 
            :disabled="currentFolderImages.length <= 1"
            class="nav-btn"
            title="Next image (→)"
          >
            Next →
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-viewer">
      <div class="empty-content">
        <h3>No image selected</h3>
        <p>Open an image to start viewing</p>
        <button @click="openNewImage" class="open-btn">
          Open Image
        </button>
      </div>
    </div>

    <!-- Tab Context Menu -->
    <div 
      v-if="contextMenuVisible" 
      class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
    >
      <div class="context-menu-item" @click="closeTab(contextMenuTabId!)">
        Close Tab
      </div>
      <div class="context-menu-item" @click="closeOtherTabs">
        Close Other Tabs
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="closeTabsToLeft">
        Close Tabs to Left
      </div>
      <div class="context-menu-item" @click="closeTabsToRight">
        Close Tabs to Right
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ImageData, TabData } from '../types'

// Props and Emits
const emit = defineEmits<{
  openImageRequested: []
}>()

// Reactive state
const tabs = ref<Map<string, TabData>>(new Map())
const activeTabId = ref<string | null>(null)
const currentFolderImages = ref<ImageData[]>([])
const imageContainer = ref<HTMLElement>()

// Computed properties
const activeImage = computed(() => {
  if (!activeTabId.value) return null
  const tab = tabs.value.get(activeTabId.value)
  return tab?.imageData || null
})

const currentImageIndex = computed(() => {
  if (!activeImage.value) return -1
  return currentFolderImages.value.findIndex(img => img.path === activeImage.value!.path)
})

// Methods
const openImage = (imageData: ImageData, folderImages: ImageData[]) => {
  // Create a new tab for this image
  const tabId = `tab-${Date.now()}`
  const tab: TabData = {
    id: tabId,
    title: imageData.name,
    imageData,
    isActive: true,
    order: tabs.value.size
  }

  // Set all existing tabs to inactive
  tabs.value.forEach(existingTab => {
    existingTab.isActive = false
  })

  // Add the new tab
  tabs.value.set(tabId, tab)
  activeTabId.value = tabId
  currentFolderImages.value = folderImages
  
  // Store folder context for this tab
  tabFolderContexts.value.set(tabId, folderImages)

  console.log(`Opened image: ${imageData.name}`)
  console.log(`Folder contains ${folderImages.length} images`)
}

const switchToTab = (tabId: string) => {
  const tab = tabs.value.get(tabId)
  if (!tab) return

  // Update active states
  tabs.value.forEach(t => { t.isActive = false })
  tab.isActive = true
  activeTabId.value = tabId

  // Load folder context for this tab if needed
  loadFolderContextForTab(tab)
}

// Store folder contexts for each tab
const tabFolderContexts = ref<Map<string, ImageData[]>>(new Map())

const loadFolderContextForTab = async (tab: TabData) => {
  // Check if we already have folder context for this tab
  if (tabFolderContexts.value.has(tab.id)) {
    currentFolderImages.value = tabFolderContexts.value.get(tab.id) || []
    return
  }

  // Load folder context for this tab's image
  try {
    const imagePath = tab.imageData.path
    const folderPath = imagePath.substring(0, imagePath.lastIndexOf('/'))
    
    // Import invoke here to avoid the unused import warning
    const { invoke } = await import('@tauri-apps/api/core')
    const folderEntries = await invoke<any[]>('browse_folder', { path: folderPath })
    
    // Filter and transform image files in the folder
    const imageEntries = folderEntries.filter(entry => entry.is_image)
    const folderImagePromises = imageEntries.map(async (entry) => {
      const rawData = await invoke<any>('read_image_file', { path: entry.path })
      return {
        id: rawData.id,
        name: rawData.name,
        path: rawData.path,
        assetUrl: rawData.asset_url,
        dimensions: rawData.dimensions,
        fileSize: rawData.file_size,
        lastModified: new Date(rawData.last_modified)
      } as ImageData
    })
    
    const folderImages = await Promise.all(folderImagePromises)
    folderImages.sort((a, b) => a.name.localeCompare(b.name))
    
    // Store folder context for this tab
    tabFolderContexts.value.set(tab.id, folderImages)
    currentFolderImages.value = folderImages
  } catch (error) {
    console.error('Failed to load folder context for tab:', error)
    currentFolderImages.value = [tab.imageData] // Fallback to just the current image
  }
}

const closeTab = (tabId: string) => {
  const tabToClose = tabs.value.get(tabId)
  if (!tabToClose) return
  
  // Clean up folder context for this tab
  tabFolderContexts.value.delete(tabId)
  tabs.value.delete(tabId)
  
  if (activeTabId.value === tabId) {
    // Find another tab to activate - prefer the tab to the right, then left
    const remainingTabs = Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
    if (remainingTabs.length > 0) {
      // Find the next tab after the closed one, or the last tab if none found
      const closedTabOrder = tabToClose.order
      let newActiveTab = remainingTabs.find(tab => tab.order > closedTabOrder)
      if (!newActiveTab) {
        newActiveTab = remainingTabs[remainingTabs.length - 1]
      }
      switchToTab(newActiveTab.id)
    } else {
      activeTabId.value = null
      currentFolderImages.value = []
    }
  }
}

const nextImage = async () => {
  if (currentFolderImages.value.length <= 1 || !activeImage.value) return
  
  const currentIndex = currentImageIndex.value
  const nextIndex = (currentIndex + 1) % currentFolderImages.value.length
  const nextImageData = currentFolderImages.value[nextIndex]
  
  if (nextImageData) {
    await updateCurrentTabImage(nextImageData)
  }
}

const previousImage = async () => {
  if (currentFolderImages.value.length <= 1 || !activeImage.value) return
  
  const currentIndex = currentImageIndex.value
  const prevIndex = currentIndex === 0 ? currentFolderImages.value.length - 1 : currentIndex - 1
  const prevImageData = currentFolderImages.value[prevIndex]
  
  if (prevImageData) {
    await updateCurrentTabImage(prevImageData)
  }
}

const updateCurrentTabImage = async (newImageData: ImageData) => {
  if (!activeTabId.value) return
  
  const activeTab = tabs.value.get(activeTabId.value)
  if (!activeTab) return
  
  // Update the tab with the new image data
  activeTab.imageData = newImageData
  activeTab.title = newImageData.name
  
  console.log(`Navigated to: ${newImageData.name}`)
}

const openNewImage = () => {
  emit('openImageRequested')
}

// Enhanced tab management functions
const openImageInNewTab = async () => {
  if (!activeImage.value || currentFolderImages.value.length <= 1) return
  
  const currentIndex = currentImageIndex.value
  const nextIndex = (currentIndex + 1) % currentFolderImages.value.length
  const nextImageData = currentFolderImages.value[nextIndex]
  
  if (nextImageData) {
    // Create a new tab for the next image
    const tabId = `tab-${Date.now()}`
    const tab: TabData = {
      id: tabId,
      title: nextImageData.name,
      imageData: nextImageData,
      isActive: true, // Switch to the new tab immediately
      order: tabs.value.size
    }
    
    // Set all existing tabs to inactive
    tabs.value.forEach(existingTab => {
      existingTab.isActive = false
    })
    
    tabs.value.set(tabId, tab)
    activeTabId.value = tabId
    
    // Store the same folder context for the new tab
    if (tabFolderContexts.value.has(activeTabId.value)) {
      const currentFolderContext = tabFolderContexts.value.get(activeTabId.value)
      if (currentFolderContext) {
        tabFolderContexts.value.set(tabId, currentFolderContext)
        currentFolderImages.value = currentFolderContext
      }
    }
    
    console.log(`Opened ${nextImageData.name} in new tab and switched to it`)
  }
}

const switchToNextTab = () => {
  const tabArray = Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
  if (tabArray.length <= 1) return
  
  const currentIndex = tabArray.findIndex(tab => tab.id === activeTabId.value)
  const nextIndex = (currentIndex + 1) % tabArray.length
  switchToTab(tabArray[nextIndex].id)
}

const switchToPreviousTab = () => {
  const tabArray = Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
  if (tabArray.length <= 1) return
  
  const currentIndex = tabArray.findIndex(tab => tab.id === activeTabId.value)
  const prevIndex = currentIndex === 0 ? tabArray.length - 1 : currentIndex - 1
  switchToTab(tabArray[prevIndex].id)
}

const createNewTab = () => {
  // Open file picker to create a new tab
  emit('openImageRequested')
}

const closeCurrentTab = () => {
  if (activeTabId.value) {
    closeTab(activeTabId.value)
  }
}

// Context menu functionality
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTabId = ref<string | null>(null)

const showTabContextMenu = (event: MouseEvent, tabId: string) => {
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuTabId.value = tabId
  contextMenuVisible.value = true
  
  // Close context menu when clicking elsewhere
  const closeContextMenu = () => {
    contextMenuVisible.value = false
    document.removeEventListener('click', closeContextMenu)
  }
  
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu)
  }, 0)
}

const closeOtherTabs = () => {
  if (!contextMenuTabId.value) return
  
  const tabsToClose = Array.from(tabs.value.keys()).filter(id => id !== contextMenuTabId.value)
  tabsToClose.forEach(tabId => closeTab(tabId))
  contextMenuVisible.value = false
}

const closeTabsToRight = () => {
  if (!contextMenuTabId.value) return
  
  const tabArray = Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
  const contextTabIndex = tabArray.findIndex(tab => tab.id === contextMenuTabId.value)
  
  if (contextTabIndex >= 0) {
    const tabsToClose = tabArray.slice(contextTabIndex + 1)
    tabsToClose.forEach(tab => closeTab(tab.id))
  }
  contextMenuVisible.value = false
}

const closeTabsToLeft = () => {
  if (!contextMenuTabId.value) return
  
  const tabArray = Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
  const contextTabIndex = tabArray.findIndex(tab => tab.id === contextMenuTabId.value)
  
  if (contextTabIndex >= 0) {
    const tabsToClose = tabArray.slice(0, contextTabIndex)
    tabsToClose.forEach(tab => closeTab(tab.id))
  }
  contextMenuVisible.value = false
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const onImageLoad = () => {
  console.log('Image loaded successfully')
}

const onImageError = () => {
  console.error('Failed to load image')
}

// Enhanced keyboard navigation
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return // Don't handle keyboard shortcuts when typing in inputs
  }

  // Handle Ctrl+Tab and Ctrl+Shift+Tab for tab switching
  if (event.key === 'Tab' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    if (event.shiftKey) {
      switchToPreviousTab()
    } else {
      switchToNextTab()
    }
    return
  }

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      previousImage()
      break
    case 'ArrowRight':
      event.preventDefault()
      nextImage()
      break
    case 'Enter':
      // Open next image in new tab while staying in current viewer
      event.preventDefault()
      openImageInNewTab()
      break
    case 'Escape':
      // Close current tab
      if (activeTabId.value) {
        closeTab(activeTabId.value)
      }
      break
    case 'o':
    case 'O':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        // Open new tab instead of returning to file picker
        createNewTab()
      }
      break
    case 't':
    case 'T':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        createNewTab()
      }
      break
    case 'w':
    case 'W':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        closeCurrentTab()
      }
      break
  }
}

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

// Expose methods for parent component
defineExpose({
  openImage
})
</script>

<style scoped>
.image-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a1a;
  color: white;
}

.tab-bar {
  display: flex;
  background: #2d2d2d;
  border-bottom: 1px solid #404040;
  flex-shrink: 0;
}

.tab-container {
  display: flex;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tab-container::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #2d2d2d;
  border-right: 1px solid #404040;
  cursor: pointer;
  transition: background-color 0.2s;
  min-width: 120px;
  max-width: 200px;
  white-space: nowrap;
}

.tab:hover {
  background: #3d3d3d;
}

.tab.active {
  background: #1a1a1a;
  border-bottom: 2px solid #007bff;
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.tab-close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s;
}

.tab-close:hover {
  background: #ff4444;
  color: white;
}

.tab-controls {
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-left: 1px solid #404040;
}

.new-tab-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 20px;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.new-tab-btn:hover {
  background: #3d3d3d;
  color: white;
}

.image-display {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.image-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
}

.main-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #2d2d2d;
  border-top: 1px solid #404040;
  flex-shrink: 0;
}

.image-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.image-name {
  font-weight: 600;
  font-size: 16px;
  color: white;
}

.image-details {
  font-size: 14px;
  color: #999;
}

.folder-position {
  font-size: 12px;
  color: #666;
}

.navigation-controls {
  display: flex;
  gap: 8px;
}

.nav-btn {
  padding: 8px 16px;
  background: #404040;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: #505050;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-viewer {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-content {
  text-align: center;
  color: #999;
}

.empty-content h3 {
  margin: 0 0 8px 0;
  color: white;
  font-size: 24px;
}

.empty-content p {
  margin: 0 0 24px 0;
  font-size: 16px;
}

.open-btn {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.open-btn:hover {
  background: #0056b3;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  min-width: 180px;
  padding: 4px 0;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #fff;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background: #404040;
}

.context-menu-separator {
  height: 1px;
  background: #404040;
  margin: 4px 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .info-bar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .image-info {
    text-align: center;
  }
  
  .navigation-controls {
    justify-content: center;
  }
  
  .tab {
    min-width: 100px;
    max-width: 150px;
  }
}
</style>