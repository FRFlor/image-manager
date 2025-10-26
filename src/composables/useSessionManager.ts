import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { SessionData } from '../types'
import { sessionService } from '../services/sessionService'
import { useTabControls } from './useTabControls'
import { useZoomControls } from './useZoomControls'
import { useUIConfigurations } from './useUIConfigurations'

// Shared state for current session tracking
const currentSessionPath = ref<string | null>(null)
const currentSessionName = ref<string | null>(null)

/**
 * Composable for managing session save/load operations
 * Centralizes all session logic to avoid repetition
 */
export function useSessionManager() {
  const {
    tabs,
    activeTabId,
    tabGroups,
    sortedTabs,
    layoutPosition,
    layoutSize,
    treeCollapsed
  } = useTabControls()

  const { saveZoomAndPanStateIntoTab } = useZoomControls()
  const { areZoomAndNavigationControlsVisible } = useUIConfigurations()

  /**
   * Prepare session data for saving
   * Automatically captures current state including zoom/pan
   */
  const prepareSessionData = (): SessionData => {
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

    console.log(`💾 Preparing session data with ${sessionGroups.length} groups`)

    return {
      tabs: sessionTabs,
      groups: sessionGroups.length > 0 ? sessionGroups : undefined,
      activeTabId: activeTabId.value,
      createdAt: new Date().toISOString(),
      // UI state
      layoutPosition: layoutPosition.value,
      layoutSize: layoutSize.value,
      treeCollapsed: treeCollapsed.value,
      controlsVisible: areZoomAndNavigationControlsVisible.value,
      // Loaded session tracking (for persistence across app restarts)
      loadedSessionName: currentSessionName.value || undefined,
      loadedSessionPath: currentSessionPath.value || undefined
    }
  }

  /**
   * Unified save session method
   * @param type - Type of save operation
   * @param path - Optional path for update operation
   * @returns Success boolean or saved path (for dialog)
   */
  const saveSession = async (
    type: 'auto' | 'dialog' | 'update',
    path?: string
  ): Promise<boolean | string> => {
    console.log(`saveSession called, type: ${type}, tabs count: ${tabs.value.size}`)

    if (type !== 'auto' && tabs.value.size === 0) {
      console.log('No tabs to save')
      return false
    }

    try {
      const sessionData = prepareSessionData()
      console.log('Created session data:', sessionData)

      switch (type) {
        case 'auto': {
          await sessionService.saveAutoSession(sessionData)
          console.log('Auto-session saved successfully')
          return true
        }

        case 'dialog': {
          const savedPath = await sessionService.saveSessionDialog(sessionData)
          if (savedPath) {
            console.log('Session saved to:', savedPath)

            // Update session tracking for reload/update functionality
            const pathParts = savedPath.split(/[\\/]/)
            const fileName = pathParts[pathParts.length - 1] || 'unknown'
            const sessionName = fileName.replace('.session.json', '')

            currentSessionPath.value = savedPath
            currentSessionName.value = sessionName
            console.log(`Session tracking updated: ${sessionName} at ${savedPath}`)

            return savedPath
          } else {
            console.log('Session save cancelled by user')
            return false
          }
        }

        case 'update': {
          if (!path && !currentSessionPath.value) {
            console.log('No path provided for update')
            return false
          }

          const targetPath = path || currentSessionPath.value!
          const targetName = currentSessionName.value || 'session'
          sessionData.name = targetName

          // Use backend command to write the session file
          await invoke('update_session_file', {
            path: targetPath,
            sessionData: sessionData
          })

          console.log('Session updated successfully at:', targetPath)
          return true
        }

        default:
          throw new Error(`Unknown save type: ${type}`)
      }
    } catch (error) {
      console.error(`Failed to save session (${type}):`, error)
      if (type === 'auto') {
        // Don't throw for auto-save to avoid blocking app close
        return false
      }
      throw error
    }
  }

  /**
   * Unified load session method
   * @param type - Type of load operation
   * @param path - Optional path for direct load
   * @returns SessionData if loaded, null otherwise
   */
  const loadSession = async (
    type: 'auto' | 'dialog' | 'path',
    path?: string
  ): Promise<{ sessionData: SessionData; path?: string; name?: string } | null> => {
    console.log(`loadSession called, type: ${type}`)

    try {
      switch (type) {
        case 'auto': {
          const sessionData = await sessionService.loadAutoSession()
          console.log('Loaded auto-session data:', sessionData)
          if (sessionData) {
            console.log('Auto-session loaded successfully')

            // Restore loaded session tracking if present
            if (sessionData.loadedSessionName && sessionData.loadedSessionPath) {
              console.log('Restoring loaded session:', sessionData.loadedSessionName)
              currentSessionName.value = sessionData.loadedSessionName
              currentSessionPath.value = sessionData.loadedSessionPath

              // Update backend menu to show the loaded session
              await invoke('set_loaded_session', {
                name: sessionData.loadedSessionName,
                path: sessionData.loadedSessionPath
              })
            }

            return { sessionData }
          }
          console.log('No auto-session data found')
          return null
        }

        case 'dialog': {
          const result = await sessionService.loadSessionDialog()
          console.log('Loaded session result from dialog:', result)
          if (result) {
            // Update session tracking for reload/update functionality
            currentSessionPath.value = result.path
            currentSessionName.value = result.name
            console.log(`Session tracking updated: ${result.name} at ${result.path}`)

            console.log('Session loaded successfully from dialog')
            return {
              sessionData: result.sessionData,
              path: result.path,
              name: result.name
            }
          }
          console.log('No session data loaded (user cancelled)')
          return null
        }

        case 'path': {
          if (!path) {
            console.log('No path provided for load')
            return null
          }

          const sessionData = await invoke<SessionData>('load_session_from_path', { path })
          if (sessionData) {
            // Extract session name from path
            const pathParts = path.split(/[\\/]/)
            const fileName = pathParts[pathParts.length - 1] || 'unknown'
            const sessionName = fileName.replace('.session.json', '')

            // Update session tracking
            currentSessionPath.value = path
            currentSessionName.value = sessionName

            // Tell backend to update the menu with the loaded session
            await invoke('set_loaded_session', { name: sessionName, path })

            console.log('Session loaded from path:', path)
            return {
              sessionData,
              path,
              name: sessionName
            }
          }
          return null
        }

        default:
          throw new Error(`Unknown load type: ${type}`)
      }
    } catch (error) {
      console.error(`Failed to load session (${type}):`, error)
      return null
    }
  }

  /**
   * Reload the current session from disk
   */
  const reloadCurrentSession = async (): Promise<SessionData | null> => {
    console.log('reloadCurrentSession called')
    if (!currentSessionPath.value) {
      console.log('No current session to reload')
      return null
    }

    const result = await loadSession('path', currentSessionPath.value)
    if (result) {
      console.log('Session reloaded successfully')
      return result.sessionData
    }
    return null
  }

  /**
   * Update the current session file with current state
   */
  const updateCurrentSession = async (): Promise<boolean> => {
    console.log('updateCurrentSession called')
    if (!currentSessionPath.value || !currentSessionName.value) {
      console.log('No current session to update')
      return false
    }

    const result = await saveSession('update', currentSessionPath.value)
    return typeof result === 'boolean' ? result : !!result
  }

  return {
    // State
    currentSessionPath,
    currentSessionName,

    // Methods
    prepareSessionData,
    saveSession,
    loadSession,
    reloadCurrentSession,
    updateCurrentSession
  }
}
