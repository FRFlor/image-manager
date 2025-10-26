// Controls visibility state (global)
import {ref} from "vue"

const areZoomAndNavigationControlsVisible = ref(true)

export function useUIConfigurations() {
    const toggleControlsVisibility = () => {
        areZoomAndNavigationControlsVisible.value = !areZoomAndNavigationControlsVisible.value
        console.log(`Controls visibility: ${areZoomAndNavigationControlsVisible.value ? 'visible' : 'hidden'}`)
    }


    return {areZoomAndNavigationControlsVisible, toggleControlsVisibility}
}