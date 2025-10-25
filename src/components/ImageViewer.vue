<template>
  <div class="image-viewer" :class="'layout-' + tabLayoutMode">
    <!-- Tree Panel (Left Sidebar) -->
    <div class="tree-panel" v-if="tabLayoutMode === 'tree-small' || tabLayoutMode === 'tree-large'" :class="{ collapsed: treeCollapsed }">
      <div class="tree-controls">
        <button @click="toggleTreeCollapse" class="tree-collapse-btn" :title="treeCollapsed ? 'Expand tree' : 'Collapse tree'">
          <span v-if="treeCollapsed">→</span>
          <span v-else>←</span>
        </button>
        <button v-if="!treeCollapsed" @click="toggleTabLayout" class="layout-toggle-btn" :title="`Current layout: ${tabLayoutMode}`">
          ▤
        </button>
        <button v-if="!treeCollapsed" @click="openNewImage" class="new-tab-btn" title="Open new image">
          +
        </button>
      </div>
      <div class="tree-items" ref="treeItemsContainer">
        <div v-for="tab in sortedTabs" :key="tab.id" @click="switchToTab(tab.id)"
          @contextmenu.prevent="showTabContextMenu($event, tab.id)" class="tree-item"
          :class="{ active: tab.id === activeTabId }">
          <img v-if="tab.imageData.assetUrl" :src="tab.imageData.assetUrl" :alt="tab.title" class="tree-item-thumbnail" />
          <span v-if="!treeCollapsed" class="tree-item-title">{{ tab.title }}</span>
        </div>
      </div>
    </div>

    <!-- Tab Navigation (Top Bar) -->
    <div class="tab-bar" :class="'layout-' + tabLayoutMode" v-if="tabLayoutMode === 'top-small' || tabLayoutMode === 'top-large' || tabLayoutMode === 'invisible'">
      <div class="tab-container" ref="tabContainer" v-show="tabLayoutMode !== 'invisible'">
        <div v-for="tab in sortedTabs" :key="tab.id" @click="switchToTab(tab.id)"
          @contextmenu.prevent="showTabContextMenu($event, tab.id)" class="tab"
          :class="{ active: tab.id === activeTabId }">
          <img v-if="tab.imageData.assetUrl" :src="tab.imageData.assetUrl" :alt="tab.title" class="tab-thumbnail" />
          <span class="tab-title">{{ tab.title }}</span>
          <button @click.stop="closeTab(tab.id)" class="tab-close" :title="`Close ${tab.title}`">
            ×
          </button>
        </div>
      </div>
      <div class="tab-controls">
        <button @click="toggleTabLayout" class="layout-toggle-btn" :title="`Current layout: ${tabLayoutMode}`">
          <span v-if="tabLayoutMode === 'invisible'">−</span>
          <span v-else-if="tabLayoutMode === 'top-small'">=</span>
          <span v-else-if="tabLayoutMode === 'top-large'">☰</span>
          <span v-else-if="tabLayoutMode === 'tree-small'">▤</span>
          <span v-else>⊞</span>
        </button>
        <button @click="openNewImage" class="new-tab-btn" title="Open new image">
          +
        </button>
      </div>
    </div>

    <!-- Image Display Area -->
    <div class="image-display" v-if="activeImage || isImageCorrupted">
      <div class="image-container" ref="imageContainer" @wheel="handleWheel" @mousedown="handleMouseDown" :class="{
        'dragging': isDragging,
        'pannable': fitMode === 'actual-size'
      }">
        <!-- Corrupted Image Placeholder -->
        <div v-if="isImageCorrupted" class="corrupted-placeholder">
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
        <img v-else-if="activeImage" ref="imageElement" :src="activeImage.assetUrl" :alt="activeImage.name" class="main-image"
          :class="{ 'fit-to-window': fitMode === 'fit-to-window' }" :style="{
            transform: fitMode === 'actual-size'
              ? `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`
              : 'none'
          }" @load="onImageLoad" @error="onImageError" @dragstart.prevent />

      </div>

      <!-- Zoom Controls -->
      <div class="zoom-controls" v-if="activeImage">
        <div class="zoom-info">
          <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <span class="fit-mode">{{ fitMode === 'fit-to-window' ? 'Fit' : 'Actual' }}</span>
        </div>
        <div class="zoom-buttons">
          <button @click="zoomOut" class="zoom-btn" :disabled="fitMode === 'fit-to-window'"
            title="Zoom out (Ctrl/Cmd -)">
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
          <span class="image-name">{{ currentFileEntry?.name || activeImage?.name || 'Unknown' }}</span>
          <span class="image-details" v-if="!isImageCorrupted && activeImage">
            {{ activeImage.dimensions.width }}×{{ activeImage.dimensions.height }} •
            {{ formatFileSize(activeImage.fileSize) }}
          </span>
          <span class="image-details corrupted-status" v-else-if="isImageCorrupted">
            Corrupted • Unable to load
          </span>
          <span class="folder-position" v-if="currentFolderSize > 1">
            {{ currentImageIndex + 1 }} of {{ currentFolderSize }}
          </span>
        </div>
        <div class="navigation-controls">
          <button @click="previousImage" :disabled="currentFolderSize <= 1" class="nav-btn"
            title="Previous image (←)">
            ← Prev
          </button>
          <button @click="nextImage" :disabled="currentFolderSize <= 1" class="nav-btn" title="Next image (→)">
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
    <div v-if="contextMenuVisible" class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }">
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import type { ImageData, TabData, SessionData, FolderContext, FileEntry } from '../types'
import { KEYBOARD_SHORTCUTS, matchesShortcut } from '../config/keyboardShortcuts'
import { sessionService } from '../services/sessionService'
import { memoryManager, ManagedResource } from '../utils/memoryManager'
import { lazyImageLoader } from '../utils/lazyLoader'

// Props and Emits
const emit = defineEmits<{
  openImageRequested: []
}>()

// Reactive state
const tabs = ref<Map<string, TabData>>(new Map())
const activeTabId = ref<string | null>(null)
const currentFolderImages = ref<ImageData[]>([])
const imageContainer = ref<HTMLElement>()
const tabContainer = ref<HTMLElement>()
const treeItemsContainer = ref<HTMLElement>()

// Lazy loading state
const tabFolderContexts = ref<Map<string, FolderContext>>(new Map())
const currentFileEntry = ref<FileEntry | null>(null) // Track current file even if corrupted

// Performance and memory management
const managedResources: ManagedResource[] = []
const preloadedImages = ref<Set<string>>(new Set())

// Navigation state for handling rapid navigation
const navigationInProgress = ref(false)
const pendingNavigationDirection = ref<'next' | 'prev' | null>(null)
const navigationQueue = ref<Array<'next' | 'prev'>>([])
const MAX_NAVIGATION_QUEUE_DEPTH = 3 // Maximum number of pending navigations
const navigationSequenceId = ref(0)
const lastKeyPressTime = ref(0)
const KEY_REPEAT_THRESHOLD = 50 // ms - minimum time between key presses to prevent excessive queuing

// Zoom and pan state
const zoomLevel = ref(1)
const fitMode = ref<'fit-to-window' | 'actual-size'>('fit-to-window')
const panOffset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const imageElement = ref<HTMLImageElement>()

// Tab layout state
const tabLayoutMode = ref<'invisible' | 'top-small' | 'top-large' | 'tree-small' | 'tree-large'>('tree-small')
const treeCollapsed = ref(false)




// Computed properties
const activeImage = computed(() => {
  if (!activeTabId.value) return null
  const tab = tabs.value.get(activeTabId.value)
  return tab?.imageData || null
})

const currentImageIndex = computed(() => {
  if (!activeTabId.value) return -1
  const folderContext = tabFolderContexts.value.get(activeTabId.value)
  if (!folderContext) return -1

  // Use currentFileEntry if available (works for corrupted images too)
  if (currentFileEntry.value) {
    return folderContext.fileEntries.findIndex(entry => entry.path === currentFileEntry.value!.path)
  }

  // Fallback to activeImage
  if (activeImage.value) {
    return folderContext.fileEntries.findIndex(entry => entry.path === activeImage.value!.path)
  }

  return -1
})

const currentFolderSize = computed(() => {
  if (!activeTabId.value) return 0
  const folderContext = tabFolderContexts.value.get(activeTabId.value)
  return folderContext ? folderContext.fileEntries.length : 0
})

const sortedTabs = computed(() => {
  return Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
})

const isImageCorrupted = computed(() => {
  // Image is corrupted if we have a file entry but no valid assetUrl (empty string indicates corrupted)
  return currentFileEntry.value !== null && activeImage.value !== null && activeImage.value.assetUrl === ''
})

// Helper function to scroll the active tab into view (centered)
const scrollActiveTabIntoView = () => {
  if (!activeTabId.value) return

  // Use nextTick to ensure the DOM has updated with the active class
  nextTick(() => {
    // Handle tree modes (vertical scrolling)
    if ((tabLayoutMode.value === 'tree-small' || tabLayoutMode.value === 'tree-large') && treeItemsContainer.value) {
      const activeTreeItem = treeItemsContainer.value.querySelector('.tree-item.active') as HTMLElement
      if (!activeTreeItem) return

      const containerHeight = treeItemsContainer.value.offsetHeight
      const itemTop = activeTreeItem.offsetTop
      const itemHeight = activeTreeItem.offsetHeight

      // Calculate scroll position to center the active item vertically
      const scrollPosition = itemTop - (containerHeight / 2) + (itemHeight / 2)

      // Smooth scroll to the calculated position
      treeItemsContainer.value.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      })
    }
    // Handle horizontal tab bar modes
    else if (tabContainer.value) {
      const activeTabElement = tabContainer.value.querySelector('.tab.active') as HTMLElement
      if (!activeTabElement) return

      const containerWidth = tabContainer.value.offsetWidth
      const tabLeft = activeTabElement.offsetLeft
      const tabWidth = activeTabElement.offsetWidth

      // Calculate scroll position to center the active tab horizontally
      const scrollPosition = tabLeft - (containerWidth / 2) + (tabWidth / 2)

      // Smooth scroll to the calculated position
      tabContainer.value.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      })
    }
  })
}

// Helper function to load image metadata on-demand
const loadImageMetadata = async (filePath: string, folderContext: FolderContext): Promise<ImageData | null> => {
  // Check if already loaded in cache
  if (folderContext.loadedImages.has(filePath)) {
    return folderContext.loadedImages.get(filePath)!
  }

  try {
    // Load image metadata from backend
    const rawData = await invoke<any>('read_image_file', { path: filePath })
    const imageData: ImageData = {
      id: rawData.id,
      name: rawData.name,
      path: rawData.path,
      assetUrl: convertFileSrc(rawData.path),
      dimensions: rawData.dimensions,
      fileSize: rawData.file_size,
      lastModified: new Date(rawData.last_modified)
    }

    // Cache it for future use
    folderContext.loadedImages.set(filePath, imageData)
    return imageData
  } catch (error) {
    console.error(`Failed to load image metadata for ${filePath}:`, error)
    return null
  }
}


// Methods
const openImage = (imageData: ImageData, folderContext: FolderContext) => {
  // Create a new tab for this image
  const tabId = `tab-${Date.now()}`
  const tab: TabData = {
    id: tabId,
    title: imageData.name,
    imageData,
    isActive: true,
    order: getNextTabOrder(),
    isFullyLoaded: true // New tabs are always fully loaded
  }

  // Set all existing tabs to inactive
  tabs.value.forEach(existingTab => {
    existingTab.isActive = false
  })

  // Add the new tab
  tabs.value.set(tabId, tab)
  activeTabId.value = tabId

  // Scroll the new tab into view
  scrollActiveTabIntoView()

  // Store folder context for this tab
  tabFolderContexts.value.set(tabId, folderContext)

  // Set current file entry
  const fileEntry = folderContext.fileEntries.find(entry => entry.path === imageData.path)
  currentFileEntry.value = fileEntry || null

  // Update currentFolderImages with loaded images only
  currentFolderImages.value = Array.from(folderContext.loadedImages.values())
    .sort((a, b) => a.name.localeCompare(b.name))

  // Preload adjacent images for better performance
  preloadAdjacentImagesLazy(imageData, folderContext)

  console.log(`✨ Opened image: ${imageData.name}`)
  console.log(`📁 Folder contains ${folderContext.fileEntries.length} images (${folderContext.loadedImages.size} loaded)`)
}

const switchToTab = async (tabId: string) => {
  const tab = tabs.value.get(tabId)
  if (!tab) return

  // Update active states
  tabs.value.forEach(t => { t.isActive = false })
  tab.isActive = true
  activeTabId.value = tabId

  // Scroll the active tab into view (centered)
  scrollActiveTabIntoView()

  // Reset zoom and pan when switching tabs
  resetImageView()

  // Load folder context for this tab if needed (lazy loading)
  if (!tab.isFullyLoaded) {
    console.log(`🔄 Loading tab on-demand: ${tab.title}`)
    await loadFolderContextForTab(tab)
    tab.isFullyLoaded = true
    console.log(`✅ Tab loaded: ${tab.title}`)
  } else {
    // Already loaded, just update current folder images
    await loadFolderContextForTab(tab)
  }

  // Set current file entry for the active tab
  const folderContext = tabFolderContexts.value.get(tabId)
  if (folderContext && tab.imageData?.path) {
    const fileEntry = folderContext.fileEntries.find(entry => entry.path === tab.imageData.path)
    currentFileEntry.value = fileEntry || null
  }

  // Preload adjacent images in the new tab's context
  nextTick(() => {
    if (folderContext && tab.imageData) {
      preloadAdjacentImagesLazy(tab.imageData, folderContext)
    }
  })

  // Preload adjacent tabs in background
  preloadAdjacentTabs(tabId)
}

const loadFolderContextForTab = async (tab: TabData) => {
  // Check if we already have folder context for this tab
  if (tabFolderContexts.value.has(tab.id)) {
    const folderContext = tabFolderContexts.value.get(tab.id)!
    currentFolderImages.value = Array.from(folderContext.loadedImages.values())
      .sort((a, b) => a.name.localeCompare(b.name))
    return
  }

  // Load folder context for this tab's image with lazy loading
  try {
    const imagePath = tab.imageData.path
    // Handle both Windows (\) and Unix (/) path separators
    const lastSeparatorIndex = Math.max(imagePath.lastIndexOf('/'), imagePath.lastIndexOf('\\'))
    const folderPath = imagePath.substring(0, lastSeparatorIndex)

    const folderEntries = await invoke<any[]>('browse_folder', { path: folderPath })

    // Filter and transform to FileEntry format
    const imageFileEntries = folderEntries
      .filter(entry => entry.is_image)
      .map(entry => ({
        name: entry.name,
        path: entry.path,
        isDirectory: false,
        isImage: true,
        size: entry.size,
        lastModified: entry.last_modified ? new Date(entry.last_modified) : undefined
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Create folder context with the current image already loaded
    const loadedImages = new Map<string, ImageData>()
    loadedImages.set(imagePath, tab.imageData)

    const folderContext: FolderContext = {
      fileEntries: imageFileEntries,
      loadedImages,
      folderPath
    }

    const selectedIndex = imageFileEntries.findIndex(entry => entry.path === imagePath)
    if (selectedIndex !== -1) {
      const PRELOAD_RANGE = 2 // Reduced from 3 to 2 for faster initial load
      const startIndex = Math.max(0, selectedIndex - PRELOAD_RANGE)
      const endIndex = Math.min(imageFileEntries.length - 1, selectedIndex + PRELOAD_RANGE)

      // Start preloading adjacent images in background (non-blocking)
      const adjacentLoadPromises: Promise<void>[] = []
      for (let i = startIndex; i <= endIndex; i++) {
        if (i !== selectedIndex) {
          const entry = imageFileEntries[i]
          if (entry) {
            adjacentLoadPromises.push(
              loadImageMetadata(entry.path, folderContext)
                .then(() => {})
                .catch(err => {
                  // Silently skip corrupted images during preloading
                  console.warn(`Skipping corrupted image during folder context preload: ${entry.path}`, err)
                })
            )
          }
        }
      }

      // Fire and forget - don't wait for preloading to complete (non-blocking)
      Promise.allSettled(adjacentLoadPromises).then(() => {
        console.log(`✅ Background preloaded ${adjacentLoadPromises.length} adjacent images for tab`)
      })
    }

    // Store folder context for this tab
    tabFolderContexts.value.set(tab.id, folderContext)
    currentFolderImages.value = Array.from(folderContext.loadedImages.values())
      .sort((a, b) => a.name.localeCompare(b.name))

    console.log(`📁 Loaded folder context for tab (${folderContext.loadedImages.size}/${imageFileEntries.length} images)`)
  } catch (error) {
    console.error('Failed to load folder context for tab:', error)
    currentFolderImages.value = [tab.imageData] // Fallback to just the current image
  }
}

const preloadAdjacentTabs = async (currentTabId: string) => {
  // Find the current tab in sorted order
  const sorted = sortedTabs.value
  const currentIndex = sorted.findIndex(tab => tab.id === currentTabId)

  if (currentIndex === -1) return

  // Determine which tabs to preload (±2 from current)
  const PRELOAD_TAB_RANGE = 2
  const startIndex = Math.max(0, currentIndex - PRELOAD_TAB_RANGE)
  const endIndex = Math.min(sorted.length - 1, currentIndex + PRELOAD_TAB_RANGE)

  const tabsToPreload: TabData[] = []
  for (let i = startIndex; i <= endIndex; i++) {
    if (i !== currentIndex) {
      const tab = sorted[i]
      // Only preload if not already fully loaded
      if (tab && !tab.isFullyLoaded) {
        tabsToPreload.push(tab)
      }
    }
  }

  if (tabsToPreload.length === 0) return

  console.log(`🔄 Preloading ${tabsToPreload.length} adjacent tabs in background...`)

  // Load tabs in parallel (non-blocking)
  const preloadPromises = tabsToPreload.map(async (tab) => {
    try {
      await loadFolderContextForTab(tab)
      tab.isFullyLoaded = true
      console.log(`✅ Preloaded tab: ${tab.title}`)
    } catch (error) {
      console.warn(`Failed to preload tab: ${tab.title}`, error)
    }
  })

  // Don't await - let this happen in background
  Promise.all(preloadPromises).catch(err => {
    console.warn('Some tabs failed to preload:', err)
  })
}

const closeTab = (tabId: string) => {
  const tabToClose = tabs.value.get(tabId)
  if (!tabToClose) return

  // Clean up resources for this tab
  cleanupTabResources(tabId)

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
  // If navigation is in progress, queue this navigation with max depth
  if (navigationInProgress.value) {
    // Only queue if under max depth
    if (navigationQueue.value.length < MAX_NAVIGATION_QUEUE_DEPTH) {
      // Optimize: if last queued is same direction, don't add duplicate
      const lastQueued = navigationQueue.value[navigationQueue.value.length - 1]
      if (lastQueued !== 'next') {
        navigationQueue.value.push('next')
      }
    } else {
      console.warn('⚠️ Navigation queue full, skipping request')
    }
    return
  }

  await performNavigation('next')
}

const previousImage = async () => {
  // If navigation is in progress, queue this navigation with max depth
  if (navigationInProgress.value) {
    // Only queue if under max depth
    if (navigationQueue.value.length < MAX_NAVIGATION_QUEUE_DEPTH) {
      // Optimize: if last queued is same direction, don't add duplicate
      const lastQueued = navigationQueue.value[navigationQueue.value.length - 1]
      if (lastQueued !== 'prev') {
        navigationQueue.value.push('prev')
      }
    } else {
      console.warn('⚠️ Navigation queue full, skipping request')
    }
    return
  }

  await performNavigation('prev')
}

// Core navigation function with race condition prevention
const performNavigation = async (direction: 'next' | 'prev') => {
  if (!activeTabId.value) return

  const folderContext = tabFolderContexts.value.get(activeTabId.value)
  if (!folderContext || folderContext.fileEntries.length <= 1) return

  // Mark navigation as in progress
  navigationInProgress.value = true
  const currentSequenceId = ++navigationSequenceId.value

  try {
    // Find current file entry index (works even if current image is corrupted)
    let currentIndex = -1

    // First try to use currentFileEntry (works for both valid and corrupted images)
    if (currentFileEntry.value) {
      currentIndex = folderContext.fileEntries.findIndex(entry => entry.path === currentFileEntry.value!.path)
    } else if (activeImage.value) {
      // Fallback to activeImage if currentFileEntry is not set
      currentIndex = folderContext.fileEntries.findIndex(entry => entry.path === activeImage.value!.path)
    }

    // If we still can't find current position, default to -1 so navigation starts from beginning
    if (currentIndex === -1) {
      currentIndex = direction === 'next' ? -1 : 0
    }

    // Calculate target index based on direction
    let targetIndex: number
    if (direction === 'next') {
      targetIndex = (currentIndex + 1) % folderContext.fileEntries.length
    } else {
      targetIndex = currentIndex === 0 ? folderContext.fileEntries.length - 1 : currentIndex - 1
    }

    const targetEntry = folderContext.fileEntries[targetIndex]
    if (!targetEntry) return

    // Load image metadata if not already loaded (may return null for corrupted images)
    const targetImageData = await loadImageMetadata(targetEntry.path, folderContext)

    // Check if this navigation is still valid (no newer navigation started)
    if (currentSequenceId !== navigationSequenceId.value) {
      console.log('Navigation cancelled - newer navigation in progress')
      return
    }

    // Update tab with new image or corrupted entry
    await updateCurrentTabImage(targetImageData, targetEntry)

    // Preload adjacent images for smooth navigation (non-blocking)
    if (targetImageData) {
      preloadAdjacentImagesLazy(targetImageData, folderContext).catch(err =>
        console.warn('Preload failed:', err)
      )
    }
  } finally {
    navigationInProgress.value = false

    // Process navigation queue (newer approach with max depth)
    if (navigationQueue.value.length > 0) {
      const nextDirection = navigationQueue.value.shift()
      if (nextDirection) {
        // Use nextTick to avoid deep recursion
        nextTick(() => performNavigation(nextDirection))
      }
    }
    // Fallback to old pending navigation for compatibility
    else if (pendingNavigationDirection.value) {
      const nextDirection = pendingNavigationDirection.value
      pendingNavigationDirection.value = null
      // Use nextTick to avoid deep recursion
      nextTick(() => performNavigation(nextDirection))
    }
  }
}

const updateCurrentTabImage = async (newImageData: ImageData | null, fileEntry: FileEntry) => {
  if (!activeTabId.value) return

  const activeTab = tabs.value.get(activeTabId.value)
  if (!activeTab) return

  // Update current file entry (works for both valid and corrupted images)
  currentFileEntry.value = fileEntry

  if (newImageData) {
    // Valid image - update tab with image data
    activeTab.imageData = newImageData
    activeTab.title = newImageData.name
    console.log(`Navigated to: ${newImageData.name}`)
  } else {
    // Corrupted image - create a placeholder ImageData with safe defaults
    const placeholderImageData: ImageData = {
      id: `corrupted-${fileEntry.path}`,
      name: fileEntry.name,
      path: fileEntry.path,
      assetUrl: '', // Empty URL for corrupted images
      dimensions: { width: 0, height: 0 },
      fileSize: fileEntry.size || 0,
      lastModified: fileEntry.lastModified || new Date()
    }
    activeTab.imageData = placeholderImageData
    activeTab.title = fileEntry.name
    console.log(`Navigated to corrupted image: ${fileEntry.name}`)
  }

  // Reset zoom and pan when changing images
  resetImageView()
}

const openNewImage = () => {
  console.log('🎯 openNewImage called - emitting openImageRequested')
  emit('openImageRequested')
}

// Enhanced tab management functions
const openImageInNewTab = async () => {
  if (!activeTabId.value) return

  const folderContext = tabFolderContexts.value.get(activeTabId.value)
  if (!folderContext || folderContext.fileEntries.length <= 1) return

  const currentIndex = currentImageIndex.value
  const nextIndex = (currentIndex + 1) % folderContext.fileEntries.length
  const nextEntry = folderContext.fileEntries[nextIndex]
  if (!nextEntry) return

  // Load next image metadata (may be null if corrupted)
  const nextImageData = await loadImageMetadata(nextEntry.path, folderContext)

  // Create a new tab even if image is corrupted
  const tabId = `tab-${Date.now()}`

  // Create proper placeholder for corrupted images
  const imageData: ImageData = nextImageData || {
    id: `corrupted-${nextEntry.path}`,
    name: nextEntry.name,
    path: nextEntry.path,
    assetUrl: '',
    dimensions: { width: 0, height: 0 },
    fileSize: nextEntry.size || 0,
    lastModified: nextEntry.lastModified || new Date()
  }

  const tab: TabData = {
    id: tabId,
    title: nextEntry.name,
    imageData: imageData,
    isActive: true, // Switch to the new tab immediately
    order: getNextTabOrder()
  }

  // Set all existing tabs to inactive
  tabs.value.forEach(existingTab => {
    existingTab.isActive = false
  })

  tabs.value.set(tabId, tab)
  const oldActiveTabId = activeTabId.value
  activeTabId.value = tabId

  // Scroll the new tab into view
  scrollActiveTabIntoView()

  // Create a NEW folder context for the new tab (deep clone to avoid shared references)
  const currentFolderContext = tabFolderContexts.value.get(oldActiveTabId)
  if (currentFolderContext) {
    // Deep clone the folder context to avoid memory leaks from shared references
    const newFolderContext: FolderContext = {
      fileEntries: currentFolderContext.fileEntries, // fileEntries are read-only, can share
      loadedImages: new Map(currentFolderContext.loadedImages), // Clone the Map
      folderPath: currentFolderContext.folderPath
    }
    tabFolderContexts.value.set(tabId, newFolderContext)
    currentFolderImages.value = Array.from(newFolderContext.loadedImages.values())
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Set current file entry for the new tab
  currentFileEntry.value = nextEntry

  console.log(`Opened ${nextEntry.name} in new tab and switched to it`)
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
  // Image is already loaded - no need for lazy loading setup here
}

const onImageError = () => {
  console.error('Failed to load image')
}

// Debouncing for preload operations
let preloadTimeoutId: number | null = null
let lastPreloadImagePath: string | null = null

// Performance optimization methods with lazy loading and adaptive preloading
const preloadAdjacentImagesLazy = async (currentImage: ImageData, folderContext: FolderContext) => {
  const currentIndex = folderContext.fileEntries.findIndex(entry => entry.path === currentImage.path)
  if (currentIndex === -1) return

  // Debouncing: If already preloading for the same image, skip
  if (lastPreloadImagePath === currentImage.path) {
    return
  }

  // Cancel any pending preload operations
  if (preloadTimeoutId !== null) {
    clearTimeout(preloadTimeoutId)
    preloadTimeoutId = null
  }

  // Cancel any in-flight image loads from previous navigation
  lazyImageLoader.cancelPendingRequests()

  lastPreloadImagePath = currentImage.path

  // Adaptive preload range based on folder size and memory
  const PRELOAD_RANGE = getAdaptivePreloadRange(folderContext.fileEntries.length)
  const startIndex = Math.max(0, currentIndex - PRELOAD_RANGE)
  const endIndex = Math.min(folderContext.fileEntries.length - 1, currentIndex + PRELOAD_RANGE)

  // Check memory before preloading
  if (memoryManager.isMemoryUsageHigh()) {
    console.warn('⚠️ High memory usage, skipping preload')
    return
  }

  const preloadPromises: Promise<void>[] = []
  const preloadUrls: string[] = []

  for (let i = startIndex; i <= endIndex; i++) {
    if (i !== currentIndex) {
      const entry = folderContext.fileEntries[i]
      if (entry) {
        // Load metadata if not already loaded
        const loadPromise = loadImageMetadata(entry.path, folderContext).then(imageData => {
          if (imageData && !preloadedImages.value.has(imageData.assetUrl)) {
            preloadUrls.push(imageData.assetUrl)
            preloadedImages.value.add(imageData.assetUrl)
          }
        }).catch(() => {
          // Silently handle corrupted images during preload
          console.warn(`Skipping corrupted image during preload: ${entry.path}`)
        })

        preloadPromises.push(loadPromise)
      }
    }
  }

  // Fire and forget - don't wait for metadata loading (non-blocking)
  Promise.allSettled(preloadPromises).then(() => {
    if (preloadUrls.length > 0) {
      lazyImageLoader.preloadImages(preloadUrls, 'low')
      console.log(`🖼️ Started browser-level preload for ${preloadUrls.length} images`)
    }
  })
}

// Adaptive preload range based on folder size and memory
const getAdaptivePreloadRange = (folderSize: number): number => {
  // Check memory usage
  const memoryUsage = memoryManager.getMemoryUsage()
  if (memoryUsage) {
    const usageRatio = memoryUsage.used / memoryUsage.limit
    if (usageRatio > 0.7) {
      return 2 // Very conservative when memory is high
    }
  }

  // Adjust based on folder size
  if (folderSize > 5000) {
    return 3 // Very large folders
  } else if (folderSize > 1000) {
    return 5 // Large folders (default for user's choice)
  } else if (folderSize > 500) {
    return 7 // Medium folders
  } else {
    return 10 // Small folders - can afford more preloading
  }
}

const cleanupTabResources = (tabId: string) => {
  const tab = tabs.value.get(tabId)
  if (!tab) return

  // Get the folder context for this tab
  const folderContext = tabFolderContexts.value.get(tabId)

  // Clean up ALL preloaded images for this tab's folder context, not just the current image
  if (folderContext) {
    // Remove all loaded images from this folder's context
    for (const [, imageData] of folderContext.loadedImages.entries()) {
      // Remove from preloaded images set
      preloadedImages.value.delete(imageData.assetUrl)

      // Remove from memory manager cache
      memoryManager.removeCachedImage(imageData.assetUrl)
    }

    // Clear the loaded images map for this folder
    folderContext.loadedImages.clear()
  }

  // Also remove the current tab's image
  preloadedImages.value.delete(tab.imageData.assetUrl)
  memoryManager.removeCachedImage(tab.imageData.assetUrl)

  // Cancel any pending preload requests
  lazyImageLoader.cancelPendingRequests()

  console.log(`✅ Cleaned up all resources for tab: ${tab.title}`)
}

const optimizeMemoryUsage = () => {
  // Check if memory usage is high
  if (memoryManager.isMemoryUsageHigh()) {
    console.warn('High memory usage detected, performing cleanup')

    // Clear preloaded images that aren't currently visible
    const visibleUrls = new Set<string>()
    tabs.value.forEach(tab => {
      visibleUrls.add(tab.imageData.assetUrl)
    })

    for (const url of preloadedImages.value) {
      if (!visibleUrls.has(url)) {
        memoryManager.removeCachedImage(url)
        preloadedImages.value.delete(url)
      }
    }

    // Force garbage collection if available
    memoryManager.forceGarbageCollection()
  }
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

// Tab layout toggle
const toggleTabLayout = () => {
  const modes: Array<'invisible' | 'top-small' | 'top-large' | 'tree-small' | 'tree-large'> = ['invisible', 'top-small', 'top-large', 'tree-small', 'tree-large']
  const currentIndex = modes.indexOf(tabLayoutMode.value)
  const nextIndex = (currentIndex + 1) % modes.length
  tabLayoutMode.value = modes[nextIndex]
  console.log(`Tab layout changed to: ${tabLayoutMode.value}`)
}

// Toggle tree panel collapsed state
const toggleTreeCollapse = () => {
  treeCollapsed.value = !treeCollapsed.value
  console.log(`Tree ${treeCollapsed.value ? 'collapsed' : 'expanded'}`)
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

    // Throttle rapid key repeats for navigation actions
    if (matchingShortcut.action === 'nextImage' || matchingShortcut.action === 'previousImage') {
      const now = Date.now()
      const timeSinceLastPress = now - lastKeyPressTime.value

      // If key is being held down (rapid repeat), throttle to avoid queuing too many navigations
      if (event.repeat && timeSinceLastPress < KEY_REPEAT_THRESHOLD) {
        return // Skip this repeat event
      }

      lastKeyPressTime.value = now
    }

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

  // Setup memory optimization interval
  const memoryOptimizationResource = new ManagedResource(() => {
    clearInterval(memoryOptimizationInterval)
  })
  managedResources.push(memoryOptimizationResource)

  const memoryOptimizationInterval = setInterval(optimizeMemoryUsage, 60000) // Every minute
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)

  // Cleanup all managed resources
  managedResources.forEach(resource => resource.cleanup())
  managedResources.length = 0

  // Clear all cached data
  preloadedImages.value.clear()
  tabFolderContexts.value.clear()
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

    let activeTabIdToLoad: string | null = null

    // Phase 1: Restore all tabs with minimal loading in parallel (just verify files exist)
    console.log(`Loading metadata for ${sessionData.tabs.length} tabs in parallel...`)

    const tabLoadPromises = sessionData.tabs.map(async (sessionTab) => {
      try {
        const isActiveTab = sessionTab.id === sessionData.activeTabId

        // Load basic image data for all tabs (lightweight operation)
        const imageData = await invoke<any>('read_image_file', { path: sessionTab.imagePath })

        const restoredImageData: ImageData = {
          id: imageData.id,
          name: imageData.name,
          path: imageData.path,
          assetUrl: convertFileSrc(imageData.path),
          dimensions: imageData.dimensions,
          fileSize: imageData.file_size,
          lastModified: new Date(imageData.last_modified)
        }

        // Create tab with restored data
        const tab: TabData = {
          id: sessionTab.id,
          title: restoredImageData.name,
          imageData: restoredImageData,
          isActive: isActiveTab,
          order: sessionTab.order,
          isFullyLoaded: false // Mark as not fully loaded yet
        }

        return { tab, isActiveTab }
      } catch (error) {
        console.warn(`Failed to restore image: ${sessionTab.imagePath}`, error)
        // Return null for failed tabs
        return null
      }
    })

    // Wait for all tabs to load in parallel
    const tabResults = await Promise.all(tabLoadPromises)

    // Add all successfully loaded tabs to the map
    for (const result of tabResults) {
      if (result) {
        tabs.value.set(result.tab.id, result.tab)
        if (result.isActiveTab) {
          activeTabIdToLoad = result.tab.id
        }
        console.log(`Restored tab (lazy): ${result.tab.title}`)
      }
    }

    console.log(`✅ All ${tabs.value.size} tabs restored in parallel`)

    // Phase 2: Fully load only the active tab (MINIMAL LOADING for fast startup)
    if (activeTabIdToLoad && tabs.value.has(activeTabIdToLoad)) {
      activeTabId.value = activeTabIdToLoad
      const activeTab = tabs.value.get(activeTabIdToLoad)
      if (activeTab) {
        activeTab.isActive = true

        // CRITICAL: Only load folder context WITHOUT preloading adjacent images
        // This makes session restore much faster on network drives
        const imagePath = activeTab.imageData.path
        const lastSeparatorIndex = Math.max(imagePath.lastIndexOf('/'), imagePath.lastIndexOf('\\'))
        const folderPath = imagePath.substring(0, lastSeparatorIndex)

        try {
          const folderEntries = await invoke<any[]>('browse_folder', { path: folderPath })
          const imageFileEntries = folderEntries
            .filter(entry => entry.is_image)
            .map(entry => ({
              name: entry.name,
              path: entry.path,
              isDirectory: false,
              isImage: true,
              size: entry.size,
              lastModified: entry.last_modified ? new Date(entry.last_modified) : undefined
            }))
            .sort((a, b) => a.name.localeCompare(b.name))

          // Create minimal folder context with only the current image
          const loadedImages = new Map<string, ImageData>()
          loadedImages.set(imagePath, activeTab.imageData)

          const folderContext: FolderContext = {
            fileEntries: imageFileEntries,
            loadedImages,
            folderPath
          }

          tabFolderContexts.value.set(activeTab.id, folderContext)
          currentFolderImages.value = Array.from(folderContext.loadedImages.values())
            .sort((a, b) => a.name.localeCompare(b.name))

          activeTab.isFullyLoaded = true
          console.log(`✅ Active tab loaded (minimal, no preload): ${activeTab.title}`)
        } catch (error) {
          console.error('Failed to load folder for active tab:', error)
          // Still mark as loaded so we don't retry indefinitely
          activeTab.isFullyLoaded = true
        }
      }
    } else if (tabs.value.size > 0) {
      // If the original active tab doesn't exist, activate the first available tab
      const firstTab = Array.from(tabs.value.values())[0]
      if (firstTab) {
        activeTabId.value = firstTab.id
        firstTab.isActive = true
        firstTab.isFullyLoaded = true
        activeTabIdToLoad = firstTab.id
        console.log(`✅ First tab activated (deferred loading): ${firstTab.title}`)
      }
    }

    console.log(`⚡ Session restored FAST with ${tabs.value.size} tabs (minimal loading, no preload)`)

    // Scroll the active tab into view after restoration
    if (activeTabIdToLoad) {
      scrollActiveTabIntoView()
    }

    // Phase 3: Background load other tabs and preload - FULLY NON-BLOCKING
    // This happens after the UI is already responsive
    if (activeTabIdToLoad) {
      // Use nextTick to ensure this happens after UI update
      nextTick(() => {
        // Fire and forget - background preload adjacent tabs
        preloadAdjacentTabs(activeTabIdToLoad).catch(err => {
          console.warn('Background tab preload failed:', err)
        })
      })
    }
  } catch (error) {
    console.error('Failed to restore session:', error)
    throw error
  }
}

const saveAutoSession = async () => {
  console.log('saveAutoSession called, tabs count:', tabs.value.size)

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

const saveSessionDialog = async () => {
  console.log('saveSessionDialog called')

  if (tabs.value.size === 0) {
    console.log('No tabs to save')
    return false
  }

  try {
    const sessionData = createSessionData()
    console.log('Created session data for dialog save:', sessionData)
    const savedPath = await sessionService.saveSessionDialog(sessionData)
    if (savedPath) {
      console.log('Session saved to:', savedPath)
      return true
    } else {
      console.log('Session save cancelled by user')
      return false
    }
  } catch (error) {
    console.error('Failed to save session via dialog:', error)
    return false
  }
}

const loadSessionDialog = async () => {
  console.log('loadSessionDialog called')
  try {
    const sessionData = await sessionService.loadSessionDialog()
    console.log('Loaded session data from dialog:', sessionData)
    if (sessionData) {
      await restoreFromSession(sessionData)
      console.log('Session restored successfully from dialog')
      return true
    }
    console.log('No session data loaded (user cancelled)')
    return false
  } catch (error) {
    console.error('Failed to load session via dialog:', error)
    return false
  }
}

// Expose methods for parent component
defineExpose({
  openImage,
  saveAutoSession,
  loadAutoSession,
  saveSessionDialog,
  loadSessionDialog,
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

/* Tree layouts - horizontal split */
.image-viewer.layout-tree-small,
.image-viewer.layout-tree-large {
  flex-direction: row;
}

/* Tree Panel (Left Sidebar) */
.tree-panel {
  display: flex;
  flex-direction: column;
  min-width: 200px;
  max-width: 300px;
  width: fit-content;
  background: #2d2d2d;
  border-right: 1px solid #404040;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

/* Tree Panel - Collapsed State */
.tree-panel.collapsed {
  min-width: 60px;
  max-width: 60px;
  width: 60px;
}

.tree-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #404040;
  background: #2d2d2d;
}

.tree-collapse-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tree-collapse-btn:hover {
  background: #3d3d3d;
  color: white;
}

.tree-items {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #363636;
  user-select: none;
  white-space: nowrap;
}

/* Tree Item - Collapsed State (center thumbnails) */
.tree-panel.collapsed .tree-item {
  justify-content: center;
  padding: 8px;
}

.tree-item:hover {
  background: #3d3d3d;
}

.tree-item.active {
  background: #1a1a1a;
  border-left: 3px solid #007bff;
  padding-left: 9px; /* Compensate for border */
}

/* Adjust padding for collapsed active items */
.tree-panel.collapsed .tree-item.active {
  padding-left: 5px; /* Less compensation needed when centered */
}

.tree-item-thumbnail {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  display: block;
}

.tree-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: white;
}

/* Tree-Large specific styles (only when NOT collapsed) */
.image-viewer.layout-tree-large .tree-panel:not(.collapsed) .tree-item {
  padding: 12px;
  gap: 12px;
}

.image-viewer.layout-tree-large .tree-panel:not(.collapsed) .tree-item-thumbnail {
  width: 200px;
  height: 200px;
}

.image-viewer.layout-tree-large .tree-panel:not(.collapsed) {
  min-width: 250px;
  max-width: 350px;
}

.tab-bar {
  display: flex;
  background: #2d2d2d;
  border-bottom: 1px solid #404040;
  flex-shrink: 0;
}

/* Invisible layout - floating controls only */
.tab-bar.layout-invisible {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  background: transparent;
  border-bottom: none;
  width: auto;
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

.tab-thumbnail {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  display: block;
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

.new-tab-btn,
.layout-toggle-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 20px;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.new-tab-btn:hover,
.layout-toggle-btn:hover {
  background: #3d3d3d;
  color: white;
}

/* Style for invisible mode controls */
.tab-bar.layout-invisible .tab-controls {
  background: rgba(45, 45, 45, 0.9);
  border-radius: 6px;
  border: 1px solid #404040;
  backdrop-filter: blur(10px);
}

/* Top-Large layout - large previews (200x200px) */
.tab-bar.layout-top-large {
  min-height: 230px;
}

.tab-bar.layout-top-large .tab {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 220px;
  max-width: 240px;
  padding: 12px 8px;
  gap: 8px;
}

.tab-bar.layout-top-large .tab-thumbnail {
  width: 200px;
  height: 200px;
  margin: 0;
}

.tab-bar.layout-top-large .tab-title {
  text-align: center;
  font-size: 12px;
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

.corrupted-status {
  color: #ff6b6b !important;
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