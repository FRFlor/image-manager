/**
 * Shared state composable - Single source of truth for state accessed by multiple composables
 * This prevents circular dependencies and provides a clean way to share reactive state
 */

import { ref } from 'vue'

// SHARED STATE (defined at module level for sharing across composables)

// Active tab ID - shared between useTabControls and useUIConfigurations
const activeTabId = ref<string | null>(null)

/**
 * Composable that provides access to shared reactive state
 * Import and use this in other composables that need shared state
 */
export function useSharedState() {
  return {
    activeTabId
  }
}
