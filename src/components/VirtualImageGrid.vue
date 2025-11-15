<template>
  <div
    ref="gridContainerRef"
    class="virtual-image-grid"
    :tabindex="keyboardNavigation ? 0 : -1"
    @keydown="handleKeyDown"
    @scroll="handleScroll">
    <!-- Virtual scrolling: Only render visible items -->
    <div class="grid-spacer" :style="{ height: `${topSpacerHeight}px` }"></div>

    <div
      v-for="index in visibleIndices"
      :key="getItemKey(index)"
      :ref="el => setItemRef(el, index)"
      :data-index="index"
      class="grid-item"
      :class="getItemClasses(index)"
      @click="handleItemClick(index)"
      @dblclick="handleItemDoubleClick(index)"
      :title="getItemTitle(index)">
      <slot name="item" :item="items[index]" :index="index" :isLoaded="isItemLoaded(index)">
        <!-- Default slot content if not provided -->
        <div v-if="!isItemLoaded(index)" class="loading-placeholder">
          <div class="loading-spinner"></div>
          <div class="loading-text">{{ getItemTitle(index) }}</div>
        </div>
        <template v-else>
          <img
            :src="getItemAssetUrl(index)"
            :alt="getItemTitle(index)"
            class="grid-thumbnail"
            @error="handleImageError" />
          <slot name="item-overlay" :item="items[index]" :index="index"></slot>
          <div class="grid-item-name">{{ getItemTitle(index) }}</div>
        </template>
      </slot>
    </div>

    <div class="grid-spacer" :style="{ height: `${bottomSpacerHeight}px` }"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

// Generic interface for grid items
interface GridItem {
  path?: string
  name?: string
  assetUrl?: string
  [key: string]: any
}

// Props
const props = withDefaults(
  defineProps<{
    items: GridItem[]
    focusedIndex?: number | null
    keyboardNavigation?: boolean
    getKey?: (item: GridItem, index: number) => string
    getTitle?: (item: GridItem, index: number) => string
    getAssetUrl?: (item: GridItem, index: number) => string
    isLoaded?: (item: GridItem, index: number) => boolean
    getClasses?: (item: GridItem, index: number) => Record<string, boolean> | string
  }>(),
  {
    focusedIndex: null,
    keyboardNavigation: false,
    getKey: (item: GridItem, index: number) => item.path || String(index),
    getTitle: (item: GridItem) => item.name || '',
    getAssetUrl: (item: GridItem) => item.assetUrl || '',
    isLoaded: () => true,
    getClasses: () => ({})
  }
)

// Emits
const emit = defineEmits<{
  itemClick: [index: number]
  itemDoubleClick: [index: number]
  itemActivate: [index: number]
  scroll: [scrollTop: number]
  itemsVisible: [indices: number[]]
}>()

// Grid configuration
const ITEM_HEIGHT = 200 // Height of each grid item in pixels
const GAP = 3 // Gap between items
const ROW_HEIGHT = ITEM_HEIGHT + GAP

// State
const gridContainerRef = ref<HTMLElement | null>(null)
const itemRefs = new Map<number, HTMLElement>()
const gridColumns = ref(6) // Default value
const scrollTop = ref(0)
const containerHeight = ref(0)
const observerRef = ref<IntersectionObserver | null>(null)
let scrollThrottleTimer: number | null = null
let keyboardThrottleTimer: number | null = null

// Helper functions that use props
const getItemKey = (index: number): string => {
  const item = props.items[index]
  return item ? props.getKey(item, index) : String(index)
}

const getItemTitle = (index: number): string => {
  const item = props.items[index]
  return item ? props.getTitle(item, index) : ''
}

const getItemAssetUrl = (index: number): string => {
  const item = props.items[index]
  return item ? props.getAssetUrl(item, index) : ''
}

const isItemLoaded = (index: number): boolean => {
  const item = props.items[index]
  return item ? props.isLoaded(item, index) : false
}

// Optimized: minimal object creation, fast comparison
const getItemClasses = (index: number): any => {
  const item = props.items[index]
  if (!item) return {}

  const isFocused = props.focusedIndex === index

  // Fast path: if not focused and no custom classes, return empty object
  if (!isFocused) {
    const customClasses = props.getClasses(item, index)
    // Return directly without any processing if string or empty
    if (typeof customClasses === 'string') return customClasses
    return customClasses
  }

  // Item is focused - add focused class
  const customClasses = props.getClasses(item, index)
  if (typeof customClasses === 'string') {
    return `${customClasses} focused`
  }
  return { ...customClasses, focused: true }
}

// Calculate grid columns dynamically
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

// Calculate which items should be rendered (virtual scrolling)
const visibleIndices = computed(() => {
  const cols = gridColumns.value
  const totalItems = props.items.length
  const totalRows = Math.ceil(totalItems / cols)

  // Calculate visible range with buffer
  const visibleRowStart = Math.floor(scrollTop.value / ROW_HEIGHT)
  const visibleRowEnd = Math.ceil((scrollTop.value + containerHeight.value) / ROW_HEIGHT)

  // Add buffer rows (render extra 2 rows above and below for smooth scrolling)
  const bufferRows = 6
  const startRow = Math.max(0, visibleRowStart - bufferRows)
  const endRow = Math.min(totalRows, visibleRowEnd + bufferRows)

  // Convert rows to item indices
  const startIndex = startRow * cols
  const endIndex = Math.min(endRow * cols, totalItems)

  const indices: number[] = []
  for (let i = startIndex; i < endIndex; i++) {
    indices.push(i)
  }

  return indices
})

// Calculate spacer heights to maintain scroll position
const topSpacerHeight = computed(() => {
  const cols = gridColumns.value
  if (visibleIndices.value.length === 0) return 0

  const firstVisibleIndex = visibleIndices.value[0]
  if (firstVisibleIndex === undefined) return 0

  const firstVisibleRow = Math.floor(firstVisibleIndex / cols)
  return firstVisibleRow * ROW_HEIGHT
})

const bottomSpacerHeight = computed(() => {
  const cols = gridColumns.value
  const totalItems = props.items.length
  const totalRows = Math.ceil(totalItems / cols)

  if (visibleIndices.value.length === 0) return totalRows * ROW_HEIGHT

  const lastVisibleIndex = visibleIndices.value[visibleIndices.value.length - 1]
  if (lastVisibleIndex === undefined) return totalRows * ROW_HEIGHT

  const lastVisibleRow = Math.floor(lastVisibleIndex / cols)
  const remainingRows = totalRows - lastVisibleRow - 1
  return Math.max(0, remainingRows * ROW_HEIGHT)
})

// Handle scroll events with throttling for better performance
const handleScroll = () => {
  if (!gridContainerRef.value) return

  // Throttle scroll updates to ~60 FPS (16ms) to reduce render cycles
  if (scrollThrottleTimer !== null) {
    return // Skip this scroll event
  }

  scrollThrottleTimer = setTimeout(() => {
    scrollThrottleTimer = null
  }, 16) as unknown as number

  scrollTop.value = gridContainerRef.value.scrollTop
  emit('scroll', scrollTop.value)
}

// Update container height on mount and resize
const updateContainerHeight = () => {
  if (gridContainerRef.value) {
    containerHeight.value = gridContainerRef.value.clientHeight
  }
}

// Set item ref for DOM tracking
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

// Handle item click
const handleItemClick = (index: number) => {
  emit('itemClick', index)
}

// Handle item double-click
const handleItemDoubleClick = (index: number) => {
  emit('itemDoubleClick', index)
}

// Handle image load error
const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

// 2D Grid Navigation (only if keyboardNavigation is enabled)
const handleKeyDown = (event: KeyboardEvent) => {
  if (!props.keyboardNavigation || props.focusedIndex === null) return

  const current = props.focusedIndex

  // Throttle keyboard navigation to max 60 FPS (~16ms) for better performance
  const handleNavigation = (newIndex: number) => {
    if (keyboardThrottleTimer !== null) {
      return // Skip this key press
    }

    keyboardThrottleTimer = setTimeout(() => {
      keyboardThrottleTimer = null
    }, 16) as unknown as number

    emit('itemClick', newIndex)
    scrollToIndex(newIndex)
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    const next = Math.min(current + 1, props.items.length - 1)
    handleNavigation(next)
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
    const prev = Math.max(current - 1, 0)
    handleNavigation(prev)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    const next = Math.min(current + gridColumns.value, props.items.length - 1)
    handleNavigation(next)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const prev = Math.max(current - gridColumns.value, 0)
    handleNavigation(prev)
  } else if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    event.stopPropagation() // Prevent bubbling to document-level shortcut handler
    // Use props.focusedIndex directly to ensure we get the latest value,
    // not the stale 'current' captured at function start
    if (props.focusedIndex !== null) {
      emit('itemActivate', props.focusedIndex)
    }
  }
}

// Scroll to index (centered vertically)
const scrollToIndex = (index: number) => {
  if (!gridContainerRef.value) return

  const cols = gridColumns.value
  const row = Math.floor(index / cols)
  const targetScrollTop = row * ROW_HEIGHT

  // Calculate the position to center the row
  const containerCenter = containerHeight.value / 2
  const rowCenter = ROW_HEIGHT / 2
  const centeredScrollTop = targetScrollTop - containerCenter + rowCenter

  // Instant scroll for responsive keyboard navigation
  gridContainerRef.value.scrollTo({
    top: Math.max(0, centeredScrollTop),
    behavior: 'instant'
  })
}

// Setup intersection observer for lazy loading
const setupIntersectionObserver = () => {
  if (!gridContainerRef.value) return

  observerRef.value = new IntersectionObserver(
    (entries) => {
      const visibleItemIndices: number[] = []

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement
          const index = parseInt(element.dataset.index || '-1', 10)

          if (index >= 0) {
            visibleItemIndices.push(index)
          }
        }
      })

      if (visibleItemIndices.length > 0) {
        emit('itemsVisible', visibleItemIndices)
      }
    },
    {
      root: gridContainerRef.value,
      rootMargin: '200px',
      threshold: 0.01
    }
  )

  // Observe all grid items
  itemRefs.forEach((element) => {
    observerRef.value?.observe(element)
  })
}

// Resize handler
const handleResize = () => {
  updateGridColumns()
  updateContainerHeight()
}

// Lifecycle
onMounted(async () => {
  await nextTick()
  updateGridColumns()
  updateContainerHeight()
  window.addEventListener('resize', handleResize)

  // Focus the grid for keyboard navigation if enabled
  if (props.keyboardNavigation && gridContainerRef.value) {
    gridContainerRef.value.focus()
  }

  // Scroll to focused index if provided
  if (props.focusedIndex !== null) {
    scrollToIndex(props.focusedIndex)
  }

  // Setup intersection observer
  setupIntersectionObserver()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (observerRef.value) {
    observerRef.value.disconnect()
  }
})

// Expose methods for parent components
defineExpose({
  scrollToIndex,
  focusGrid: () => gridContainerRef.value?.focus()
})
</script>

<style scoped>
.virtual-image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 3px;
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
  align-content: start;
  outline: none;
}

.grid-spacer {
  grid-column: 1 / -1;
  width: 100%;
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

/* Scrollbar styling */
.virtual-image-grid::-webkit-scrollbar {
  width: 8px;
}

.virtual-image-grid::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.virtual-image-grid::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

.virtual-image-grid::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
