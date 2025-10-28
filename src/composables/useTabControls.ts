import {computed, ref} from 'vue'
import type {FolderContext, ImageData, TabData, TabGroup} from '../types'

// CONSTANTS
export const FAVOURITES_GROUP_ID = 'favourites'

// SHARED STATE

// Reactive state
const tabs = ref<Map<string, TabData>>(new Map())
const activeTabId = ref<string | null>(null)
const tabFolderContexts = ref<Map<string, FolderContext>>(new Map())

// Tab groups state
const tabGroups = ref<Map<string, TabGroup>>(new Map())
const selectedGroupId = ref<string | null>(null)
let nextGroupColorIndex = 0

// Context menu state
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTabId = ref<string | null>(null)

// Multi-selection state
const selectedTabIds = ref<Set<string>>(new Set())
const lastClickedTabId = ref<string | null>(null)

// Tab layout state (split into position and size)
const layoutPosition = ref<'invisible' | 'top' | 'tree'>('tree')
const layoutSize = ref<'small' | 'large'>('small')
const treeCollapsed = ref(false)

// Duplicate tab detection state
interface DuplicateTabInfo {
  tabId: string
  tabTitle: string
  groupName?: string
}
const duplicateTabs = ref<DuplicateTabInfo[]>([])

// Initialize Favourites group at module level
if (!tabGroups.value.has(FAVOURITES_GROUP_ID)) {
  const favouritesGroup: TabGroup = {
    id: FAVOURITES_GROUP_ID,
    name: 'Favourites',
    color: 'gold',
    order: -1, // Ensures it's always first
    collapsed: false
  }
  tabGroups.value.set(FAVOURITES_GROUP_ID, favouritesGroup)
}

export function useTabControls() {
  const shouldGroupBeCollapsed = function(groupId?: string) {
      if (! groupId) {
          return false;
      }
      // Groups that have the activeTab should auto-expand
      let userSetThisGroupAsCollapsed = tabGroups.value.get(groupId)?.collapsed
      let currentActiveTabOutsideOfThisGroup = activeTab.value?.groupId !== groupId
      return userSetThisGroupAsCollapsed && currentActiveTabOutsideOfThisGroup
  }

  // Computed properties
  const sortedTabs = computed(() => {
    // Sort tabs, ensuring favourites group tabs always come first
    const allTabs = Array.from(tabs.value.values())
    const favouritesTabs = allTabs.filter(tab => tab.groupId === FAVOURITES_GROUP_ID)
    const otherTabs = allTabs.filter(tab => tab.groupId !== FAVOURITES_GROUP_ID)

    // Sort each group by order
    favouritesTabs.sort((a, b) => a.order - b.order)
    otherTabs.sort((a, b) => a.order - b.order)

    // Favourites first, then others
    return [...favouritesTabs, ...otherTabs]
  })

  const activeTab = computed(() => {
    if (!activeTabId.value) return null
    return tabs.value.get(activeTabId.value) || null
  })

  const currentLayout = computed(() => {
    if (layoutPosition.value === 'invisible') return 'invisible'
    return `${layoutPosition.value}-${layoutSize.value}` as 'top-small' | 'top-large' | 'tree-small' | 'tree-large'
  })

  // Tree view items with group headers
  type TreeViewItem = { type: 'group', groupId: string } | { type: 'tab', tab: TabData }
  const treeViewItems = computed((): TreeViewItem[] => {
    const items: TreeViewItem[] = []
    const processedGroups = new Set<string>()

    // Always add Favourites group header first, even if empty
    if (tabGroups.value.has(FAVOURITES_GROUP_ID)) {
      items.push({ type: 'group', groupId: FAVOURITES_GROUP_ID })
      processedGroups.add(FAVOURITES_GROUP_ID)
    }

    for (const tab of sortedTabs.value) {
      // If tab has a group and we haven't processed it yet, add group header
      if (tab.groupId && !processedGroups.has(tab.groupId)) {
        items.push({ type: 'group', groupId: tab.groupId })
        processedGroups.add(tab.groupId)
      }
      // Add the tab only if its group is not collapsed (or if it has no group)
      if (!tab.groupId || !shouldGroupBeCollapsed(tab.groupId)) {
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

    // Only inherit groupId if the group actually exists (prevents orphaned groupIds)
    let groupId: string | undefined = undefined
    if (oldActiveTab?.groupId) {
      const group = tabGroups.value.get(oldActiveTab.groupId)
      if (group) {
        groupId = oldActiveTab.groupId
        console.log(`Added new tab to group "${group.name}" after active tab`)
      } else {
        console.warn(`Active tab has orphaned groupId "${oldActiveTab.groupId}", not copying to new tab`)
      }
    }

    const tab: TabData = {
      id: tabId,
      title: imageData.name,
      imageData,
      isActive: true,
      order: getNextTabOrder(),
      isFullyLoaded: true,
      groupId: groupId
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

    // Remove from selection if selected
    selectedTabIds.value.delete(tabId)
    if (lastClickedTabId.value === tabId) {
      lastClickedTabId.value = null
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

  const switchToTabDelta = (delta: number, shouldSkipCollapsedGroups: boolean = false) => {
    const tabs = sortedTabs.value ?? [];
    if (tabs.length <= 1) return;

    const activeId = activeTabId.value;
    if (!activeId) return;

    const start = tabs.findIndex(t => t.id === activeId);
    if (start === -1) return;

    const isCollapsed = (tab: TabData) => {
      if (shouldSkipCollapsedGroups) {
        return false;
      }
      const gid = tab.groupId;
      return !!(gid && tabGroups.value.get(gid)?.collapsed);
    };

    // normalize delta to avoid huge jumps (e.g., ±1000)
    const stepDirection = Math.sign(delta) || 1;
    const maxSteps = tabs.length - 1;

    for (let step = 1; step <= maxSteps; step++) {
      const i = (start + step * stepDirection + tabs.length) % tabs.length;
      const candidate = tabs[i];
      if (!candidate) {
        console.error("Failed to find tab")
        return
      }
      if (!isCollapsed(candidate)) {
        return candidate.id;
      }
    }

    return;
  };

  const switchToNextTab = () => switchToTabDelta(1);
  const switchToPreviousTab = () => switchToTabDelta(-1);

  const switchToNextGroup = () => {
    const items = treeViewItems.value
    if (items.length === 0) return

    // Find current position
    let currentIndex = -1
    if (selectedGroupId.value) {
      currentIndex = items.findIndex(item => item.type === 'group' && item.groupId === selectedGroupId.value)
    } else if (activeTabId.value) {
      currentIndex = items.findIndex(item => item.type === 'tab' && item.tab.id === activeTabId.value)
    }

    // Start from next position
    const startIndex = currentIndex + 1

    // Search forward for next group or ungrouped tab
    for (let i = startIndex; i < items.length; i++) {
      const item = items[i]
      if (!item) continue

      if (item.type === 'group') {
        selectGroupHeader(item.groupId)
        console.log(`Switched to group: "${getGroupName(item.groupId)}"`)
        return
      } else if (item.type === 'tab' && !item.tab.groupId) {
        switchToTab(item.tab.id)
        console.log(`Switched to ungrouped tab: "${item.tab.title}"`)
        return
      }
    }

    // Wrap around to beginning
    for (let i = 0; i < startIndex && i < items.length; i++) {
      const item = items[i]
      if (!item) continue

      if (item.type === 'group') {
        selectGroupHeader(item.groupId)
        console.log(`Switched to group (wrapped): "${getGroupName(item.groupId)}"`)
        return
      } else if (item.type === 'tab' && !item.tab.groupId) {
        switchToTab(item.tab.id)
        console.log(`Switched to ungrouped tab (wrapped): "${item.tab.title}"`)
        return
      }
    }
  }

  const switchToPreviousGroup = () => {
    const items = treeViewItems.value
    if (items.length === 0) return

    // Find current position
    let currentIndex = -1
    if (selectedGroupId.value) {
      currentIndex = items.findIndex(item => item.type === 'group' && item.groupId === selectedGroupId.value)
    } else if (activeTabId.value) {
      currentIndex = items.findIndex(item => item.type === 'tab' && item.tab.id === activeTabId.value)
    }

    // Start from previous position
    const startIndex = currentIndex === -1 ? items.length - 1 : currentIndex - 1

    // Search backward for previous group or ungrouped tab
    for (let i = startIndex; i >= 0; i--) {
      const item = items[i]
      if (!item) continue

      if (item.type === 'group') {
        selectGroupHeader(item.groupId)
        console.log(`Switched to group: "${getGroupName(item.groupId)}"`)
        return
      } else if (item.type === 'tab' && !item.tab.groupId) {
        switchToTab(item.tab.id)
        console.log(`Switched to ungrouped tab: "${item.tab.title}"`)
        return
      }
    }

    // Wrap around to end
    for (let i = items.length - 1; i > startIndex; i--) {
      const item = items[i]
      if (!item) continue

      if (item.type === 'group') {
        selectGroupHeader(item.groupId)
        console.log(`Switched to group (wrapped): "${getGroupName(item.groupId)}"`)
        return
      } else if (item.type === 'tab' && !item.tab.groupId) {
        switchToTab(item.tab.id)
        console.log(`Switched to ungrouped tab (wrapped): "${item.tab.title}"`)
        return
      }
    }
  }

  const closeCurrentTab = () => {
    if (activeTabId.value) {
      return activeTabId.value
    }
  }

  // Multi-selection functions
  const handleTabClick = (tabId: string, isShift: boolean, saveStateCallback?: (tabId: string) => void) => {
    if (isShift && lastClickedTabId.value) {
      // Shift+click: Select range from lastClicked to current
      selectTabRange(lastClickedTabId.value, tabId)
      // Don't change active tab on shift+click
    } else {
      // Normal click: Switch to tab and clear selection
      clearSelection()
      switchToTab(tabId, saveStateCallback)
      lastClickedTabId.value = tabId
    }
  }

  const selectTabRange = (fromTabId: string, toTabId: string) => {
    const tabArray = sortedTabs.value
    const fromIndex = tabArray.findIndex(tab => tab.id === fromTabId)
    const toIndex = tabArray.findIndex(tab => tab.id === toTabId)

    if (fromIndex === -1 || toIndex === -1) return

    const startIndex = Math.min(fromIndex, toIndex)
    const endIndex = Math.max(fromIndex, toIndex)

    // Clear previous selection and select range
    selectedTabIds.value.clear()
    for (let i = startIndex; i <= endIndex; i++) {
      const tab = tabArray[i]
      if (tab) {
        selectedTabIds.value.add(tab.id)
      }
    }

    console.log(`Selected ${selectedTabIds.value.size} tabs (range)`)
  }

  const clearSelection = () => {
    selectedTabIds.value.clear()
  }

  const isTabSelected = (tabId: string): boolean => {
    return selectedTabIds.value.has(tabId)
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
  const createGroup = (name: string, tabIds: string[], color?: 'blue' | 'orange' | 'gold'): TabGroup => {
    const groupId = `group-${Date.now()}`
    const groupColor: 'blue' | 'orange' | 'gold' = color || (nextGroupColorIndex % 2 === 0 ? 'blue' : 'orange')
    if (!color) {
      nextGroupColorIndex++
    }

    const group: TabGroup = {
      id: groupId,
      name,
      color: groupColor,
      order: getNextTabOrder(),
      collapsed: false
    }

    tabGroups.value.set(groupId, group)

    // Assign groupId to all tabs (this is the single source of truth for membership)
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

    const savedGroupId = tab.groupId
    const group = tabGroups.value.get(savedGroupId)

    // CRITICAL: Clear groupId FIRST to prevent orphaned references
    tab.groupId = undefined

    // If group doesn't exist, tab had orphaned groupId - already fixed by clearing above
    if (!group) {
      console.log(`Tab "${tab.title}" had orphaned groupId, cleared it`)
      return
    }

    // Get all tabs in this group (sorted by order)
    const groupTabsSorted = sortedTabs.value.filter(t => t.groupId === savedGroupId)
    const tabIndex = groupTabsSorted.findIndex(t => t.id === tabId)

    // If tab wasn't found in group (inconsistent state), it's already cleared
    if (tabIndex === -1) {
      console.log(`Tab "${tab.title}" wasn't in group's tab list (inconsistent state), cleared groupId`)
      autoDissolveSmallGroups(savedGroupId)
      return
    }

    const isInMiddle = tabIndex > 0 && tabIndex < groupTabsSorted.length - 1

    if (isInMiddle) {
      // Split the group into two
      const tabsBefore = groupTabsSorted.slice(0, tabIndex).map(t => t.id)
      const tabsAfter = groupTabsSorted.slice(tabIndex + 1).map(t => t.id)

      console.log(`Splitting group "${group.name}": [${tabsBefore.length}] + removed + [${tabsAfter.length}]`)

      // tabsBefore keep their groupId (already set), no action needed

      if (tabsAfter.length > 0) {
        const newGroupName = `${group.name} (split)`
        const newGroup = createGroup(newGroupName, tabsAfter)
        console.log(`Created new group "${newGroup.name}" with ${tabsAfter.length} tabs after split`)
        autoDissolveSmallGroups(newGroup.id)
      }

      autoDissolveSmallGroups(savedGroupId)
    } else {
      // Tab was at beginning or end - just clearing groupId is enough
      console.log(`Removed tab "${tab.title}" from ${tabIndex === 0 ? 'beginning' : 'end'} of group "${group.name}"`)

      // Check if group is now empty
      const remainingTabs = sortedTabs.value.filter(t => t.groupId === savedGroupId)
      if (remainingTabs.length === 0) {
        tabGroups.value.delete(savedGroupId)
        if (selectedGroupId.value === savedGroupId) {
          selectedGroupId.value = null
        }
        console.log(`Auto-deleted empty group "${group.name}"`)
      } else {
        autoDissolveSmallGroups(savedGroupId)
      }
    }
  }

  const renameGroup = (groupId: string, newName: string): void => {
    // Prevent renaming the Favourites group
    if (groupId === FAVOURITES_GROUP_ID) {
      console.warn('Cannot rename the Favourites group')
      return
    }

    const group = tabGroups.value.get(groupId)
    if (!group) return

    console.log(`Renamed group from "${group.name}" to "${newName}"`)
    group.name = newName
  }

  const dissolveGroup = (groupId: string): void => {
    // Prevent dissolving the Favourites group
    if (groupId === FAVOURITES_GROUP_ID) {
      console.warn('Cannot dissolve the Favourites group')
      return
    }

    const group = tabGroups.value.get(groupId)
    if (!group) return

    // Scan ALL tabs and clear any that reference this group (defensive cleanup)
    tabs.value.forEach(tab => {
      if (tab.groupId === groupId) {
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
    // Never auto-dissolve the Favourites group
    if (groupId === FAVOURITES_GROUP_ID) {
      return
    }

    const group = tabGroups.value.get(groupId)
    if (!group) return

    const tabCount = getGroupTabIds(groupId).length
    if (tabCount <= 1) {
      console.log(`Auto-dissolving group "${group.name}" (only ${tabCount} tab remaining)`)
      dissolveGroup(groupId)
    }
  }

  const getGroupColor = (groupId: string): 'blue' | 'orange' | 'gold' | null => {
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

    // Filter all tabs by groupId and sort by order (single source of truth)
    const groupTabs = sortedTabs.value.filter(tab => tab.groupId === groupId)
    return groupTabs.map(tab => tab.id)
  }

  // Favourites management functions
  const isImageFavourited = (imagePath: string): boolean => {
    // Check if any tab in the favourites group has this image path
    const favouritesTabs = Array.from(tabs.value.values()).filter(tab => tab.groupId === FAVOURITES_GROUP_ID)
    return favouritesTabs.some(tab => tab.imageData.path === imagePath)
  }

  const toggleFavourite = (): void => {
    if (!activeTabId.value) {
      console.warn('No active tab to favourite')
      return
    }

    const activeTab = tabs.value.get(activeTabId.value)
    if (!activeTab) return

    const imagePath = activeTab.imageData.path

    // Check if image is already favourited
    if (isImageFavourited(imagePath)) {
      // Unfavourite: Find and close the tab with this image in favourites group
      const favouritesTabs = Array.from(tabs.value.values()).filter(tab =>
        tab.groupId === FAVOURITES_GROUP_ID && tab.imageData.path === imagePath
      )

      if (favouritesTabs.length > 0) {
        const tabToRemove = favouritesTabs[0]
        if (tabToRemove) {
          // Just remove from group (which will auto-dissolve if needed, but favourites is protected)
          tabToRemove.groupId = undefined
          // Delete the tab entirely from favourites
          tabs.value.delete(tabToRemove.id)
          console.log(`Unfavourited image: ${activeTab.imageData.name}`)
        }
      }
    } else {
      // Favourite: Create a clone tab in favourites group
      const tabId = `tab-${Date.now()}`

      // Get folder context from active tab
      const folderContext = tabFolderContexts.value.get(activeTabId.value)
      if (!folderContext) {
        console.warn('No folder context available for favouriting')
        return
      }

      // Find the highest order in favourites group
      const favouritesTabs = Array.from(tabs.value.values()).filter(tab => tab.groupId === FAVOURITES_GROUP_ID)
      const maxFavouritesOrder = favouritesTabs.length > 0
        ? Math.max(...favouritesTabs.map(tab => tab.order))
        : -1

      const favouriteTab: TabData = {
        id: tabId,
        title: activeTab.imageData.name,
        imageData: activeTab.imageData,
        isActive: false,
        order: maxFavouritesOrder + 1,
        isFullyLoaded: true,
        groupId: FAVOURITES_GROUP_ID,
        zoomLevel: activeTab.zoomLevel,
        fitMode: activeTab.fitMode,
        panOffset: activeTab.panOffset
      }

      tabs.value.set(tabId, favouriteTab)

      // Clone the folder context for the new tab
      const clonedFolderContext: FolderContext = {
        fileEntries: folderContext.fileEntries,
        loadedImages: new Map(folderContext.loadedImages),
        folderPath: folderContext.folderPath
      }
      tabFolderContexts.value.set(tabId, clonedFolderContext)

      console.log(`Favourited image: ${activeTab.imageData.name}`)
    }
  }

  const toggleFavouriteForTab = (targetTabId: string): void => {
    const targetTab = tabs.value.get(targetTabId)
    if (!targetTab) {
      console.warn(`Tab ${targetTabId} not found`)
      return
    }

    const imagePath = targetTab.imageData.path

    // Check if image is already favourited
    if (isImageFavourited(imagePath)) {
      // Unfavourite: Find and close the tab with this image in favourites group
      const favouritesTabs = Array.from(tabs.value.values()).filter(tab =>
        tab.groupId === FAVOURITES_GROUP_ID && tab.imageData.path === imagePath
      )

      if (favouritesTabs.length > 0) {
        const tabToRemove = favouritesTabs[0]
        if (tabToRemove) {
          // Delete the tab entirely from favourites
          tabs.value.delete(tabToRemove.id)
          // Also clean up folder context
          tabFolderContexts.value.delete(tabToRemove.id)
          console.log(`Unfavourited image: ${targetTab.imageData.name}`)
        }
      }
    } else {
      // Favourite: Create a clone tab in favourites group
      const tabId = `tab-${Date.now()}`

      // Get folder context from target tab
      const folderContext = tabFolderContexts.value.get(targetTabId)
      if (!folderContext) {
        console.warn('No folder context available for favouriting')
        return
      }

      // Find the highest order in favourites group
      const favouritesTabs = Array.from(tabs.value.values()).filter(tab => tab.groupId === FAVOURITES_GROUP_ID)
      const maxFavouritesOrder = favouritesTabs.length > 0
        ? Math.max(...favouritesTabs.map(tab => tab.order))
        : -1

      const favouriteTab: TabData = {
        id: tabId,
        title: targetTab.imageData.name,
        imageData: targetTab.imageData,
        isActive: false,
        order: maxFavouritesOrder + 1,
        isFullyLoaded: true,
        groupId: FAVOURITES_GROUP_ID,
        zoomLevel: targetTab.zoomLevel,
        fitMode: targetTab.fitMode,
        panOffset: targetTab.panOffset
      }

      tabs.value.set(tabId, favouriteTab)

      // Clone the folder context for the new tab
      const clonedFolderContext: FolderContext = {
        fileEntries: folderContext.fileEntries,
        loadedImages: new Map(folderContext.loadedImages),
        folderPath: folderContext.folderPath
      }
      tabFolderContexts.value.set(tabId, clonedFolderContext)

      console.log(`Favourited image: ${targetTab.imageData.name}`)
    }
  }

  const selectGroupHeader = (groupId: string): void => {
    activeTabId.value = null
    selectedGroupId.value = groupId
    console.log(`Selected group header: "${getGroupName(groupId)}"`)
  }

  const toggleGroupCollapse = (groupId: string) => {
    const group = tabGroups.value.get(groupId)
    if (!group) return

    group.collapsed = !group.collapsed
    console.log(`Group ${groupId} ${group.collapsed ? 'collapsed' : 'expanded'}`)
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
        // Merge: assign all left group tabs to the selected group
        leftGroupTabs.forEach(tab => {
          tab.groupId = selectedGroupId.value!
        })
        tabGroups.value.delete(leftGroupId)
        console.log(`Merged left group into "${group.name}"`)
        autoDissolveSmallGroups(selectedGroupId.value!)
      } else {
        // Join single tab to group
        leftTarget.groupId = selectedGroupId.value!
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
        // Merge: assign all right group tabs to the selected group
        rightGroupTabs.forEach(tab => {
          tab.groupId = selectedGroupId.value!
        })
        tabGroups.value.delete(rightGroupId)
        console.log(`Merged right group into "${group.name}"`)
        autoDissolveSmallGroups(selectedGroupId.value!)
      } else {
        // Join single tab to group
        rightTarget.groupId = selectedGroupId.value!
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
    // If right-clicking an unselected tab, clear selection
    if (!selectedTabIds.value.has(tabId)) {
      clearSelection()
    }

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

  const contextMenuCanCreateGroupFromSelection = (): { canCreate: boolean, tabIds: string[] } => {
    // Need at least 2 tabs selected
    if (selectedTabIds.value.size < 2) {
      return { canCreate: false, tabIds: [] }
    }

    // Check that ALL selected tabs are ungrouped
    const selectedTabIdArray = Array.from(selectedTabIds.value)
    const allUngrouped = selectedTabIdArray.every(tabId => {
      const tab = tabs.value.get(tabId)
      return tab && !tab.groupId
    })

    if (allUngrouped) {
      return { canCreate: true, tabIds: selectedTabIdArray }
    }

    return { canCreate: false, tabIds: [] }
  }

  const contextMenuRenameGroup = () => {
    if (!contextMenuTabId.value) return

    const tab = tabs.value.get(contextMenuTabId.value)
    if (!tab || !tab.groupId) return

    // Don't allow renaming the Favourites group
    if (tab.groupId === FAVOURITES_GROUP_ID) return

    const group = tabGroups.value.get(tab.groupId)
    if (!group) return

    return { groupId: group.id, currentName: group.name }
  }

  const contextMenuRemoveFromGroup = () => {
    if (!contextMenuTabId.value) return null

    const clickedTab = tabs.value.get(contextMenuTabId.value)
    if (!clickedTab) return null

    // If the clicked tab is in the selection, return all selected tabs that have a groupId
    if (selectedTabIds.value.has(contextMenuTabId.value) && selectedTabIds.value.size > 1) {
      const tabsToRemove = Array.from(selectedTabIds.value)
        .filter(tabId => {
          const tab = tabs.value.get(tabId)
          return tab && tab.groupId
        })
      return tabsToRemove.length > 0 ? tabsToRemove : null
    }

    // Single tab: only return if it has a groupId
    return clickedTab.groupId ? [contextMenuTabId.value] : null
  }

  const contextMenuDissolveGroup = () => {
    if (!contextMenuTabId.value) return null

    const tab = tabs.value.get(contextMenuTabId.value)
    if (!tab || !tab.groupId) return null

    // Don't allow dissolving the Favourites group
    if (tab.groupId === FAVOURITES_GROUP_ID) return null

    const group = tabGroups.value.get(tab.groupId)
    if (!group) return null

    return { groupId: group.id, groupName: group.name, tabCount: getGroupTabIds(group.id).length }
  }

  // Clear tabs (for session restore)
  const clearTabs = () => {
    tabs.value.clear()
    tabFolderContexts.value.clear()
    tabGroups.value.clear()
    activeTabId.value = null
    selectedGroupId.value = null

    // Re-initialize Favourites group after clearing
    const favouritesGroup: TabGroup = {
      id: FAVOURITES_GROUP_ID,
      name: 'Favourites',
      color: 'gold',
      order: -1,
      collapsed: false
    }
    tabGroups.value.set(FAVOURITES_GROUP_ID, favouritesGroup)
  }

  // Set next group color index (for session restore)
  const setNextGroupColorIndex = (index: number) => {
    nextGroupColorIndex = index
  }



  // Tab Layout
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

  // Helper to create session data for new window
  const createNewWindowSessionData = (tabsToInclude: TabData[], groupToInclude?: TabGroup) => {
    const sessionTabs = tabsToInclude.map((tab, index) => ({
      id: tab.id,
      imagePath: tab.imageData.path,
      order: index,
      groupId: groupToInclude ? 'group-0' : null,
      zoomLevel: tab.zoomLevel,
      fitMode: tab.fitMode,
      panOffset: tab.panOffset
    }))

    return {
      name: null,
      tabs: sessionTabs,
      groups: groupToInclude ? [{
        id: 'group-0',
        name: groupToInclude.name,
        color: groupToInclude.color,
        order: 0,
        tabIds: sessionTabs.map(t => t.id),
        collapsed: false
      }] : null,
      activeTabId: tabsToInclude[0]?.id ?? null,
      createdAt: new Date().toISOString(),
      layoutPosition: layoutPosition.value,
      layoutSize: layoutSize.value,
      treeCollapsed: treeCollapsed.value
    }
  }

  // Open tab in new window
  const openTabInNewWindow = async (tabId: string) => {
    const { invoke } = await import('@tauri-apps/api/core')
    const tab = tabs.value.get(tabId)
    if (!tab) {
      console.error('Tab not found:', tabId)
      return
    }

    const folderContext = tabFolderContexts.value.get(tabId)
    if (!folderContext) {
      console.error('Folder context not found for tab:', tabId)
      return
    }

    const sessionData = createNewWindowSessionData([tab])

    try {
      await invoke('launch_new_instance', { sessionData })
      console.log('Launched new instance with tab:', tab.title)
    } catch (error) {
      console.error('Failed to launch new instance:', error)
    }
  }

  // Open group in new window
  const openGroupInNewWindow = async (groupId: string) => {
    const { invoke } = await import('@tauri-apps/api/core')
    const group = tabGroups.value.get(groupId)
    if (!group) {
      console.error('Group not found:', groupId)
      return
    }

    // Get all tabs in this group
    const groupTabs = Array.from(tabs.value.values())
      .filter(tab => tab.groupId === groupId)
      .sort((a, b) => a.order - b.order)

    if (groupTabs.length === 0) {
      console.error('No tabs found in group:', groupId)
      return
    }

    const sessionData = createNewWindowSessionData(groupTabs, group)

    try {
      await invoke('launch_new_instance', { sessionData })
      console.log('Launched new instance with group:', group.name)
    } catch (error) {
      console.error('Failed to launch new instance:', error)
    }
  }

  // Duplicate tab detection
  const detectDuplicateTabs = (currentTabId: string | null = null): void => {
    const targetTabId = currentTabId || activeTabId.value
    if (!targetTabId) {
      duplicateTabs.value = []
      return
    }

    const currentTab = tabs.value.get(targetTabId)
    if (!currentTab) {
      duplicateTabs.value = []
      return
    }

    const currentPath = currentTab.imageData.path
    const duplicates: DuplicateTabInfo[] = []

    // Search all tabs for matching image paths
    for (const [tabId, tab] of tabs.value) {
      // Skip the current tab
      if (tabId === targetTabId) continue

      // Check if same image path
      if (tab.imageData.path === currentPath) {
        duplicates.push({
          tabId: tab.id,
          tabTitle: tab.title,
          groupName: tab.groupId ? getGroupName(tab.groupId) : undefined
        })
      }
    }

    duplicateTabs.value = duplicates
    if (duplicates.length > 0) {
      console.log(`Found ${duplicates.length} duplicate tab(s) for image: ${currentTab.imageData.name}`)
    }
  }

  const clearDuplicates = (): void => {
    duplicateTabs.value = []
  }



  return {
    // State
    tabs,
    activeTabId,
    tabFolderContexts,
    tabGroups,
    selectedGroupId,
    contextMenuVisible,
    contextMenuPosition,
    contextMenuTabId,
    selectedTabIds,
    lastClickedTabId,

    // Computed
    sortedTabs,
    activeTab,
    treeViewItems,
    currentLayout,

    // Tab management
    openTab,
    switchToTab,
    closeTab,
    switchToNextTab,
    switchToPreviousTab,
    switchToNextGroup,
    switchToPreviousGroup,
    closeCurrentTab,
    clearTabs,

    // Multi-selection
    handleTabClick,
    selectTabRange,
    clearSelection,
    isTabSelected,

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
    shouldGroupBeCollapsed,

    // Favourites management
    isImageFavourited,
    toggleFavourite,
    toggleFavouriteForTab,

    // Tab Layout,
    layoutPosition,
    layoutSize,
    treeCollapsed,
    toggleLayoutPosition,
    toggleLayoutSize,
    toggleTreeCollapse,

    // Context menu
    showTabContextMenu,
    closeOtherTabs,
    closeTabsToRight,
    closeTabsToLeft,
    contextMenuCreateGroupWithNext,
    contextMenuCanCreateGroupFromSelection,
    contextMenuRenameGroup,
    contextMenuRemoveFromGroup,
    contextMenuDissolveGroup,

    // Window management
    openTabInNewWindow,
    openGroupInNewWindow,

    // Duplicate tab detection
    duplicateTabs,
    detectDuplicateTabs,
    clearDuplicates
  }
}
