import { ref, computed } from 'vue'
import type { TabData, ImageData, FolderContext, TabGroup } from '../types'

// SHARED STATE

// Reactive state
const tabs = ref<Map<string, TabData>>(new Map())
const activeTabId = ref<string | null>(null)
const tabFolderContexts = ref<Map<string, FolderContext>>(new Map())

// Tab groups state
const tabGroups = ref<Map<string, TabGroup>>(new Map())
const selectedGroupId = ref<string | null>(null)
const collapsedGroupIds = ref<Set<string>>(new Set())
let nextGroupColorIndex = 0

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTabId = ref<string | null>(null)


export function useTabControls() {

  // Computed properties
  const sortedTabs = computed(() => {
    return Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
  })

  const activeTab = computed(() => {
    if (!activeTabId.value) return null
    return tabs.value.get(activeTabId.value) || null
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

  // Helper function to get next tab order
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

  // Tab management functions
  const openTab = (imageData: ImageData, folderContext: FolderContext) => {
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
      isFullyLoaded: true,
      groupId: groupId
    }

    // If adding to a group, update the group's tabIds
    if (groupId) {
      const group = tabGroups.value.get(groupId)
      if (group) {
        const oldTabIndex = group.tabIds.indexOf(activeTabId.value!)
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

    // Store folder context for this tab
    tabFolderContexts.value.set(tabId, folderContext)

    console.log(`✨ Opened image: ${imageData.name}`)
    console.log(`📁 Folder contains ${folderContext.fileEntries.length} images (${folderContext.loadedImages.size} loaded)`)

    return tabId
  }

  const switchToTab = (tabId: string, saveStateCallback?: (tabId: string) => void) => {
    const tab = tabs.value.get(tabId)
    if (!tab) return

    // Save current tab's state before switching (if callback provided)
    if (activeTabId.value && saveStateCallback) {
      saveStateCallback(activeTabId.value)
    }

    // Update active states
    tabs.value.forEach(t => { t.isActive = false })
    tab.isActive = true
    activeTabId.value = tabId
    selectedGroupId.value = null // Clear group selection when switching to a tab

    return tab
  }

  const closeTab = (tabId: string, beforeCloseCallback?: (tabId: string) => void) => {
    const tabToClose = tabs.value.get(tabId)
    if (!tabToClose) return

    // Remove from group if it's in one
    if (tabToClose.groupId) {
      removeTabFromGroup(tabId)
    }

    // Execute cleanup callback if provided
    if (beforeCloseCallback) {
      beforeCloseCallback(tabId)
    }

    // Clean up folder context for this tab
    tabFolderContexts.value.delete(tabId)
    tabs.value.delete(tabId)

    if (activeTabId.value === tabId) {
      // Find another tab to activate - prefer the tab to the right, then left
      const remainingTabs = Array.from(tabs.value.values()).sort((a, b) => a.order - b.order)
      if (remainingTabs.length > 0) {
        const closedTabOrder = tabToClose.order
        let newActiveTab = remainingTabs.find(tab => tab.order > closedTabOrder)
        if (!newActiveTab) {
          newActiveTab = remainingTabs[remainingTabs.length - 1]
        }
        if (newActiveTab) {
          return newActiveTab.id // Return the new active tab ID
        }
      } else {
        activeTabId.value = null
        return null
      }
    }
  }

  const switchToNextTab = () => {
    const tabArray = sortedTabs.value
    if (tabArray.length <= 1) return

    const currentIndex = tabArray.findIndex(tab => tab.id === activeTabId.value)
    const nextIndex = (currentIndex + 1) % tabArray.length
    const nextTab = tabArray[nextIndex]
    if (nextTab) {
      return nextTab.id
    }
  }

  const switchToPreviousTab = () => {
    const tabArray = sortedTabs.value
    if (tabArray.length <= 1) return

    const currentIndex = tabArray.findIndex(tab => tab.id === activeTabId.value)
    const prevIndex = currentIndex === 0 ? tabArray.length - 1 : currentIndex - 1
    const prevTab = tabArray[prevIndex]
    if (prevTab) {
      return prevTab.id
    }
  }

  const closeCurrentTab = () => {
    if (activeTabId.value) {
      return activeTabId.value
    }
  }

  // Tab reordering functions
  const moveTab = (direction: 'left' | 'right', tabId: string | null = null) => {
    if (direction === 'left') {
      return moveTabLeft(tabId)
    }
    return moveTabRight(tabId)
  }

  const moveTabRight = (tabId: string | null = null) => {
    // Case B: Group header is selected - move entire group
    if (selectedGroupId.value && !tabId) {
      moveGroupRight(selectedGroupId.value)
      return
    }

    const targetTabId = tabId ?? activeTabId.value
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
        console.log(`Moved tab "${targetTab.title}" to the right within group`)
      }
      return
    }

    // Case A: Ungrouped tab - swap with right tab/group
    const rightTab = allTabs[currentIndex + 1]
    if (!rightTab) return

    if (rightTab.groupId) {
      const rightGroupTabs = allTabs.filter(tab => tab.groupId === rightTab.groupId)
      const maxGroupOrder = Math.max(...rightGroupTabs.map(t => t.order))

      targetTab.order = maxGroupOrder
      rightGroupTabs.forEach(tab => {
        tab.order = tab.order - 1
      })

      console.log(`Moved ungrouped tab "${targetTab.title}" past group to the right`)
    } else {
      const tempOrder = targetTab.order
      targetTab.order = rightTab.order
      rightTab.order = tempOrder
      console.log(`Moved tab "${targetTab.title}" to the right`)
    }
  }

  const moveTabLeft = (tabId: string | null = null) => {
    // Case B: Group header is selected - move entire group
    if (selectedGroupId.value && !tabId) {
      moveGroupLeft(selectedGroupId.value)
      return
    }

    const targetTabId = tabId ?? activeTabId.value
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
        console.log(`Moved tab "${targetTab.title}" to the left within group`)
      }
      return
    }

    // Case A: Ungrouped tab - swap with left tab/group
    const leftTab = allTabs[currentIndex - 1]
    if (!leftTab) return

    if (leftTab.groupId) {
      const leftGroupTabs = allTabs.filter(tab => tab.groupId === leftTab.groupId)
      const minGroupOrder = Math.min(...leftGroupTabs.map(t => t.order))

      targetTab.order = minGroupOrder
      leftGroupTabs.forEach(tab => {
        tab.order = tab.order + 1
      })

      console.log(`Moved ungrouped tab "${targetTab.title}" past group to the left`)
    } else {
      const tempOrder = targetTab.order
      targetTab.order = leftTab.order
      leftTab.order = tempOrder
      console.log(`Moved tab "${targetTab.title}" to the left`)
    }
  }

  // Group management functions
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

  const removeTabFromGroup = (tabId: string): void => {
    const tab = tabs.value.get(tabId)
    if (!tab || !tab.groupId) return

    const group = tabGroups.value.get(tab.groupId)
    if (!group) return

    const tabIndex = group.tabIds.indexOf(tabId)
    if (tabIndex === -1) return

    const isInMiddle = tabIndex > 0 && tabIndex < group.tabIds.length - 1

    if (isInMiddle) {
      // Split the group into two
      const tabsBefore = group.tabIds.slice(0, tabIndex)
      const tabsAfter = group.tabIds.slice(tabIndex + 1)

      console.log(`Splitting group "${group.name}": [${tabsBefore.length}] + removed + [${tabsAfter.length}]`)

      group.tabIds = tabsBefore

      if (tabsAfter.length > 0) {
        const newGroupName = `${group.name} (split)`
        const newGroup = createGroup(newGroupName, tabsAfter)
        console.log(`Created new group "${newGroup.name}" with ${tabsAfter.length} tabs after split`)
        autoDissolveSmallGroups(newGroup.id)
      }

      autoDissolveSmallGroups(group.id)
    } else {
      group.tabIds = group.tabIds.filter(id => id !== tabId)
      console.log(`Removed tab "${tab.title}" from ${tabIndex === 0 ? 'beginning' : 'end'} of group "${group.name}"`)

      if (group.tabIds.length === 0) {
        tabGroups.value.delete(group.id)
        if (selectedGroupId.value === group.id) {
          selectedGroupId.value = null
        }
        console.log(`Auto-deleted empty group "${group.name}"`)
      } else {
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

    const groupTabs: TabData[] = []
    for (const tabId of group.tabIds) {
      const tab = tabs.value.get(tabId)
      if (tab) {
        groupTabs.push(tab)
      }
    }

    groupTabs.sort((a, b) => a.order - b.order)
    return groupTabs.map(tab => tab.id)
  }

  const selectGroupHeader = (groupId: string): void => {
    activeTabId.value = null
    selectedGroupId.value = groupId
    console.log(`Selected group header: "${getGroupName(groupId)}"`)
  }

  const toggleGroupCollapse = (groupId: string) => {
    if (collapsedGroupIds.value.has(groupId)) {
      collapsedGroupIds.value.delete(groupId)
      console.log(`Group ${groupId} expanded`)
    } else {
      collapsedGroupIds.value.add(groupId)
      console.log(`Group ${groupId} collapsed`)
    }
  }

  const moveGroupRight = (groupId: string): void => {
    const group = tabGroups.value.get(groupId)
    if (!group) return

    const allTabs = sortedTabs.value
    const groupTabs = allTabs.filter(tab => tab.groupId === groupId)

    if (groupTabs.length === 0) return

    const lastGroupTab = groupTabs[groupTabs.length - 1]
    if (!lastGroupTab) return
    const lastGroupIndex = allTabs.findIndex(t => t.id === lastGroupTab.id)

    if (lastGroupIndex >= allTabs.length - 1) return

    const rightTab = allTabs[lastGroupIndex + 1]
    if (!rightTab) return

    if (rightTab.groupId === groupId) return

    if (rightTab.groupId) {
      const rightGroupTabs = allTabs.filter(tab => tab.groupId === rightTab.groupId)
      const groupSize = groupTabs.length
      const rightGroupSize = rightGroupTabs.length

      groupTabs.forEach(tab => {
        tab.order = tab.order + rightGroupSize
      })

      rightGroupTabs.forEach(tab => {
        tab.order = tab.order - groupSize
      })

      console.log(`Moved group "${group.name}" to the right (swapped with group)`)
    } else {
      const minGroupOrder = Math.min(...groupTabs.map(t => t.order))

      rightTab.order = minGroupOrder

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

    const firstGroupTab = groupTabs[0]
    if (!firstGroupTab) return
    const firstGroupIndex = allTabs.findIndex(t => t.id === firstGroupTab.id)

    if (firstGroupIndex <= 0) return

    const leftTab = allTabs[firstGroupIndex - 1]
    if (!leftTab) return

    if (leftTab.groupId === groupId) return

    if (leftTab.groupId) {
      const leftGroupTabs = allTabs.filter(tab => tab.groupId === leftTab.groupId)
      const groupSize = groupTabs.length
      const leftGroupSize = leftGroupTabs.length

      groupTabs.forEach(tab => {
        tab.order = tab.order - leftGroupSize
      })

      leftGroupTabs.forEach(tab => {
        tab.order = tab.order + groupSize
      })

      console.log(`Moved group "${group.name}" to the left (swapped with group)`)
    } else {
      const maxGroupOrder = Math.max(...groupTabs.map(t => t.order))

      leftTab.order = maxGroupOrder

      groupTabs.forEach(tab => {
        tab.order = tab.order - 1
      })

      console.log(`Moved group "${group.name}" to the left (swapped with tab)`)
    }
  }

  const joinWithLeft = (): void => {
    // Case B: Group header is selected
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

      if (leftTarget.groupId) {
        const leftGroupId = leftTarget.groupId
        const leftGroupTabs = allTabs.filter(tab => tab.groupId === leftGroupId)
        leftGroupTabs.forEach(tab => {
          tab.groupId = selectedGroupId.value!
          if (!group.tabIds.includes(tab.id)) {
            group.tabIds.push(tab.id)
          }
        })
        tabGroups.value.delete(leftGroupId)
        console.log(`Merged left group into "${group.name}"`)
        autoDissolveSmallGroups(selectedGroupId.value!)
      } else {
        leftTarget.groupId = selectedGroupId.value!
        if (!group.tabIds.includes(leftTarget.id)) {
          group.tabIds.push(leftTarget.id)
        }
        console.log(`Merged left tab "${leftTarget.title}" into "${group.name}"`)
      }
      return
    }

    // Case C: Grouped tab is active
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
        const newGroup = createGroup(`Group ${tabGroups.value.size + 1}`, [leftTab.id, activeTab.id])
        console.log(`Created new group "${newGroup.name}" with left tab and active tab`)
      }
    }
  }

  const joinWithRight = (): void => {
    // Case B: Group header is selected
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

      if (rightTarget.groupId) {
        const rightGroupId = rightTarget.groupId
        const rightGroupTabs = allTabs.filter(tab => tab.groupId === rightGroupId)
        rightGroupTabs.forEach(tab => {
          tab.groupId = selectedGroupId.value!
          if (!group.tabIds.includes(tab.id)) {
            group.tabIds.push(tab.id)
          }
        })
        tabGroups.value.delete(rightGroupId)
        console.log(`Merged right group into "${group.name}"`)
        autoDissolveSmallGroups(selectedGroupId.value!)
      } else {
        rightTarget.groupId = selectedGroupId.value!
        if (!group.tabIds.includes(rightTarget.id)) {
          group.tabIds.push(rightTarget.id)
        }
        console.log(`Merged right tab "${rightTarget.title}" into "${group.name}"`)
      }
      return
    }

    // Case C: Grouped tab is active
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
        const newGroup = createGroup(`Group ${tabGroups.value.size + 1}`, [activeTab.id, rightTab.id])
        console.log(`Created new group "${newGroup.name}" with active tab and right tab`)
      }
    }
  }

  // Context menu functions
  const showTabContextMenu = (event: MouseEvent, tabId: string) => {
    contextMenuPosition.value = { x: event.clientX, y: event.clientY }
    contextMenuTabId.value = tabId
    contextMenuVisible.value = true

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
    return tabsToClose
  }

  const closeTabsToRight = () => {
    if (!contextMenuTabId.value) return

    const tabArray = sortedTabs.value
    const contextTabIndex = tabArray.findIndex(tab => tab.id === contextMenuTabId.value)

    if (contextTabIndex >= 0) {
      const tabsToClose = tabArray.slice(contextTabIndex + 1)
      return tabsToClose.map(tab => tab.id)
    }
    return []
  }

  const closeTabsToLeft = () => {
    if (!contextMenuTabId.value) return

    const tabArray = sortedTabs.value
    const contextTabIndex = tabArray.findIndex(tab => tab.id === contextMenuTabId.value)

    if (contextTabIndex >= 0) {
      const tabsToClose = tabArray.slice(0, contextTabIndex)
      return tabsToClose.map(tab => tab.id)
    }
    return []
  }

  const contextMenuCreateGroupWithNext = () => {
    if (!contextMenuTabId.value) return

    const tabArray = sortedTabs.value
    const currentIndex = tabArray.findIndex(tab => tab.id === contextMenuTabId.value)

    if (currentIndex === -1 || currentIndex >= tabArray.length - 1) {
      console.log('Cannot create group: no next tab')
      return null
    }

    const currentTab = tabArray[currentIndex]
    const nextTab = tabArray[currentIndex + 1]

    if (currentTab && nextTab) {
      const groupName = `Group ${tabGroups.value.size + 1}`
      const group = createGroup(groupName, [currentTab.id, nextTab.id])
      console.log(`✅ Created group "${groupName}" with "${currentTab.title}" and "${nextTab.title}"`)
      return group
    }
  }

  const contextMenuRenameGroup = () => {
    if (!contextMenuTabId.value) return

    const tab = tabs.value.get(contextMenuTabId.value)
    if (!tab || !tab.groupId) return

    const group = tabGroups.value.get(tab.groupId)
    if (!group) return

    return { groupId: group.id, currentName: group.name }
  }

  const contextMenuRemoveFromGroup = () => {
    if (!contextMenuTabId.value) return null

    const tab = tabs.value.get(contextMenuTabId.value)
    if (!tab || !tab.groupId) return null

    return contextMenuTabId.value
  }

  const contextMenuDissolveGroup = () => {
    if (!contextMenuTabId.value) return null

    const tab = tabs.value.get(contextMenuTabId.value)
    if (!tab || !tab.groupId) return null

    const group = tabGroups.value.get(tab.groupId)
    if (!group) return null

    return { groupId: group.id, groupName: group.name, tabCount: group.tabIds.length }
  }

  // Clear tabs (for session restore)
  const clearTabs = () => {
    tabs.value.clear()
    tabFolderContexts.value.clear()
    tabGroups.value.clear()
    activeTabId.value = null
    selectedGroupId.value = null
  }

  // Set next group color index (for session restore)
  const setNextGroupColorIndex = (index: number) => {
    nextGroupColorIndex = index
  }

  return {
    // State
    tabs,
    activeTabId,
    tabFolderContexts,
    tabGroups,
    selectedGroupId,
    collapsedGroupIds,
    contextMenuVisible,
    contextMenuPosition,
    contextMenuTabId,

    // Computed
    sortedTabs,
    activeTab,
    treeViewItems,

    // Tab management
    openTab,
    switchToTab,
    closeTab,
    switchToNextTab,
    switchToPreviousTab,
    closeCurrentTab,
    clearTabs,

    // Tab reordering
    moveTab,
    moveTabRight,
    moveTabLeft,

    // Group management
    createGroup,
    removeTabFromGroup,
    renameGroup,
    dissolveGroup,
    getGroupColor,
    getGroupName,
    getGroupTabIds,
    selectGroupHeader,
    toggleGroupCollapse,
    moveGroupRight,
    moveGroupLeft,
    joinWithLeft,
    joinWithRight,
    setNextGroupColorIndex,

    // Context menu
    showTabContextMenu,
    closeOtherTabs,
    closeTabsToRight,
    closeTabsToLeft,
    contextMenuCreateGroupWithNext,
    contextMenuRenameGroup,
    contextMenuRemoveFromGroup,
    contextMenuDissolveGroup
  }
}
