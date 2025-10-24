<template>
  <div class="image-viewer">
    <!-- Tab Navigation -->
    <div class="tab-bar">
      <div class="tab-container">
        <div 
          v-for="tab in sortedTabs" 
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
      <div 
        class="image-container" 
        ref="imageContainer"
        @wheel="handleWheel"
        @mousedown="handleMouseDown"
        :class="{ 
          'dragging': isDragging,
          'pannable': fitMode === 'actual-size'
        }"
      >
        <img 
          ref="imageElement"
          :src="activeImage.assetUrl" 
          :alt="activeImage.name"
          class="main-image"
          :class="{ 'fit-to-window': fitMode === 'fit-to-window' }"
          :style="{
            transform: fitMode === 'actual-size' 
              ? `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`
              : 'none'
          }"
          @load="onImageLoad"
          @error="onImageError"
          @dragstart.prevent
        />
      </div>

      <!-- Zoom Controls -->
      <div class="zoom-controls" v-if="activeImage">
        <div class="zoom-info">
          <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <span class="fit-mode">{{ fitMode === 'fit-to-window' ? 'Fit' : 'Actual' }}</span>
        </div>
        <div class="zoom-buttons">
          <button @click="zoomOut" class="zoom-btn" :disabled="fitMode === 'fit-to-window'" title="Zoom out (Ctrl/Cmd -)">
            −
          </button>
          <button @click="resetZoom" class="zoom-btn" title="Reset zoom (Ctrl/Cmd 0)">
            ⌂
          </button>
          <button @click="zoomIn" class="zoom-btn" title="Zoom in (Ctrl/Cmd +)">
            +
          </button>
          <button @click="toggleFitMode" class="zoom-btn fit-toggle" title="Toggle fit mode (Ctrl/Cmd /)">
            {{ fitMode === 'fit-to-window' ? '1:1' : 'Fit' }}
          </button>
        </div>
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
import type { ImageData, TabData, SessionData } from '../types'
import { KEYBOARD_SHORTCUTS, matchesShortcut } from '../config/keyboardShortcuts'
import { sessionService } from '../services/sessionService'

// Props and Emits
const emit = defineEmits<{
  openImageRequested: []
}>()

// Reactive state
const tabs = ref<Map<string, TabData>>(new Map())
const activeTabId = ref<string | null>(null)
const currentFolderImages = ref<ImageData[]>([])
const imageContainer = ref<HTMLElement>()

// Zoom and pan state
const zoomLevel = ref(1)
const fitMode = ref<'fit-to-window' | 'actual-size'>('fit-to-window')
const panOffset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const imageElement = ref<HTMLImageElement>()




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

const sortedTabs = computed(() => {
  return Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
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
    order: getNextTabOrder()
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

  // Reset zoom and pan when switching tabs
  resetImageView()

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
      if (newActiveTab) {
        switchToTab(newActiveTab.id)
      }
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
  
  // Reset zoom and pan when changing images
  resetImageView()
  
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
      order: getNextTabOrder()
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
  const tabArray = sortedTabs.value
  if (tabArray.length <= 1) return
  
  const currentIndex = tabArray.findIndex(tab => tab.id === activeTabId.value)
  const nextIndex = (currentIndex + 1) % tabArray.length
  const nextTab = tabArray[nextIndex]
  if (nextTab) {
    switchToTab(nextTab.id)
  }
}

const switchToPreviousTab = () => {
  const tabArray = sortedTabs.value
  if (tabArray.length <= 1) return
  
  const currentIndex = tabArray.findIndex(tab => tab.id === activeTabId.value)
  const prevIndex = currentIndex === 0 ? tabArray.length - 1 : currentIndex - 1
  const prevTab = tabArray[prevIndex]
  if (prevTab) {
    switchToTab(prevTab.id)
  }
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
  
  const tabArray = sortedTabs.value
  const contextTabIndex = tabArray.findIndex(tab => tab.id === contextMenuTabId.value)
  
  if (contextTabIndex >= 0) {
    const tabsToClose = tabArray.slice(contextTabIndex + 1)
    tabsToClose.forEach(tab => closeTab(tab.id))
  }
  contextMenuVisible.value = false
}

const closeTabsToLeft = () => {
  if (!contextMenuTabId.value) return
  
  const tabArray = sortedTabs.value
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

// Tab reordering functionality
const getNextTabOrder = (): number => {
  if (tabs.value.size === 0) return 0
  const maxOrder = Math.max(...Array.from(tabs.value.values()).map(tab => tab.order))
  return maxOrder + 1
}

const moveTabRight = () => {
  if (!activeTabId.value) return
  
  const tabArray = sortedTabs.value
  const currentIndex = tabArray.findIndex(tab => tab.id === activeTabId.value)
  
  if (currentIndex === -1 || currentIndex >= tabArray.length - 1) return
  
  // Swap with the tab to the right
  const currentTab = tabArray[currentIndex]
  const rightTab = tabArray[currentIndex + 1]
  
  if (currentTab && rightTab) {
    const tempOrder = currentTab.order
    currentTab.order = rightTab.order
    rightTab.order = tempOrder
    
    console.log(`Moved tab "${currentTab.title}" to the right`)
  }
}

const moveTabLeft = () => {
  if (!activeTabId.value) return
  
  const tabArray = sortedTabs.value
  const currentIndex = tabArray.findIndex(tab => tab.id === activeTabId.value)
  
  if (currentIndex === -1 || currentIndex <= 0) return
  
  // Swap with the tab to the left
  const currentTab = tabArray[currentIndex]
  const leftTab = tabArray[currentIndex - 1]
  
  if (currentTab && leftTab) {
    const tempOrder = currentTab.order
    currentTab.order = leftTab.order
    leftTab.order = tempOrder
    
    console.log(`Moved tab "${currentTab.title}" to the left`)
  }
}

const onImageLoad = () => {
  console.log('Image loaded successfully')
}

const onImageError = () => {
  console.error('Failed to load image')
}

// Zoom and pan functionality
const zoomIn = () => {
  if (fitMode.value === 'fit-to-window') {
    fitMode.value = 'actual-size'
    zoomLevel.value = 1.2 // Start with a slight zoom to make panning useful
  } else {
    zoomLevel.value = Math.min(zoomLevel.value * 1.2, 5) // Max zoom 5x
  }
  console.log(`Zoomed in to ${(zoomLevel.value * 100).toFixed(0)}%`)
}

const zoomOut = () => {
  if (fitMode.value === 'fit-to-window') {
    return // Can't zoom out in fit mode
  }
  
  zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.1) // Min zoom 10%
  
  // If zoomed out enough, switch back to fit mode
  if (zoomLevel.value <= 0.5) {
    fitMode.value = 'fit-to-window'
    zoomLevel.value = 1
    panOffset.value = { x: 0, y: 0 }
  }
  
  console.log(`Zoomed out to ${(zoomLevel.value * 100).toFixed(0)}%`)
}

const resetZoom = () => {
  fitMode.value = 'fit-to-window'
  zoomLevel.value = 1
  panOffset.value = { x: 0, y: 0 }
  console.log('Reset zoom to fit window')
}

const toggleFitMode = () => {
  if (fitMode.value === 'fit-to-window') {
    fitMode.value = 'actual-size'
    zoomLevel.value = 1.2 // Start with a slight zoom to make panning useful
    panOffset.value = { x: 0, y: 0 }
    console.log('Switched to actual size mode')
  } else {
    fitMode.value = 'fit-to-window'
    zoomLevel.value = 1
    panOffset.value = { x: 0, y: 0 }
    console.log('Switched to fit window mode')
  }
}

const handleWheel = (event: WheelEvent) => {
  if (!activeImage.value) return
  
  event.preventDefault()
  
  if (event.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

const handleMouseDown = (event: MouseEvent) => {
  if (fitMode.value === 'fit-to-window') return
  
  isDragging.value = true
  dragStart.value = {
    x: event.clientX - panOffset.value.x,
    y: event.clientY - panOffset.value.y
  }
  
  event.preventDefault()
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return
  
  panOffset.value = {
    x: event.clientX - dragStart.value.x,
    y: event.clientY - dragStart.value.y
  }
}

const handleMouseUp = () => {
  isDragging.value = false
}

// Reset zoom and pan when switching images
const resetImageView = () => {
  fitMode.value = 'fit-to-window'
  zoomLevel.value = 1
  panOffset.value = { x: 0, y: 0 }
}



// Enhanced keyboard navigation using configuration
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return // Don't handle keyboard shortcuts when typing in inputs
  }

  // Find matching shortcut from configuration
  const matchingShortcut = KEYBOARD_SHORTCUTS.find(shortcut => matchesShortcut(event, shortcut))
  
  if (matchingShortcut) {
    event.preventDefault()
    
    // Execute the action based on the shortcut configuration
    switch (matchingShortcut.action) {
      case 'nextImage':
        nextImage()
        break
      case 'previousImage':
        previousImage()
        break
      case 'nextTab':
        switchToNextTab()
        break
      case 'previousTab':
        switchToPreviousTab()
        break
      case 'openImageInNewTab':
        openImageInNewTab()
        break
      case 'createNewTab':
        createNewTab()
        break
      case 'closeCurrentTab':
        closeCurrentTab()
        break
      case 'moveTabRight':
        moveTabRight()
        break
      case 'moveTabLeft':
        moveTabLeft()
        break
      case 'zoomIn':
        zoomIn()
        break
      case 'zoomOut':
        zoomOut()
        break
      case 'resetZoom':
        resetZoom()
        break
      case 'toggleFitMode':
        toggleFitMode()
        break
      case 'saveAutoSession':
        saveAutoSession()
        break
      default:
        console.warn(`Unknown action: ${matchingShortcut.action}`)
    }
  }
}



// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

// Session management methods
const createSessionData = (): SessionData => {
  const tabArray = sortedTabs.value
  const sessionTabs = tabArray.map(tab => ({
    id: tab.id,
    imagePath: tab.imageData.path,
    order: tab.order
  }))

  return {
    tabs: sessionTabs,
    activeTabId: activeTabId.value,
    createdAt: new Date().toISOString()
  }
}

const restoreFromSession = async (sessionData: SessionData) => {
  try {
    // Clear existing tabs
    tabs.value.clear()
    tabFolderContexts.value.clear()
    activeTabId.value = null
    currentFolderImages.value = []

    // Import invoke here to avoid unused import warning
    const { invoke } = await import('@tauri-apps/api/core')
    
    // Restore tabs from session
    for (const sessionTab of sessionData.tabs) {
      try {
        // Check if the image file still exists and load it
        const imageData = await invoke<any>('read_image_file', { path: sessionTab.imagePath })
        
        const restoredImageData: ImageData = {
          id: imageData.id,
          name: imageData.name,
          path: imageData.path,
          assetUrl: imageData.asset_url,
          dimensions: imageData.dimensions,
          fileSize: imageData.file_size,
          lastModified: new Date(imageData.last_modified)
        }

        // Create tab with restored data
        const tab: TabData = {
          id: sessionTab.id,
          title: restoredImageData.name,
          imageData: restoredImageData,
          isActive: sessionTab.id === sessionData.activeTabId,
          order: sessionTab.order
        }

        tabs.value.set(sessionTab.id, tab)

        // Load folder context for this tab
        await loadFolderContextForTab(tab)
        
        console.log(`Restored tab: ${restoredImageData.name}`)
      } catch (error) {
        console.warn(`Failed to restore image: ${sessionTab.imagePath}`, error)
        // Skip this tab if the image no longer exists
      }
    }

    // Set active tab
    if (sessionData.activeTabId && tabs.value.has(sessionData.activeTabId)) {
      activeTabId.value = sessionData.activeTabId
      const activeTab = tabs.value.get(sessionData.activeTabId)
      if (activeTab) {
        activeTab.isActive = true
        await loadFolderContextForTab(activeTab)
      }
    } else if (tabs.value.size > 0) {
      // If the original active tab doesn't exist, activate the first available tab
      const firstTab = Array.from(tabs.value.values())[0]
      if (firstTab) {
        activeTabId.value = firstTab.id
        firstTab.isActive = true
        await loadFolderContextForTab(firstTab)
      }
    }

    console.log(`Session restored with ${tabs.value.size} tabs`)
  } catch (error) {
    console.error('Failed to restore session:', error)
    throw error
  }
}

const saveAutoSession = async () => {
  console.log('saveAutoSession called, tabs count:', tabs.value.size)
  
  if (tabs.value.size === 0) {
    console.log('No tabs to save, skipping auto-session save')
    return
  }

  try {
    const sessionData = createSessionData()
    console.log('Created session data:', sessionData)
    await sessionService.saveAutoSession(sessionData)
    console.log('Auto-session saved successfully')
  } catch (error) {
    console.error('Failed to save auto-session:', error)
    // Don't throw here as this shouldn't block the application
  }
}

const loadAutoSession = async () => {
  console.log('loadAutoSession called')
  try {
    const sessionData = await sessionService.loadAutoSession()
    console.log('Loaded session data:', sessionData)
    if (sessionData) {
      await restoreFromSession(sessionData)
      console.log('Session restored successfully')
      return true
    }
    console.log('No session data found')
    return false
  } catch (error) {
    console.error('Failed to load auto-session:', error)
    return false
  }
}

// Expose methods for parent component
defineExpose({
  openImage,
  saveAutoSession,
  loadAutoSession,
  createSessionData,
  restoreFromSession
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
  transition: all 0.2s ease;
  min-width: 120px;
  max-width: 200px;
  white-space: nowrap;
  user-select: none;
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
  position: relative;
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
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
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

/* Zoom Controls */
.zoom-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(45, 45, 45, 0.9);
  border: 1px solid #404040;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(10px);
  z-index: 10;
}

.zoom-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 50px;
}

.zoom-level {
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.fit-mode {
  font-size: 10px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.zoom-buttons {
  display: flex;
  gap: 4px;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  background: #404040;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.zoom-btn:hover:not(:disabled) {
  background: #505050;
  transform: scale(1.05);
}

.zoom-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-btn.fit-toggle {
  font-size: 10px;
  font-weight: 600;
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