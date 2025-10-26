import { ref } from 'vue'
import type {TabData} from "../types"

// Zoom and pan state (per-tab, but managed globally)
const zoomLevel = ref(1)
const fitMode = ref<'fit-to-window' | 'actual-size'>('fit-to-window')
const panOffset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

/**
 * Composable for managing zoom and pan controls for images.
 *
 * Provides shared state and methods for zooming in/out, panning,
 * and switching between fit modes. State is maintained per-tab
 * by saving/restoring when switching tabs.
 */
export function useZoomControls() {
  /**
   * Zoom in by 20% (max 5x zoom)
   */
  const zoomIn = () => {
    if (fitMode.value === 'fit-to-window') {
      fitMode.value = 'actual-size'
      zoomLevel.value = 1.2 // Start with a slight zoom to make panning useful
    } else {
      zoomLevel.value = Math.min(zoomLevel.value * 1.2, 5) // Max zoom 5x
    }
    console.log(`Zoomed in to ${(zoomLevel.value * 100).toFixed(0)}%`)
  }

  /**
   * Zoom out by 20% (min 10%)
   * Switches to fit mode if zoomed out below 50%
   */
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

  /**
   * Reset zoom to fit-to-window mode
   */
  const resetZoom = () => {
    fitMode.value = 'fit-to-window'
    zoomLevel.value = 1
    panOffset.value = { x: 0, y: 0 }
    console.log('Reset zoom to fit window')
  }

  /**
   * Toggle between fit-to-window and actual-size modes
   */
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

  /**
   * Handle mouse wheel events for zooming
   */
  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()

    if (event.deltaY < 0) {
      zoomIn()
    } else {
      zoomOut()
    }
  }

  /**
   * Start panning (mouse down)
   */
  const handleMouseDown = (event: MouseEvent) => {
    if (fitMode.value === 'fit-to-window') return

    isDragging.value = true
    dragStart.value = {
      x: event.clientX - panOffset.value.x,
      y: event.clientY - panOffset.value.y
    }

    event.preventDefault()
  }

  /**
   * Pan the image (mouse move)
   */
  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging.value) return

    panOffset.value = {
      x: event.clientX - dragStart.value.x,
      y: event.clientY - dragStart.value.y
    }
  }

  /**
   * Stop panning (mouse up)
   */
  const handleMouseUp = () => {
    isDragging.value = false
  }

  /**
   * Reset zoom and pan to default state (fit-to-window)
   */
  const resetImageView = () => {
    fitMode.value = 'fit-to-window'
    zoomLevel.value = 1
    panOffset.value = { x: 0, y: 0 }
  }

  const loadZoomAndPanStateFromTab = (tab: TabData) => {
    zoomLevel.value = tab.zoomLevel ?? 1
    fitMode.value = tab.fitMode ?? 'fit-to-window'
    panOffset.value = tab.panOffset ?? { x: 0, y: 0 }
  }

  const saveZoomAndPanStateIntoTab = (tab: TabData) => {
    tab.zoomLevel = zoomLevel.value
    tab.fitMode = fitMode.value
    tab.panOffset = panOffset.value
  }

  return {
    // State
    zoomLevel,
    fitMode,
    panOffset,
    isDragging,
    dragStart,

    // Methods
    zoomIn,
    zoomOut,
    resetZoom,

    loadZoomAndPanStateFromTab,
    saveZoomAndPanStateIntoTab,

    toggleFitMode,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetImageView,
  }
}
