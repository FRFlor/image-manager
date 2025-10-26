<template>
  <div class="image-viewer" :class="'layout-' + currentLayout">
    <TabBar
      @tabSwitched="switchToTab"
      @tabClosed="closeTab"
      @openNewImage="openNewImage"
      ref="tabBarRef"
    />

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
      <ZoomControls v-if="activeImage && controlsVisible"/>

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

    <!-- Group Grid Preview -->
    <div v-else-if="selectedGroupId && selectedGroupImages.length > 0" class="group-preview-container">
      <GroupGridPreview
        :groupName="getGroupName(selectedGroupId)"
        :images="selectedGroupImages"
        :tabIds="getGroupTabIds(selectedGroupId)"
        @imageSelected="handleGroupImageSelected"
        @nameChanged="(newName) => renameGroup(selectedGroupId!, newName)"
        @imageReordered="(direction, tabId) => moveTab(direction, tabId)" />
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

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import type { ImageData, TabData, SessionData, FolderContext, FileEntry, TabGroup } from '../types'
import GroupGridPreview from './GroupGridPreview.vue'
import TabBar from './TabBar.vue'
import ZoomControls from './ZoomControls.vue'
import { KEYBOARD_SHORTCUTS, matchesShortcut } from '../config/keyboardShortcuts'
import { sessionService } from '../services/sessionService'
import { memoryManager, ManagedResource } from '../utils/memoryManager'
import { lazyImageLoader } from '../utils/lazyLoader'
import { useTabControls } from '../composables/useTabControls'
import { useZoomControls } from '../composables/useZoomControls'

// Props and Emits
const emit = defineEmits<{
  openImageRequested: []
}>()


const {
  tabs,
  activeTabId,
  tabFolderContexts,
  tabGroups,
  selectedGroupId,
  activeTab,
  sortedTabs,
  layoutPosition,
  layoutSize,
  openTab,
  switchToTab: switchToTabBase,
  closeTab: closeTabBase,
  switchToNextTab: switchToNextTabBase,
  switchToPreviousTab: switchToPreviousTabBase,
  closeCurrentTab: closeCurrentTabBase,
  clearTabs,
  moveTab,
  moveTabRight: moveTabRightBase,
  moveTabLeft: moveTabLeftBase,
  renameGroup,
  getGroupName,
  getGroupTabIds,
  joinWithLeft,
  joinWithRight,
  setNextGroupColorIndex
} = useTabControls()

const {
  zoomLevel,
  fitMode,
  panOffset,
  isDragging,
  controlsVisible,
  zoomIn,
  zoomOut,
  resetZoom,

  loadZoomAndPanStateFromTab,
  saveZoomAndPanStateIntoTab,

  toggleFitMode,
  toggleControlsVisibility,
  handleWheel,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  resetImageView,
} = useZoomControls()

// Reactive state
const currentFolderImages = ref<ImageData[]>([])
const imageContainer = ref<HTMLElement>()
const tabBarRef = ref<InstanceType<typeof TabBar>>()

// Lazy loading state
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

const imageElement = ref<HTMLImageElement>()

// Computed properties
const activeImage = computed(() => {
  if (!activeTabId.value) return null
  return activeTab.value?.imageData || null
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

// Get images for the selected group
const selectedGroupImages = computed((): ImageData[] => {
  if (!selectedGroupId.value) return []

  const group = tabGroups.value.get(selectedGroupId.value)
  if (!group) return []

  // Get tabs and sort by order property to match visual tab order
  const groupTabs: TabData[] = []
  for (const tabId of group.tabIds) {
    const tab = tabs.value.get(tabId)
    if (tab) {
      groupTabs.push(tab)
    }
  }

  // Sort by order property (same as sortedTabs)
  groupTabs.sort((a, b) => a.order - b.order)

  return groupTabs.map(tab => tab.imageData)
})

const isImageCorrupted = computed(() => {
  // Image is corrupted if we have a file entry but no valid assetUrl (empty string indicates corrupted)
  return currentFileEntry.value !== null && activeImage.value !== null && activeImage.value.assetUrl === ''
})

// Computed property that combines position and size (unless invisible)
const currentLayout = computed(() => {
  if (layoutPosition.value === 'invisible') return 'invisible'
  return `${layoutPosition.value}-${layoutSize.value}` as 'top-small' | 'top-large' | 'tree-small' | 'tree-large'
})

// Helper function to scroll the active tab into view (centered)
const scrollActiveTabIntoView = () => {
  if (!activeTabId.value) return

  // Use nextTick to ensure the DOM has updated with the active class
  nextTick(() => {
    // Handle tree modes (vertical scrolling)
    if (layoutPosition.value === 'tree' && tabBarRef.value?.treeItemsContainer) {
      const treeItemsContainer = tabBarRef.value.treeItemsContainer
      const activeTreeItem = treeItemsContainer.querySelector('.tree-item.active') as HTMLElement
      if (!activeTreeItem) return

      const containerHeight = treeItemsContainer.offsetHeight
      const itemTop = activeTreeItem.offsetTop
      const itemHeight = activeTreeItem.offsetHeight

      // Calculate scroll position to center the active item vertically
      const scrollPosition = itemTop - (containerHeight / 2) + (itemHeight / 2)

      // Smooth scroll to the calculated position
      treeItemsContainer.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      })
    }
    // Handle horizontal tab bar modes
    else if (tabBarRef.value?.tabContainer) {
      const tabContainer = tabBarRef.value.tabContainer
      const activeTabElement = tabContainer.querySelector('.tab.active') as HTMLElement
      if (!activeTabElement) return

      const containerWidth = tabContainer.offsetWidth
      const tabLeft = activeTabElement.offsetLeft
      const tabWidth = activeTabElement.offsetWidth

      // Calculate scroll position to center the active tab horizontally
      const scrollPosition = tabLeft - (containerWidth / 2) + (tabWidth / 2)

      // Smooth scroll to the calculated position
      tabContainer.scrollTo({
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
  // Use composable to open tab
  openTab(imageData, folderContext)

  // Scroll the new tab into view
  scrollActiveTabIntoView()

  // Set current file entry
  const fileEntry = folderContext.fileEntries.find(entry => entry.path === imageData.path)
  currentFileEntry.value = fileEntry || null

  // Update currentFolderImages with loaded images only
  currentFolderImages.value = Array.from(folderContext.loadedImages.values())
    .sort((a, b) => a.name.localeCompare(b.name))

  // Preload adjacent images for better performance
  preloadAdjacentImagesLazy(imageData, folderContext)
}

const switchToTab = async (tabId: string) => {
  // Save current tab's zoom/pan state before switching
  const saveCurrentTabState = (currentTabId: string) => {
    const currentTab = tabs.value.get(currentTabId)
    if (currentTab) {
      saveZoomAndPanStateIntoTab(currentTab);
    }
  }

  // Use composable to switch tab
  const tab = switchToTabBase(tabId, saveCurrentTabState)
  if (!tab) return

  // Scroll the active tab into view (centered)
  scrollActiveTabIntoView()

  // Restore zoom and pan state for the new tab
  loadZoomAndPanStateFromTab(tab);

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
  // Clean up resources for this tab
  const cleanup = (id: string) => {
    cleanupTabResources(id)
  }

  // Use composable to close tab
  const newActiveTabId = closeTabBase(tabId, cleanup)

  if (newActiveTabId) {
    switchToTab(newActiveTabId)
  } else if (newActiveTabId === null) {
    currentFolderImages.value = []
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

  // Save current zoom/pan state before changing images
  saveZoomAndPanStateIntoTab(activeTab)

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

  const oldActiveTabId = activeTabId.value

  // Create a NEW folder context for the new tab (deep clone to avoid shared references)
  const currentFolderContext = tabFolderContexts.value.get(oldActiveTabId)
  if (currentFolderContext) {
    const newFolderContext: FolderContext = {
      fileEntries: currentFolderContext.fileEntries,
      loadedImages: new Map(currentFolderContext.loadedImages),
      folderPath: currentFolderContext.folderPath
    }

    // Use composable to open the new tab
    openTab(imageData, newFolderContext)

    // Scroll the new tab into view
    scrollActiveTabIntoView()

    // Set current file entry for the new tab
    currentFileEntry.value = nextEntry

    // Update currentFolderImages
    currentFolderImages.value = Array.from(newFolderContext.loadedImages.values())
      .sort((a, b) => a.name.localeCompare(b.name))

    console.log(`Opened ${nextEntry.name} in new tab and switched to it`)
  }
}

const switchToNextTab = () => {
  const nextTabId = switchToNextTabBase()
  if (nextTabId) {
    switchToTab(nextTabId)
  }
}

const switchToPreviousTab = () => {
  const prevTabId = switchToPreviousTabBase()
  if (prevTabId) {
    switchToTab(prevTabId)
  }
}

const createNewTab = () => {
  // Open file picker to create a new tab
  emit('openImageRequested')
}

const closeCurrentTab = () => {
  const tabIdToClose = closeCurrentTabBase()
  if (tabIdToClose) {
    closeTab(tabIdToClose)
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Tab reordering wrappers (use composable)
const moveTabRight = (tabId: string|null = null) => {
  moveTabRightBase(tabId)
}

const moveTabLeft = (tabId: string|null = null) => {
  moveTabLeftBase(tabId)
}

// Keep handleGroupImageSelected as it uses local switchToTab
const handleGroupImageSelected = (imageId: string): void => {
  // Find the tab with this image ID and switch to it
  for (const tab of tabs.value.values()) {
    if (tab.imageData.id === imageId) {
      switchToTab(tab.id)
      selectedGroupId.value = null
      break
    }
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

// Zoom and pan methods are now provided by useZoomControls composable

// toggleGroupCollapse is provided by the composable


// Enhanced keyboard navigation using configuration
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return // Don't handle keyboard shortcuts when typing in inputs
  }

  // Find matching shortcut from configuration
  console.log(`Keyboard event:`, {event})

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
      case 'joinWithLeft':
        joinWithLeft()
        break
      case 'joinWithRight':
        joinWithRight()
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
  // Save current tab's zoom/pan state before creating session
  if (activeTabId.value) {
    const currentTab = tabs.value.get(activeTabId.value)
    if (currentTab) {
      saveZoomAndPanStateIntoTab(currentTab)
    }
  }

  const tabArray = sortedTabs.value
  const sessionTabs = tabArray.map(tab => ({
    id: tab.id,
    imagePath: tab.imageData.path,
    order: tab.order,
    groupId: tab.groupId,
    zoomLevel: tab.zoomLevel,
    fitMode: tab.fitMode,
    panOffset: tab.panOffset
  }))

  // Save groups
  const groupsArray = Array.from(tabGroups.value.values())
  const sessionGroups = groupsArray.map(group => ({
    id: group.id,
    name: group.name,
    color: group.color,
    order: group.order,
    tabIds: [...group.tabIds],
    collapsed: group.collapsed
  }))

  console.log(`💾 Saving ${sessionGroups.length} groups to session:`, sessionGroups)

  return {
    tabs: sessionTabs,
    groups: sessionGroups.length > 0 ? sessionGroups : undefined,
    activeTabId: activeTabId.value,
    createdAt: new Date().toISOString()
  }
}

const restoreFromSession = async (sessionData: SessionData) => {
  try {
    // Clear existing tabs and groups using composable
    clearTabs()
    currentFolderImages.value = []

    // Import invoke here to avoid unused import warning
    const { invoke } = await import('@tauri-apps/api/core')

    let activeTabIdToLoad: string | null = null

    // Restore groups first (before tabs, so we can assign groupIds)
    if (sessionData.groups && sessionData.groups.length > 0) {
      console.log(`🎨 Restoring ${sessionData.groups.length} groups from session:`, sessionData.groups)
      for (const groupData of sessionData.groups) {
        const group: TabGroup = {
          id: groupData.id,
          name: groupData.name,
          color: groupData.color,
          order: groupData.order,
          tabIds: [...groupData.tabIds],
          collapsed: groupData.collapsed
        }
        tabGroups.value.set(group.id, group)
        console.log(`  ✓ Restored group "${group.name}" (${group.color}) with ${group.tabIds.length} tabs`)
      }

      // Update the nextGroupColorIndex to continue from where we left off
      setNextGroupColorIndex(sessionData.groups.length)

      console.log(`✅ Restored ${sessionData.groups.length} tab groups`)
    } else {
      console.log('ℹ️ No groups found in session data')
    }

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

        // Create tab with restored data including zoom/pan state and groupId
        const tab: TabData = {
          id: sessionTab.id,
          title: restoredImageData.name,
          imageData: restoredImageData,
          isActive: isActiveTab,
          order: sessionTab.order,
          groupId: sessionTab.groupId, // Restore group membership
          isFullyLoaded: false, // Mark as not fully loaded yet
          zoomLevel: sessionTab.zoomLevel,
          fitMode: sessionTab.fitMode,
          panOffset: sessionTab.panOffset
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

        // Restore zoom/pan state for the active tab
        loadZoomAndPanStateFromTab(activeTab);

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

        // Restore zoom/pan state for the first tab
        loadZoomAndPanStateFromTab(firstTab);

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
  restoreFromSession,
  toggleControls: toggleControlsVisibility
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

.group-preview-container {
  flex: 1;
  display: flex;
  overflow: hidden;
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
}
</style>