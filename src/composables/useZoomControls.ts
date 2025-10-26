import {computed, ref} from "vue"
import type { FitMode, TabData } from "../types"

// Zoom and pan state (per-tab, but managed globally)
const zoomLevel = ref(1)
const fitMode = ref<FitMode>('fit-to-window')
const panOffset = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

const FIT_MODE_SEQUENCE: FitMode[] = ['fit-to-window', 'fit-by-width', 'fit-by-height', 'actual-size']


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
    zoomLevel.value = Math.min(zoomLevel.value * 1.2, 5) // Max zoom 5x
    console.log(`Zoomed in to ${(zoomLevel.value * 100).toFixed(0)}%`)
  }

  const zoomOut = () => {
    zoomLevel.value = Math.max(zoomLevel.value / 1.2, 0.1) // Min zoom 10%
    console.log(`Zoomed out to ${(zoomLevel.value * 100).toFixed(0)}%`)
  }

  const isFitMode = (value: unknown): value is FitMode => {
    return typeof value === 'string' && FIT_MODE_SEQUENCE.includes(value as FitMode)
  }

  const setFitMode = (mode: FitMode) => {
    zoomLevel.value = 1
    panOffset.value = { x: 0, y: 0 }

    fitMode.value = mode
    console.log(`Switched to ${mode}`)
  }

  /**
   * Reset zoom to fit-to-window mode
   */
  const resetZoom = () => {
    setFitMode('fit-to-window')
    console.log('Reset zoom to fit window')
  }

  /**
   * Toggle through available fit modes
   */
  const toggleFitMode = () => {
    const currentIndex = FIT_MODE_SEQUENCE.indexOf(fitMode.value)
    const safeIndex = currentIndex >= 0 ? currentIndex : 0
    if (FIT_MODE_SEQUENCE.length === 0) return
    const nextIndex = (safeIndex + 1) % FIT_MODE_SEQUENCE.length
    const nextMode = FIT_MODE_SEQUENCE[nextIndex] ?? 'fit-to-window'
    setFitMode(nextMode)
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
   * Nudge the image by a delta (keyboard panning)
   */
  const panImageBy = (deltaX: number, deltaY: number) => {
    panOffset.value = {
      x: panOffset.value.x + deltaX,
      y: panOffset.value.y + deltaY
    }
  }

  /**
   * Reset zoom and pan to default state (fit-to-window)
   */
  const resetImageView = () => {
    setFitMode('fit-to-window')
  }

  const loadZoomAndPanStateFromTab = (tab: TabData) => {
    zoomLevel.value = tab.zoomLevel ?? 1
    fitMode.value = isFitMode(tab.fitMode) ? tab.fitMode : 'fit-to-window'
    panOffset.value = tab.panOffset ?? { x: 0, y: 0 }
  }

  const saveZoomAndPanStateIntoTab = (tab: TabData) => {
    tab.zoomLevel = zoomLevel.value
    tab.fitMode = fitMode.value
    tab.panOffset = panOffset.value
  }

  const isZoomLocked = computed(() => fitMode.value === 'fit-to-window')

  return {
    // State
    zoomLevel,
    fitMode,
    panOffset,
    isDragging,
    dragStart,

    isZoomLocked,
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
    panImageBy,
    resetImageView,
  }
}
