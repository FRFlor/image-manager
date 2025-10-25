<template>
  <div class="image-viewer" :class="'layout-' + currentLayout">
    <!-- Tree Panel (Left Sidebar) -->
    <div class="tree-panel" v-if="layoutPosition === 'tree'" :class="{ collapsed: treeCollapsed }">
      <div class="tree-controls">
        <button @click="toggleTreeCollapse" class="tree-collapse-btn" :title="treeCollapsed ? 'Expand tree' : 'Collapse tree'">
          <span v-if="treeCollapsed">→</span>
          <span v-else>←</span>
        </button>
        <button v-if="!treeCollapsed" @click="toggleLayoutPosition" class="layout-toggle-btn" :title="`Layout: ${layoutPosition}`">
          <span v-if="layoutPosition === 'tree'">▯</span>
        </button>
        <button v-if="!treeCollapsed" @click="toggleLayoutSize" class="size-toggle-btn" :title="`Size: ${layoutSize}`">
          <span v-if="layoutSize === 'small'">S</span>
          <span v-else>L</span>
        </button>
        <button v-if="!treeCollapsed" @click="openNewImage" class="new-tab-btn" title="Open new image">
          +
        </button>
      </div>
      <div class="tree-items" ref="treeItemsContainer">
        <template v-for="item in treeViewItems" :key="item.type === 'group' ? `group-${item.groupId}` : `tab-${item.tab!.id}`">
          <!-- Group Header -->
          <div
            v-if="item.type === 'group'"
            class="tree-group-header"
            :class="{
              active: selectedGroupId === item.groupId,
              'group-blue': getGroupColor(item.groupId!) === 'blue',
              'group-orange': getGroupColor(item.groupId!) === 'orange',
              collapsed: collapsedGroupIds.has(item.groupId!)
            }">
            <button @click.stop="toggleGroupCollapse(item.groupId!)" class="group-collapse-btn" :title="collapsedGroupIds.has(item.groupId!) ? 'Expand group' : 'Collapse group'">
              <span v-if="collapsedGroupIds.has(item.groupId!)">▶</span>
              <span v-else>▼</span>
            </button>
            <span v-if="!treeCollapsed" @click="selectGroupHeader(item.groupId!)" class="group-header-title">{{ getGroupName(item.groupId!) }}</span>
            <span v-else class="group-header-indicator"></span>
          </div>
          <!-- Tab Item -->
          <div
            v-else
            @click="switchToTab(item.tab!.id)"
            @contextmenu.prevent="showTabContextMenu($event, item.tab!.id)"
            class="tree-item"
            :class="{
              active: item.tab!.id === activeTabId,
              grouped: !!item.tab!.groupId
            }">
            <img v-if="item.tab!.imageData.assetUrl" :src="item.tab!.imageData.assetUrl" :alt="item.tab!.title" class="tree-item-thumbnail" />
            <span v-if="!treeCollapsed" class="tree-item-title">{{ item.tab!.title }}</span>
            <button v-if="!treeCollapsed" @click.stop="closeTab(item.tab!.id)" class="tree-item-close" :title="`Close ${item.tab!.title}`">
              ×
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Tab Navigation (Top Bar) -->
    <div class="tab-bar" :class="'layout-' + currentLayout" v-if="layoutPosition === 'top' || layoutPosition === 'invisible'">
      <div class="tab-container" ref="tabContainer" v-show="layoutPosition !== 'invisible'">
        <div
          v-for="tab in sortedTabs"
          :key="tab.id"
          @click="switchToTab(tab.id)"
          @contextmenu.prevent="showTabContextMenu($event, tab.id)"
          class="tab"
          :class="{
            active: tab.id === activeTabId,
            'group-blue': tab.groupId && getGroupColor(tab.groupId) === 'blue',
            'group-orange': tab.groupId && getGroupColor(tab.groupId) === 'orange'
          }">
          <img v-if="tab.imageData.assetUrl" :src="tab.imageData.assetUrl" :alt="tab.title" class="tab-thumbnail" />
          <span class="tab-title">{{ tab.title }}</span>
          <button @click.stop="closeTab(tab.id)" class="tab-close" :title="`Close ${tab.title}`">
            ×
          </button>
        </div>
      </div>
      <div class="tab-controls">
        <button @click="toggleLayoutPosition" class="layout-toggle-btn" :title="`Layout: ${layoutPosition}`">
          <span v-if="layoutPosition === 'invisible'">✕</span>
          <span v-else-if="layoutPosition === 'top'">▭</span>
        </button>
        <button v-if="layoutPosition !== 'invisible'" @click="toggleLayoutSize" class="size-toggle-btn" :title="`Size: ${layoutSize}`">
          <span v-if="layoutSize === 'small'">S</span>
          <span v-else>L</span>
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

    <!-- Tab Context Menu -->
    <div v-if="contextMenuVisible" class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }">
      <!-- Group creation/management options -->
      <template v-if="contextMenuTabId && !tabs.get(contextMenuTabId)?.groupId">
        <div class="context-menu-item" @click="contextMenuCreateGroupWithNext">
          Group with Next Tab
        </div>
        <div class="context-menu-separator"></div>
      </template>

      <template v-if="contextMenuTabId && tabs.get(contextMenuTabId)?.groupId">
        <div class="context-menu-item" @click="contextMenuRenameGroup">
          Rename Group...
        </div>
        <div class="context-menu-item" @click="contextMenuRemoveFromGroup">
          Remove from Group
        </div>
        <div class="context-menu-item" @click="contextMenuDissolveGroup">
          Dissolve Group
        </div>
        <div class="context-menu-separator"></div>
      </template>

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
import type { ImageData, TabData, SessionData, FolderContext, FileEntry, TabGroup } from '../types'
import GroupGridPreview from './GroupGridPreview.vue'
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

// Tab layout state (split into position and size)
const layoutPosition = ref<'invisible' | 'top' | 'tree'>('tree')
const layoutSize = ref<'small' | 'large'>('small')
const treeCollapsed = ref(false)

// Tab groups state
const tabGroups = ref<Map<string, TabGroup>>(new Map())
const selectedGroupId = ref<string | null>(null) // For group header selection in tree view
const collapsedGroupIds = ref<Set<string>>(new Set()) // Track which groups are collapsed
let nextGroupColorIndex = 0 // Alternates between blue and orange

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

// Tree view items with group headers
type TreeViewItem = { type: 'group', groupId: string } | { type: 'tab', tab: TabData }
const treeViewItems = computed((): TreeViewItem[] => {
  const items: TreeViewItem[] = []
  const processedGroups = new Set<string>()

  for (const tab of sortedTabs.value) {
    // If tab has a group and we haven't processed it yet, add group header
    if (tab.groupId && !processedGroups.has(tab.groupId)) {
      items.push({ type: 'group', groupId: tab.groupId })
      processedGroups.add(tab.groupId)
    }
    // Add the tab only if its group is not collapsed (or if it has no group)
    if (!tab.groupId || !collapsedGroupIds.value.has(tab.groupId)) {
      items.push({ type: 'tab', tab })
    }
  }

  return items
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
    if (layoutPosition.value === 'tree' && treeItemsContainer.value) {
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

  // Get the active tab to check if it's in a group
  const oldActiveTab = activeTabId.value ? tabs.value.get(activeTabId.value) : null
  const groupId = oldActiveTab?.groupId

  const tab: TabData = {
    id: tabId,
    title: imageData.name,
    imageData,
    isActive: true,
    order: getNextTabOrder(),
    isFullyLoaded: true, // New tabs are always fully loaded
    groupId: groupId // Inherit group from active tab
  }

  // If adding to a group, update the group's tabIds
  if (groupId) {
    const group = tabGroups.value.get(groupId)
    if (group) {
      // Find position of old active tab in group's tabIds
      const oldTabIndex = group.tabIds.indexOf(activeTabId.value!)
      // Insert new tab right after the old active tab
      group.tabIds.splice(oldTabIndex + 1, 0, tabId)
      console.log(`Added new tab to group "${group.name}" after active tab`)
    }
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

  // Save current tab's zoom/pan state before switching
  if (activeTabId.value) {
    const currentTab = tabs.value.get(activeTabId.value)
    if (currentTab) {
      currentTab.zoomLevel = zoomLevel.value
      currentTab.fitMode = fitMode.value
      currentTab.panOffset = { ...panOffset.value }
    }
  }

  // Update active states
  tabs.value.forEach(t => { t.isActive = false })
  tab.isActive = true
  activeTabId.value = tabId
  selectedGroupId.value = null // Clear group selection when switching to a tab

  // Scroll the active tab into view (centered)
  scrollActiveTabIntoView()

  // Restore zoom and pan state for the new tab
  zoomLevel.value = tab.zoomLevel ?? 1
  fitMode.value = tab.fitMode ?? 'fit-to-window'
  panOffset.value = tab.panOffset ?? { x: 0, y: 0 }

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

  // Remove from group if it's in one (this will auto-cleanup empty groups)
  if (tabToClose.groupId) {
    removeTabFromGroup(tabId)
  }

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

  // Save current zoom/pan state before changing images
  activeTab.zoomLevel = zoomLevel.value
  activeTab.fitMode = fitMode.value
  activeTab.panOffset = { ...panOffset.value }

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

  // Get the active tab to check if it's in a group
  const oldActiveTab = activeTabId.value ? tabs.value.get(activeTabId.value) : null
  const groupId = oldActiveTab?.groupId

  const tab: TabData = {
    id: tabId,
    title: nextEntry.name,
    imageData: imageData,
    isActive: true, // Switch to the new tab immediately
    order: getNextTabOrder(),
    groupId: groupId // Inherit group from active tab
  }

  // If adding to a group, update the group's tabIds
  if (groupId) {
    const group = tabGroups.value.get(groupId)
    if (group) {
      // Find position of old active tab in group's tabIds
      const oldTabIndex = group.tabIds.indexOf(activeTabId.value!)
      // Insert new tab right after the old active tab
      group.tabIds.splice(oldTabIndex + 1, 0, tabId)
      console.log(`Added new tab to group "${group.name}" after active tab`)
    }
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

// Group management context menu handlers
const contextMenuCreateGroupWithNext = () => {
  if (!contextMenuTabId.value) return

  const tabArray = sortedTabs.value
  const currentIndex = tabArray.findIndex(tab => tab.id === contextMenuTabId.value)

  if (currentIndex === -1 || currentIndex >= tabArray.length - 1) {
    console.log('Cannot create group: no next tab')
    contextMenuVisible.value = false
    return
  }

  const currentTab = tabArray[currentIndex]
  const nextTab = tabArray[currentIndex + 1]

  if (currentTab && nextTab) {
    const groupName = `Group ${tabGroups.value.size + 1}`
    createGroup(groupName, [currentTab.id, nextTab.id])
    console.log(`✅ Created group "${groupName}" with "${currentTab.title}" and "${nextTab.title}"`)
  }

  contextMenuVisible.value = false
}

const contextMenuRenameGroup = () => {
  if (!contextMenuTabId.value) return

  const tab = tabs.value.get(contextMenuTabId.value)
  if (!tab || !tab.groupId) return

  const group = tabGroups.value.get(tab.groupId)
  if (!group) return

  // Use a simple prompt for now (works in Tauri)
  const newName = window.prompt(`Rename group "${group.name}":`, group.name)
  if (newName && newName.trim() !== '') {
    renameGroup(group.id, newName.trim())
  }

  contextMenuVisible.value = false
}

const contextMenuRemoveFromGroup = () => {
  if (!contextMenuTabId.value) return

  const tab = tabs.value.get(contextMenuTabId.value)
  if (!tab || !tab.groupId) return

  const group = tabGroups.value.get(tab.groupId)
  const groupName = group?.name || 'group'

  removeTabFromGroup(contextMenuTabId.value)
  console.log(`✅ Removed tab from "${groupName}"`)

  contextMenuVisible.value = false
}

const contextMenuDissolveGroup = () => {
  if (!contextMenuTabId.value) return

  const tab = tabs.value.get(contextMenuTabId.value)
  if (!tab || !tab.groupId) return

  const group = tabGroups.value.get(tab.groupId)
  if (!group) return

  const confirmDissolve = window.confirm(`Dissolve group "${group.name}"? All ${group.tabIds.length} tabs will be ungrouped.`)
  if (confirmDissolve) {
    dissolveGroup(group.id)
    console.log(`✅ Dissolved group "${group.name}"`)
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

  // If there's an active tab, insert after it
  if (activeTabId.value) {
    const activeTab = tabs.value.get(activeTabId.value)
    if (activeTab) {
      const newOrder = activeTab.order + 1

      // Shift all tabs after this position up by 1
      Array.from(tabs.value.values()).forEach(tab => {
        if (tab.order >= newOrder) {
          tab.order = tab.order + 1
        }
      })

      return newOrder
    }
  }

  // Fallback: add at the end
  const maxOrder = Math.max(...Array.from(tabs.value.values()).map(tab => tab.order))
  return maxOrder + 1
}

const moveTab = (direction: 'left'|'right', tabId: string|null = null) => {
  if (direction === 'left') {
    return moveTabLeft(tabId)
  }

  return moveTabRight(tabId)
}

const moveTabRight = (tabId: string|null = null) => {
  // Case B: Group header is selected - move entire group
  if (selectedGroupId.value && !tabId) {
    moveGroupRight(selectedGroupId.value)
    return
  }

  const targetTabId = tabId ?? activeTabId.value;

  if (!targetTabId) return

  const targetTab = tabs.value.get(targetTabId)
  if (!targetTab) return

  const allTabs = sortedTabs.value
  const currentIndex = allTabs.findIndex(tab => tab.id === targetTabId)
  if (currentIndex === -1 || currentIndex >= allTabs.length - 1) return

  // Case C: Grouped tab is active - move within group only
  if (targetTab.groupId) {
    const groupTabs = allTabs.filter(tab => tab.groupId === targetTab.groupId)
    const groupIndex = groupTabs.findIndex(tab => tab.id === targetTabId)

    console.log(`Moving tab within group: groupIndex=${groupIndex}, groupSize=${groupTabs.length}`)

    // C.2: If at right end of group, do nothing
    if (groupIndex >= groupTabs.length - 1) {
      console.log('Cannot move: tab is at the right end of its group')
      return
    }

    // Move within group
    const rightGroupTab = groupTabs[groupIndex + 1]
    if (rightGroupTab) {
      const tempOrder = targetTab.order
      targetTab.order = rightGroupTab.order
      rightGroupTab.order = tempOrder
      console.log(`Moved tab "${targetTab.title}" to the right within group (swapped orders: ${tempOrder} <-> ${rightGroupTab.order})`)
    }
    return
  }

  // Case A: Ungrouped tab - swap with right tab/group
  const rightTab = allTabs[currentIndex + 1]
  if (!rightTab) return

  // If right is a group, find all tabs in that group and swap orders
  if (rightTab.groupId) {
    const rightGroupTabs = allTabs.filter(tab => tab.groupId === rightTab.groupId)
    const maxGroupOrder = Math.max(...rightGroupTabs.map(t => t.order))

    // Move active tab to after the group ends
    targetTab.order = maxGroupOrder

    // Shift all group tabs down by 1
    rightGroupTabs.forEach(tab => {
      tab.order = tab.order - 1
    })

    console.log(`Moved ungrouped tab "${targetTab.title}" past group to the right`)
  } else {
    // Simple swap with ungrouped tab
    const tempOrder = targetTab.order
    targetTab.order = rightTab.order
    rightTab.order = tempOrder
    console.log(`Moved tab "${targetTab.title}" to the right`)
  }
}

const moveTabLeft = (tabId: string|null = null) => {
  // Case B: Group header is selected - move entire group
  if (selectedGroupId.value && !tabId) {
    moveGroupLeft(selectedGroupId.value)
    return
  }

  const targetTabId = tabId ?? activeTabId.value;

  if (!targetTabId) return

  const targetTab = tabs.value.get(targetTabId)
  if (!targetTab) return

  const allTabs = sortedTabs.value
  const currentIndex = allTabs.findIndex(tab => tab.id === targetTabId)
  if (currentIndex === -1 || currentIndex <= 0) return

  // Case C: Grouped tab is active - move within group only
  if (targetTab.groupId) {
    const groupTabs = allTabs.filter(tab => tab.groupId === targetTab.groupId)
    const groupIndex = groupTabs.findIndex(tab => tab.id === targetTabId)

    console.log(`Moving tab within group: groupIndex=${groupIndex}, groupSize=${groupTabs.length}`)

    // C.1: If at left end of group, do nothing
    if (groupIndex <= 0) {
      console.log('Cannot move: tab is at the left end of its group')
      return
    }

    // Move within group
    const leftGroupTab = groupTabs[groupIndex - 1]
    if (leftGroupTab) {
      const tempOrder = targetTab.order
      targetTab.order = leftGroupTab.order
      leftGroupTab.order = tempOrder
      console.log(`Moved tab "${targetTab.title}" to the left within group (swapped orders: ${tempOrder} <-> ${leftGroupTab.order})`)
    }
    return
  }

  // Case A: Ungrouped tab - swap with left tab/group
  const leftTab = allTabs[currentIndex - 1]
  if (!leftTab) return

  // If left is a group, find all tabs in that group and swap orders
  if (leftTab.groupId) {
    const leftGroupTabs = allTabs.filter(tab => tab.groupId === leftTab.groupId)
    const minGroupOrder = Math.min(...leftGroupTabs.map(t => t.order))

    // Move active tab to before the group starts
    targetTab.order = minGroupOrder

    // Shift all group tabs up by 1
    leftGroupTabs.forEach(tab => {
      tab.order = tab.order + 1
    })

    console.log(`Moved ungrouped tab "${targetTab.title}" past group to the left`)
  } else {
    // Simple swap with ungrouped tab
    const tempOrder = targetTab.order
    targetTab.order = leftTab.order
    leftTab.order = tempOrder
    console.log(`Moved tab "${targetTab.title}" to the left`)
  }
}

// Tab group management functionality
const createGroup = (name: string, tabIds: string[]): TabGroup => {
  const groupId = `group-${Date.now()}`
  const color: 'blue' | 'orange' = nextGroupColorIndex % 2 === 0 ? 'blue' : 'orange'
  nextGroupColorIndex++

  const group: TabGroup = {
    id: groupId,
    name,
    color,
    order: getNextTabOrder(),
    tabIds: [...tabIds],
    collapsed: false
  }

  tabGroups.value.set(groupId, group)

  // Assign groupId to all tabs
  tabIds.forEach(tabId => {
    const tab = tabs.value.get(tabId)
    if (tab) {
      tab.groupId = groupId
    }
  })

  console.log(`Created group "${name}" with ${tabIds.length} tabs`)
  return group
}

// @ts-ignore - Function reserved for future drag-to-group feature
const addTabToGroup = (tabId: string, groupId: string): void => {
  const group = tabGroups.value.get(groupId)
  const tab = tabs.value.get(tabId)

  if (!group || !tab) return

  // Remove from existing group if any
  if (tab.groupId) {
    removeTabFromGroup(tabId)
  }

  // Add to new group
  tab.groupId = groupId
  if (!group.tabIds.includes(tabId)) {
    group.tabIds.push(tabId)
  }

  console.log(`Added tab "${tab.title}" to group "${group.name}"`)
}

const removeTabFromGroup = (tabId: string): void => {
  const tab = tabs.value.get(tabId)
  if (!tab || !tab.groupId) return

  const group = tabGroups.value.get(tab.groupId)
  if (!group) return

  // Find the position of this tab within the group
  const tabIndex = group.tabIds.indexOf(tabId)
  if (tabIndex === -1) return

  // Check if removing this tab will split the group
  const isInMiddle = tabIndex > 0 && tabIndex < group.tabIds.length - 1

  if (isInMiddle) {
    // Split the group into two
    const tabsBefore = group.tabIds.slice(0, tabIndex)
    const tabsAfter = group.tabIds.slice(tabIndex + 1)

    console.log(`Splitting group "${group.name}": [${tabsBefore.length}] + removed + [${tabsAfter.length}]`)

    // Keep tabs before in the original group
    group.tabIds = tabsBefore

    // Create a new group for tabs after
    if (tabsAfter.length > 0) {
      const newGroupName = `${group.name} (split)`
      const newGroup = createGroup(newGroupName, tabsAfter)
      console.log(`Created new group "${newGroup.name}" with ${tabsAfter.length} tabs after split`)

      // Auto-dissolve if the new group has only 1 tab
      autoDissolveSmallGroups(newGroup.id)
    }

    // Auto-dissolve original group if it now has only 1 tab
    autoDissolveSmallGroups(group.id)
  } else {
    // Tab is at the beginning or end, just remove it
    group.tabIds = group.tabIds.filter(id => id !== tabId)
    console.log(`Removed tab "${tab.title}" from ${tabIndex === 0 ? 'beginning' : 'end'} of group "${group.name}"`)

    // Auto-cleanup: delete group if empty or only 1 tab remains
    if (group.tabIds.length === 0) {
      tabGroups.value.delete(group.id)
      if (selectedGroupId.value === group.id) {
        selectedGroupId.value = null
      }
      console.log(`Auto-deleted empty group "${group.name}"`)
    } else {
      // Auto-dissolve if only 1 tab remains
      autoDissolveSmallGroups(group.id)
    }
  }

  tab.groupId = undefined
}

const renameGroup = (groupId: string, newName: string): void => {
  const group = tabGroups.value.get(groupId)
  if (!group) return

  console.log(`Renamed group from "${group.name}" to "${newName}"`)
  group.name = newName
}

const dissolveGroup = (groupId: string): void => {
  const group = tabGroups.value.get(groupId)
  if (!group) return

  // Remove groupId from all tabs in the group
  group.tabIds.forEach(tabId => {
    const tab = tabs.value.get(tabId)
    if (tab) {
      tab.groupId = undefined
    }
  })

  tabGroups.value.delete(groupId)
  if (selectedGroupId.value === groupId) {
    selectedGroupId.value = null
  }

  console.log(`Dissolved group "${group.name}"`)
}

// Auto-dissolve groups with only 1 tab
const autoDissolveSmallGroups = (groupId: string): void => {
  const group = tabGroups.value.get(groupId)
  if (!group) return

  if (group.tabIds.length <= 1) {
    console.log(`Auto-dissolving group "${group.name}" (only ${group.tabIds.length} tab remaining)`)
    dissolveGroup(groupId)
  }
}

const getGroupColor = (groupId: string): 'blue' | 'orange' | null => {
  const group = tabGroups.value.get(groupId)
  return group ? group.color : null
}

const getGroupName = (groupId: string): string => {
  const group = tabGroups.value.get(groupId)
  return group ? group.name : 'Unknown Group'
}

const getGroupTabIds = (groupId: string): string[] => {
  const group = tabGroups.value.get(groupId)
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

  return groupTabs.map(tab => tab.id)
}

const selectGroupHeader = (groupId: string): void => {
  // Clear active tab selection when selecting a group header
  activeTabId.value = null
  selectedGroupId.value = groupId
  console.log(`Selected group header: "${getGroupName(groupId)}"`)
}

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

const moveGroupRight = (groupId: string): void => {
  const group = tabGroups.value.get(groupId)
  if (!group) return

  const allTabs = sortedTabs.value
  const groupTabs = allTabs.filter(tab => tab.groupId === groupId)

  if (groupTabs.length === 0) return

  // Find rightmost tab in group
  const lastGroupTab = groupTabs[groupTabs.length - 1]
  if (!lastGroupTab) return
  const lastGroupIndex = allTabs.findIndex(t => t.id === lastGroupTab.id)

  if (lastGroupIndex >= allTabs.length - 1) return // Already at end

  const rightTab = allTabs[lastGroupIndex + 1]
  if (!rightTab) return

  // If right tab is also in this group, we're done (can't move within group)
  if (rightTab.groupId === groupId) return

  // Check if right target is also a group
  if (rightTab.groupId) {
    // Swap entire groups
    const rightGroupTabs = allTabs.filter(tab => tab.groupId === rightTab.groupId)
    const minGroupOrder = Math.min(...groupTabs.map(t => t.order))
    const minRightGroupOrder = Math.min(...rightGroupTabs.map(t => t.order))
    const groupSize = groupTabs.length
    const rightGroupSize = rightGroupTabs.length

    // Shift our group right by the size of the right group
    groupTabs.forEach(tab => {
      tab.order = tab.order + rightGroupSize
    })

    // Shift right group left by our size
    rightGroupTabs.forEach(tab => {
      tab.order = tab.order - groupSize
    })

    console.log(`Moved group "${group.name}" to the right (swapped with group)`)
  } else {
    // Swap with single ungrouped tab
    const minGroupOrder = Math.min(...groupTabs.map(t => t.order))

    // Move the right tab to where the group started
    rightTab.order = minGroupOrder

    // Shift all group tabs' orders to the right by 1
    groupTabs.forEach(tab => {
      tab.order = tab.order + 1
    })

    console.log(`Moved group "${group.name}" to the right (swapped with tab)`)
  }
}

const moveGroupLeft = (groupId: string): void => {
  const group = tabGroups.value.get(groupId)
  if (!group) return

  const allTabs = sortedTabs.value
  const groupTabs = allTabs.filter(tab => tab.groupId === groupId)

  if (groupTabs.length === 0) return

  // Find leftmost tab in group
  const firstGroupTab = groupTabs[0]
  if (!firstGroupTab) return
  const firstGroupIndex = allTabs.findIndex(t => t.id === firstGroupTab.id)

  if (firstGroupIndex <= 0) return // Already at start

  const leftTab = allTabs[firstGroupIndex - 1]
  if (!leftTab) return

  // If left tab is also in this group, we're done (can't move within group)
  if (leftTab.groupId === groupId) return

  // Check if left target is also a group
  if (leftTab.groupId) {
    // Swap entire groups
    const leftGroupTabs = allTabs.filter(tab => tab.groupId === leftTab.groupId)
    const maxGroupOrder = Math.max(...groupTabs.map(t => t.order))
    const maxLeftGroupOrder = Math.max(...leftGroupTabs.map(t => t.order))
    const groupSize = groupTabs.length
    const leftGroupSize = leftGroupTabs.length

    // Shift our group left by the size of the left group
    groupTabs.forEach(tab => {
      tab.order = tab.order - leftGroupSize
    })

    // Shift left group right by our size
    leftGroupTabs.forEach(tab => {
      tab.order = tab.order + groupSize
    })

    console.log(`Moved group "${group.name}" to the left (swapped with group)`)
  } else {
    // Swap with single ungrouped tab
    const maxGroupOrder = Math.max(...groupTabs.map(t => t.order))

    // Move the left tab to where the group ended
    leftTab.order = maxGroupOrder

    // Shift all group tabs' orders to the left by 1
    groupTabs.forEach(tab => {
      tab.order = tab.order - 1
    })

    console.log(`Moved group "${group.name}" to the left (swapped with tab)`)
  }
}

// Join with left tab/group (Ctrl+Left)
const joinWithLeft = (): void => {
  // Case B: Group header is selected - merge left tab/group into this group
  if (selectedGroupId.value) {
    const group = tabGroups.value.get(selectedGroupId.value)
    if (!group) return

    const allTabs = sortedTabs.value
    const groupTabs = allTabs.filter(tab => tab.groupId === selectedGroupId.value)
    if (groupTabs.length === 0) return

    const firstGroupIndex = allTabs.findIndex(t => t.id === groupTabs[0]!.id)
    if (firstGroupIndex <= 0) return

    const leftTarget = allTabs[firstGroupIndex - 1]
    if (!leftTarget) return

    // If left target is in a group, merge all its group tabs
    if (leftTarget.groupId) {
      const leftGroupId = leftTarget.groupId // Capture BEFORE modifying
      const leftGroupTabs = allTabs.filter(tab => tab.groupId === leftGroupId)
      leftGroupTabs.forEach(tab => {
        tab.groupId = selectedGroupId.value!
        if (!group.tabIds.includes(tab.id)) {
          group.tabIds.push(tab.id)
        }
      })
      // Delete the left group
      tabGroups.value.delete(leftGroupId)
      console.log(`Merged left group into "${group.name}"`)
      // Auto-dissolve if the merged group ends up with only 1 tab
      autoDissolveSmallGroups(selectedGroupId.value!)
    } else {
      // Just merge the single left tab
      leftTarget.groupId = selectedGroupId.value!
      if (!group.tabIds.includes(leftTarget.id)) {
        group.tabIds.push(leftTarget.id)
      }
      console.log(`Merged left tab "${leftTarget.title}" into "${group.name}"`)
    }
    return
  }

  // Case C: Grouped tab is active - do nothing
  if (activeTabId.value) {
    const activeTab = tabs.value.get(activeTabId.value)
    if (!activeTab) return

    if (activeTab.groupId) {
      console.log('Cannot join: active tab is already in a group')
      return
    }

    // Case A: Ungrouped tab is active
    const allTabs = sortedTabs.value
    const currentIndex = allTabs.findIndex(tab => tab.id === activeTabId.value)
    if (currentIndex <= 0) return

    const leftTab = allTabs[currentIndex - 1]
    if (!leftTab) return

    // If left tab has a group, join it
    if (leftTab.groupId) {
      const group = tabGroups.value.get(leftTab.groupId)
      if (group) {
        activeTab.groupId = leftTab.groupId
        if (!group.tabIds.includes(activeTab.id)) {
          group.tabIds.push(activeTab.id)
        }
        console.log(`Joined "${activeTab.title}" to group "${group.name}"`)
      }
    } else {
      // Create new group with both tabs
      const newGroup = createGroup(`Group ${tabGroups.value.size + 1}`, [leftTab.id, activeTab.id])
      console.log(`Created new group "${newGroup.name}" with left tab and active tab`)
    }
  }
}

// Join with right tab/group (Ctrl+Right)
const joinWithRight = (): void => {
  // Case B: Group header is selected - merge right tab/group into this group
  if (selectedGroupId.value) {
    const group = tabGroups.value.get(selectedGroupId.value)
    if (!group) return

    const allTabs = sortedTabs.value
    const groupTabs = allTabs.filter(tab => tab.groupId === selectedGroupId.value)
    if (groupTabs.length === 0) return

    const lastGroupIndex = allTabs.findIndex(t => t.id === groupTabs[groupTabs.length - 1]!.id)
    if (lastGroupIndex >= allTabs.length - 1) return

    const rightTarget = allTabs[lastGroupIndex + 1]
    if (!rightTarget) return

    // If right target is in a group, merge all its group tabs
    if (rightTarget.groupId) {
      const rightGroupId = rightTarget.groupId // Capture BEFORE modifying
      const rightGroupTabs = allTabs.filter(tab => tab.groupId === rightGroupId)
      rightGroupTabs.forEach(tab => {
        tab.groupId = selectedGroupId.value!
        if (!group.tabIds.includes(tab.id)) {
          group.tabIds.push(tab.id)
        }
      })
      // Delete the right group
      tabGroups.value.delete(rightGroupId)
      console.log(`Merged right group into "${group.name}"`)
      // Auto-dissolve if the merged group ends up with only 1 tab
      autoDissolveSmallGroups(selectedGroupId.value!)
    } else {
      // Just merge the single right tab
      rightTarget.groupId = selectedGroupId.value!
      if (!group.tabIds.includes(rightTarget.id)) {
        group.tabIds.push(rightTarget.id)
      }
      console.log(`Merged right tab "${rightTarget.title}" into "${group.name}"`)
    }
    return
  }

  // Case C: Grouped tab is active - do nothing
  if (activeTabId.value) {
    const activeTab = tabs.value.get(activeTabId.value)
    if (!activeTab) return

    if (activeTab.groupId) {
      console.log('Cannot join: active tab is already in a group')
      return
    }

    // Case A: Ungrouped tab is active
    const allTabs = sortedTabs.value
    const currentIndex = allTabs.findIndex(tab => tab.id === activeTabId.value)
    if (currentIndex >= allTabs.length - 1) return

    const rightTab = allTabs[currentIndex + 1]
    if (!rightTab) return

    // If right tab has a group, join it
    if (rightTab.groupId) {
      const group = tabGroups.value.get(rightTab.groupId)
      if (group) {
        activeTab.groupId = rightTab.groupId
        if (!group.tabIds.includes(activeTab.id)) {
          group.tabIds.push(activeTab.id)
        }
        console.log(`Joined "${activeTab.title}" to group "${group.name}"`)
      }
    } else {
      // Create new group with both tabs
      const newGroup = createGroup(`Group ${tabGroups.value.size + 1}`, [activeTab.id, rightTab.id])
      console.log(`Created new group "${newGroup.name}" with active tab and right tab`)
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

// Toggle layout position (invisible / top / tree)
const toggleLayoutPosition = () => {
  const positions: Array<'invisible' | 'top' | 'tree'> = ['invisible', 'top', 'tree']
  const currentIndex = positions.indexOf(layoutPosition.value)
  const nextIndex = (currentIndex + 1) % positions.length
  layoutPosition.value = positions[nextIndex] as 'invisible' | 'top' | 'tree'
  console.log(`Layout position changed to: ${layoutPosition.value}`)
}

// Toggle layout size (small / large)
const toggleLayoutSize = () => {
  layoutSize.value = layoutSize.value === 'small' ? 'large' : 'small'
  console.log(`Layout size changed to: ${layoutSize.value}`)
}

// Toggle tree panel collapsed state
const toggleTreeCollapse = () => {
  treeCollapsed.value = !treeCollapsed.value
  console.log(`Tree ${treeCollapsed.value ? 'collapsed' : 'expanded'}`)
}

// Toggle group collapsed state
const toggleGroupCollapse = (groupId: string) => {
  if (collapsedGroupIds.value.has(groupId)) {
    collapsedGroupIds.value.delete(groupId)
    console.log(`Group ${groupId} expanded`)
  } else {
    collapsedGroupIds.value.add(groupId)
    console.log(`Group ${groupId} collapsed`)
  }
}


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
      currentTab.zoomLevel = zoomLevel.value
      currentTab.fitMode = fitMode.value
      currentTab.panOffset = { ...panOffset.value }
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
    // Clear existing tabs and groups
    tabs.value.clear()
    tabFolderContexts.value.clear()
    tabGroups.value.clear()
    activeTabId.value = null
    selectedGroupId.value = null
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
      nextGroupColorIndex = sessionData.groups.length

      console.log(`✅ Restored ${sessionData.groups.length} tab groups, nextGroupColorIndex=${nextGroupColorIndex}`)
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
        zoomLevel.value = activeTab.zoomLevel ?? 1
        fitMode.value = activeTab.fitMode ?? 'fit-to-window'
        panOffset.value = activeTab.panOffset ?? { x: 0, y: 0 }

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
        zoomLevel.value = firstTab.zoomLevel ?? 1
        fitMode.value = firstTab.fitMode ?? 'fit-to-window'
        panOffset.value = firstTab.panOffset ?? { x: 0, y: 0 }

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

.tree-item-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 3px;
  transition: all 0.2s;
  opacity: 0;
}

.tree-item:hover .tree-item-close {
  opacity: 1;
}

.tree-item-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ff6b6b;
}

/* Group Header in Tree View */
.tree-group-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  background: #2a2a2a;
  border-bottom: 1px solid #444;
  border-left: 3px solid transparent;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
  transition: all 0.2s;
}

.tree-group-header:hover {
  background: #353535;
}

.tree-group-header.active {
  background: #1a1a1a;
  border-left-color: #888;
}

.tree-group-header.group-blue {
  border-left-color: #007bff;
}

.tree-group-header.group-blue.active {
  border-left-color: #0056b3;
  background: #1a2530;
}

.tree-group-header.group-orange {
  border-left-color: #ff8c00;
}

.tree-group-header.group-orange.active {
  border-left-color: #cc7000;
  background: #2d2215;
}

.group-collapse-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0;
  margin-right: 8px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  transition: color 0.2s;
}

.group-collapse-btn:hover {
  color: #fff;
}

.tree-group-header.collapsed .group-collapse-btn {
  color: #666;
}

.group-header-title {
  flex: 1;
  color: #ccc;
  cursor: pointer;
}

.tree-panel.collapsed .group-header-title {
  display: none;
}

.group-header-indicator {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: currentColor;
}

/* Tab group styling - Tree layout (indented) */
.tree-item.grouped {
  margin-left: 20px;
  border-left: 2px solid #666;
  padding-left: 10px;
}

.tree-item.grouped.active {
  border-left-color: #007bff;
  border-left-width: 3px;
  padding-left: 9px;
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

/* Tab group styling - Top layout (border colors) */
.tab.group-blue {
  border-top: 3px solid #007bff;
}

.tab.group-orange {
  border-top: 3px solid #ff8c00;
}

/* Vuedraggable ghost/drag styling */
.ghost {
  opacity: 0.5;
}

.draggable-container {
  display: contents;
}

.tab-controls {
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-left: 1px solid #404040;
}

.new-tab-btn,
.layout-toggle-btn,
.size-toggle-btn {
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
.layout-toggle-btn:hover,
.size-toggle-btn:hover {
  background: #3d3d3d;
  color: white;
}

.size-toggle-btn {
  font-size: 14px;
  font-weight: 600;
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