import { ref, computed } from 'vue'

// Edge detection thresholds (in pixels)
const LEFT_EDGE_THRESHOLD = 50
const TOP_EDGE_THRESHOLD = 50
const RIGHT_EDGE_THRESHOLD = 150 // Account for ZoomControls width
const BOTTOM_EDGE_THRESHOLD = 100 // Account for InfoBar height

// Shared mouse position state
const mouseX = ref(0)
const mouseY = ref(0)
const viewportWidth = ref(window.innerWidth)
const viewportHeight = ref(window.innerHeight)

/**
 * Composable for detecting mouse position at screen edges in fullscreen mode
 * Used to show/hide UI controls based on hover location
 */
export function useFullscreenHover() {
  /**
   * Update mouse position
   */
  const updateMousePosition = (event: MouseEvent) => {
    mouseX.value = event.clientX
    mouseY.value = event.clientY
  }

  /**
   * Update viewport dimensions (e.g., on window resize)
   */
  const updateViewportSize = () => {
    viewportWidth.value = window.innerWidth
    viewportHeight.value = window.innerHeight
  }

  /**
   * Check if mouse is at the left edge (for tree TabBar)
   */
  const isMouseAtLeftEdge = computed(() => {
    return mouseX.value < LEFT_EDGE_THRESHOLD
  })

  /**
   * Check if mouse is at the top edge (for top TabBar)
   */
  const isMouseAtTopEdge = computed(() => {
    return mouseY.value < TOP_EDGE_THRESHOLD
  })

  /**
   * Check if mouse is at the right edge (for ZoomControls)
   */
  const isMouseAtRightEdge = computed(() => {
    return mouseX.value > viewportWidth.value - RIGHT_EDGE_THRESHOLD
  })

  /**
   * Check if mouse is at the bottom edge (for InfoBar)
   */
  const isMouseAtBottomEdge = computed(() => {
    return mouseY.value > viewportHeight.value - BOTTOM_EDGE_THRESHOLD
  })

  return {
    mouseX,
    mouseY,
    updateMousePosition,
    updateViewportSize,
    isMouseAtLeftEdge,
    isMouseAtTopEdge,
    isMouseAtRightEdge,
    isMouseAtBottomEdge
  }
}
