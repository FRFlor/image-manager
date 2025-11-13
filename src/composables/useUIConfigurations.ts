// Controls visibility state (global)
import { ref } from "vue"
import { useSharedState } from './useSharedState'
import { useTabControls } from './useTabControls'

// Get shared state
const { activeTabId } = useSharedState()

// UI visibility state
const areZoomAndNavigationControlsVisible = ref(true)

// Folder grid view state
const showFolderGrid = ref(false)
const folderGridFocusedIndex = ref<number | null>(null)

export function useUIConfigurations() {
    // Get tab controls for accessing tabs and folder contexts
    const { tabs, tabFolderContexts } = useTabControls()

    const toggleControlsVisibility = () => {
        areZoomAndNavigationControlsVisible.value = !areZoomAndNavigationControlsVisible.value
        console.log(`Controls visibility: ${areZoomAndNavigationControlsVisible.value ? 'visible' : 'hidden'}`)
    }

    const toggleFolderGrid = (): void => {
        if (!activeTabId.value) {
            console.warn('No active tab to show folder grid')
            return
        }

        showFolderGrid.value = !showFolderGrid.value

        if (showFolderGrid.value) {
            // When entering folder grid, set focus to current image
            const activeTab = tabs.value.get(activeTabId.value)
            const folderContext = tabFolderContexts.value.get(activeTabId.value)

            if (activeTab && folderContext) {
                const currentImagePath = activeTab.imageData.path
                const currentIndex = folderContext.fileEntries.findIndex(entry => entry.path === currentImagePath)
                folderGridFocusedIndex.value = currentIndex >= 0 ? currentIndex : 0
                console.log(`Entered folder grid view, focused on index ${folderGridFocusedIndex.value}`)
            }
        } else {
            console.log('Exited folder grid view')
        }
    }

    const setFolderGridFocus = (index: number): void => {
        folderGridFocusedIndex.value = index
    }

    return {
        areZoomAndNavigationControlsVisible,
        toggleControlsVisibility,
        showFolderGrid,
        folderGridFocusedIndex,
        toggleFolderGrid,
        setFolderGridFocus
    }
}