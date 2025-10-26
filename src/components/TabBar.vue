<template>
  <div class="tab-bar-wrapper">
    <!-- Tree Panel (Left Sidebar) -->
    <div class="tree-panel" v-if="layoutPosition === 'tree'" :class="{ collapsed: treeCollapsed }">
      <div class="tree-controls">
        <button @click="toggleTreeCollapse" class="tree-collapse-btn" :title="treeCollapsed ? 'Expand tree' : 'Collapse tree'">
          <span v-if="treeCollapsed">→</span>
          <span v-else>←</span>
        </button>
        <button v-if="!treeCollapsed" @click="toggleLayoutPosition" class="layout-toggle-btn" :title="`Layout: ${layoutPosition}`">
          <span v-if="layoutPosition === 'tree'">▯</span>
        </button>
        <button v-if="!treeCollapsed" @click="toggleLayoutSize" class="size-toggle-btn" :title="`Size: ${layoutSize}`">
          <span v-if="layoutSize === 'small'">S</span>
          <span v-else>L</span>
        </button>
        <button v-if="!treeCollapsed" @click="emit('openNewImage')" class="new-tab-btn" title="Open new image">
          +
        </button>
      </div>
      <div class="tree-items" ref="treeItemsContainer">
        <template v-for="item in treeViewItems" :key="item.type === 'group' ? `group-${item.groupId}` : `tab-${item.tab!.id}`">
          <!-- Group Header -->
          <div
            v-if="item.type === 'group'"
            @contextmenu.prevent="showGroupContextMenu($event, item.groupId!)"
            class="tree-group-header"
            :class="{
              active: selectedGroupId === item.groupId,
              'group-blue': getGroupColor(item.groupId!) === 'blue',
              'group-orange': getGroupColor(item.groupId!) === 'orange',
              collapsed: tabGroups.get(item.groupId!)?.collapsed === true
            }">
            <button @click.stop="toggleGroupCollapse(item.groupId!)" class="group-collapse-btn" :title="tabGroups.get(item.groupId!)?.collapsed ? 'Expand group' : 'Collapse group'">
              <span v-if="tabGroups.get(item.groupId!)?.collapsed">▶</span>
              <span v-else>▼</span>
            </button>
            <span v-if="!treeCollapsed" @click="selectGroupHeader(item.groupId!)" class="group-header-title">{{ getGroupName(item.groupId!) }}</span>
          </div>
          <!-- Tab Item -->
          <div
            v-else
            @click="emit('tabSwitched', item.tab!.id)"
            @contextmenu.prevent="showTabContextMenu($event, item.tab!.id)"
            class="tree-item"
            :class="{
              active: item.tab!.id === activeTabId,
              grouped: !!item.tab!.groupId
            }">
            <img v-if="item.tab!.imageData.assetUrl" :src="item.tab!.imageData.assetUrl" :alt="item.tab!.title" class="tree-item-thumbnail" />
            <span v-if="!treeCollapsed" class="tree-item-title">{{ item.tab!.title }}</span>
            <button v-if="!treeCollapsed" @click.stop="emit('tabClosed', item.tab!.id)" class="tree-item-close" :title="`Close ${item.tab!.title}`">
              ×
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Tab Navigation (Top Bar) -->
    <div class="tab-bar" :class="'layout-' + currentLayout" v-if="layoutPosition === 'top' || layoutPosition === 'invisible'">
      <div class="tab-container" ref="tabContainer" v-show="layoutPosition !== 'invisible'">
        <div
          v-for="tab in sortedTabs"
          :key="tab.id"
          @click="emit('tabSwitched', tab.id)"
          @contextmenu.prevent="showTabContextMenu($event, tab.id)"
          class="tab"
          :class="{
            active: tab.id === activeTabId,
            'group-blue': tab.groupId && getGroupColor(tab.groupId) === 'blue',
            'group-orange': tab.groupId && getGroupColor(tab.groupId) === 'orange'
          }">
          <img v-if="tab.imageData.assetUrl" :src="tab.imageData.assetUrl" :alt="tab.title" class="tab-thumbnail" />
          <span class="tab-title">{{ tab.title }}</span>
          <button @click.stop="emit('tabClosed', tab.id)" class="tab-close" :title="`Close ${tab.title}`">
            ×
          </button>
        </div>
      </div>
      <div class="tab-controls">
        <button @click="toggleLayoutPosition" class="layout-toggle-btn" :title="`Layout: ${layoutPosition}`">
          <span v-if="layoutPosition === 'invisible'">✕</span>
          <span v-else-if="layoutPosition === 'top'">▭</span>
        </button>
        <button v-if="layoutPosition !== 'invisible'" @click="toggleLayoutSize" class="size-toggle-btn" :title="`Size: ${layoutSize}`">
          <span v-if="layoutSize === 'small'">S</span>
          <span v-else>L</span>
        </button>
        <button @click="emit('openNewImage')" class="new-tab-btn" title="Open new image">
          +
        </button>
      </div>
    </div>

    <!-- Tab Context Menu -->
    <div v-if="contextMenuVisible" class="context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }">
      <!-- Group creation/management options -->
      <template v-if="contextMenuTabId && !tabs.get(contextMenuTabId)?.groupId">
        <div class="context-menu-item" @click="handleContextMenuCreateGroupWithNext">
          Group with Next Tab
        </div>
        <div class="context-menu-separator"></div>
      </template>

      <template v-if="contextMenuTabId && tabs.get(contextMenuTabId)?.groupId">
        <div class="context-menu-item" @click="handleContextMenuRenameGroup">
          Rename Group...
        </div>
        <div class="context-menu-item" @click="handleContextMenuRemoveFromGroup">
          Remove from Group
        </div>
        <div class="context-menu-separator"></div>
      </template>

      <div class="context-menu-item" @click="handleOpenTabInNewWindow">
        Open Tab in New Window
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="emit('tabClosed', contextMenuTabId!)">
        Close Tab
      </div>
      <div class="context-menu-item" @click="handleCloseOtherTabs">
        Close Other Tabs
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="handleCloseTabsToLeft">
        Close Tabs to Left
      </div>
      <div class="context-menu-item" @click="handleCloseTabsToRight">
        Close Tabs to Right
      </div>
    </div>

    <!-- Group Context Menu -->
    <div v-if="groupContextMenuVisible" class="context-menu"
      :style="{ left: groupContextMenuPosition.x + 'px', top: groupContextMenuPosition.y + 'px' }">
      <div class="context-menu-item" @click="handleOpenGroupInNewWindow">
        Open Group in New Window
      </div>
      <div class="context-menu-separator"></div>
      <div class="context-menu-item" @click="handleGroupContextMenuRenameGroup">
        Rename Group...
      </div>
      <div class="context-menu-item" @click="handleGroupContextMenuDissolveGroup">
        Dissolve Group
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTabControls } from '../composables/useTabControls'

// Emits
const emit = defineEmits<{
  tabSwitched: [tabId: string]
  tabClosed: [tabId: string]
  openNewImage: []
  layoutPositionChanged: []
  layoutSizeChanged: []
  treeCollapseToggled: []
}>()

// Use tab controls composable
const {
  tabs,
  tabGroups,
  activeTabId,
  sortedTabs,
  treeViewItems,
  selectedGroupId,
  contextMenuVisible,
  contextMenuPosition,
  contextMenuTabId,
  getGroupColor,
  getGroupName,
  selectGroupHeader,
  toggleGroupCollapse,
  showTabContextMenu,
  closeOtherTabs,
  closeTabsToRight,
  closeTabsToLeft,
  contextMenuCreateGroupWithNext,
  contextMenuRenameGroup: contextMenuRenameGroupBase,
  contextMenuRemoveFromGroup: contextMenuRemoveFromGroupBase,
  renameGroup,
  removeTabFromGroup,
  dissolveGroup,
  openTabInNewWindow,
  openGroupInNewWindow,

  layoutPosition,
  layoutSize,
  treeCollapsed,
  toggleLayoutPosition,
  toggleLayoutSize,
  toggleTreeCollapse,
} = useTabControls()

// Group context menu state
const groupContextMenuVisible = ref(false)
const groupContextMenuPosition = ref({ x: 0, y: 0 })
const groupContextMenuGroupId = ref<string | null>(null)

// Template refs
const treeItemsContainer = ref<HTMLElement>()
const tabContainer = ref<HTMLElement>()

// Computed
const currentLayout = computed(() => {
  if (layoutPosition.value === 'invisible') return 'invisible'
  return `${layoutPosition.value}-${layoutSize.value}` as 'top-small' | 'top-large' | 'tree-small' | 'tree-large'
})

// Context menu handlers
const handleCloseOtherTabs = () => {
  const tabsToClose = closeOtherTabs()
  if (tabsToClose) {
    tabsToClose.forEach(tabId => emit('tabClosed', tabId))
  }
  contextMenuVisible.value = false
}

const handleCloseTabsToRight = () => {
  const tabsToClose = closeTabsToRight()
  if (tabsToClose) {
    tabsToClose.forEach(tabId => emit('tabClosed', tabId))
  }
  contextMenuVisible.value = false
}

const handleCloseTabsToLeft = () => {
  const tabsToClose = closeTabsToLeft()
  if (tabsToClose) {
    tabsToClose.forEach(tabId => emit('tabClosed', tabId))
  }
  contextMenuVisible.value = false
}

const handleContextMenuCreateGroupWithNext = () => {
  contextMenuCreateGroupWithNext()
  contextMenuVisible.value = false
}

const handleContextMenuRenameGroup = () => {
  const groupInfo = contextMenuRenameGroupBase()
  if (!groupInfo) return

  const newName = window.prompt(`Rename group "${groupInfo.currentName}":`, groupInfo.currentName)
  if (newName && newName.trim() !== '') {
    renameGroup(groupInfo.groupId, newName.trim())
  }

  contextMenuVisible.value = false
}

const handleContextMenuRemoveFromGroup = () => {
  const tabIdToRemove = contextMenuRemoveFromGroupBase()
  if (!tabIdToRemove) return

  removeTabFromGroup(tabIdToRemove)
  contextMenuVisible.value = false
}

// Group context menu handlers
const showGroupContextMenu = (event: MouseEvent, groupId: string) => {
  event.preventDefault()
  groupContextMenuGroupId.value = groupId
  groupContextMenuPosition.value = {
    x: event.clientX,
    y: event.clientY
  }
  groupContextMenuVisible.value = true

  // Close tab context menu if open
  contextMenuVisible.value = false

  // Close menu when clicking outside
  const closeMenu = () => {
    groupContextMenuVisible.value = false
    document.removeEventListener('click', closeMenu)
  }
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

const handleOpenTabInNewWindow = () => {
  if (contextMenuTabId.value) {
    openTabInNewWindow(contextMenuTabId.value)
  }
  contextMenuVisible.value = false
}

const handleOpenGroupInNewWindow = () => {
  if (groupContextMenuGroupId.value) {
    openGroupInNewWindow(groupContextMenuGroupId.value)
  }
  groupContextMenuVisible.value = false
}

const handleGroupContextMenuRenameGroup = () => {
  if (!groupContextMenuGroupId.value) return

  const groupName = getGroupName(groupContextMenuGroupId.value)

  const newName = window.prompt(`Rename group "${groupName}":`, groupName)
  if (newName && newName.trim() !== '') {
    renameGroup(groupContextMenuGroupId.value, newName.trim())
  }

  groupContextMenuVisible.value = false
}

const handleGroupContextMenuDissolveGroup = () => {
  if (!groupContextMenuGroupId.value) return

  const groupName = getGroupName(groupContextMenuGroupId.value)
  const groupTabs = Array.from(tabs.value.values()).filter(t => t.groupId === groupContextMenuGroupId.value)

  const confirmDissolve = window.confirm(`Dissolve group "${groupName}"? All ${groupTabs.length} tabs will be ungrouped.`)
  if (confirmDissolve) {
    dissolveGroup(groupContextMenuGroupId.value)
    console.log(`✅ Dissolved group "${groupName}"`)
  }

  groupContextMenuVisible.value = false
}

// Expose template refs for parent component to scroll
defineExpose({
  treeItemsContainer,
  tabContainer
})
</script>

<style scoped>
.tab-bar-wrapper {
  display: contents;
}

/* Tree Panel (Left Sidebar) */
.tree-panel {
  display: flex;
  flex-direction: column;
  min-width: 200px;
  max-width: 300px;
  width: fit-content;
  background: #2d2d2d;
  border-right: 1px solid #404040;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

/* Tree Panel - Collapsed State */
.tree-panel.collapsed {
  min-width: 60px;
  max-width: 60px;
  width: 60px;
}

.tree-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #404040;
  background: #2d2d2d;
}

.tree-collapse-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tree-collapse-btn:hover {
  background: #3d3d3d;
  color: white;
}

.tree-items {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 50rem;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #363636;
  user-select: none;
  white-space: nowrap;
}

/* Tree Item - Collapsed State (center thumbnails) */
.tree-panel.collapsed .tree-item {
  justify-content: center;
  padding: 8px;
}

.tree-item:hover {
  background: #3d3d3d;
}

.tree-item.active {
  background: #1a1a1a;
  border-left: 3px solid #007bff;
  padding-left: 9px; /* Compensate for border */
}

/* Adjust padding for collapsed active items */
.tree-panel.collapsed .tree-item.active {
  padding-left: 5px; /* Less compensation needed when centered */
}

.tree-item-thumbnail {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  display: block;
}

.tree-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: white;
}

.tree-item-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 3px;
  transition: all 0.2s;
  opacity: 0;
}

.tree-item:hover .tree-item-close {
  opacity: 1;
}

.tree-item-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ff6b6b;
}

/* Group Header in Tree View */
.tree-group-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  background: #2a2a2a;
  border-bottom: 1px solid #444;
  border-left: 3px solid transparent;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
  transition: all 0.2s;
}

.tree-group-header:hover {
  background: #353535;
}

.tree-group-header.active {
  background: #1a1a1a;
  border-left-color: #888;
}

.tree-group-header.group-blue {
  border-left-color: #007bff;
}

.tree-group-header.group-blue.active {
  border-left-color: #0056b3;
  background: #1a2530;
}

.tree-group-header.group-orange {
  border-left-color: #ff8c00;
}

.tree-group-header.group-orange.active {
  border-left-color: #cc7000;
  background: #2d2215;
}

.group-collapse-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0;
  margin-right: 8px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  transition: color 0.2s;
}

.group-collapse-btn:hover {
  color: #fff;
}

.tree-group-header.collapsed .group-collapse-btn {
  color: #666;
}

.group-header-title {
  flex: 1;
  color: #ccc;
  cursor: pointer;
}

.tree-panel.collapsed .group-header-title {
  display: none;
}

/* Tab group styling - Tree layout (indented) */
.tree-item.grouped {
  margin-left: 20px;
  border-left: 2px solid #666;
  padding-left: 10px;
}

.tree-panel.collapsed .tree-item.grouped {
  margin-left: 0;
}

.tree-item.grouped.active {
  border-left-color: #007bff;
  border-left-width: 3px;
  padding-left: 9px;
}

.tab-bar {
  display: flex;
  background: #2d2d2d;
  border-bottom: 1px solid #404040;
  flex-shrink: 0;
}

/* Invisible layout - floating controls only */
.tab-bar.layout-invisible {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  background: transparent;
  border-bottom: none;
  width: auto;
}

.tab-container {
  display: flex;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tab-container::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #2d2d2d;
  border-right: 1px solid #404040;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  max-width: 200px;
  white-space: nowrap;
  user-select: none;
}

.tab:hover {
  background: #3d3d3d;
}

.tab.active {
  background: #1a1a1a;
  border-bottom: 2px solid #007bff;
}

.tab-thumbnail {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  display: block;
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.tab-close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s;
}

.tab-close:hover {
  background: #ff4444;
  color: white;
}

/* Tab group styling - Top layout (border colors) */
.tab.group-blue {
  border-top: 3px solid #007bff;
}

.tab.group-orange {
  border-top: 3px solid #ff8c00;
}

.tab-controls {
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-left: 1px solid #404040;
}

.new-tab-btn,
.layout-toggle-btn,
.size-toggle-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 20px;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.new-tab-btn:hover,
.layout-toggle-btn:hover,
.size-toggle-btn:hover {
  background: #3d3d3d;
  color: white;
}

.size-toggle-btn {
  font-size: 14px;
  font-weight: 600;
}

/* Style for invisible mode controls */
.tab-bar.layout-invisible .tab-controls {
  background: rgba(45, 45, 45, 0.9);
  border-radius: 6px;
  border: 1px solid #404040;
  backdrop-filter: blur(10px);
}

/* Top-Large layout - large previews (200x200px) */
.tab-bar.layout-top-large {
  min-height: 230px;
}

.tab-bar.layout-top-large .tab {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 220px;
  max-width: 240px;
  padding: 12px 8px;
  gap: 8px;
}

.tab-bar.layout-top-large .tab-thumbnail {
  width: 200px;
  height: 200px;
  margin: 0;
}

.tab-bar.layout-top-large .tab-title {
  text-align: center;
  font-size: 12px;
}

.context-menu {
  position: fixed;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  min-width: 180px;
  padding: 4px 0;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #fff;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background: #404040;
}

.context-menu-separator {
  height: 1px;
  background: #404040;
  margin: 4px 0;
}

/* Tree Panel (Left Sidebar) */
.tree-panel {
  display: flex;
  flex-direction: column;
  min-width: 200px;
  max-width: 300px;
  width: fit-content;
  background: #2d2d2d;
  border-right: 1px solid #404040;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

/* Tree Panel - Collapsed State */
.tree-panel.collapsed {
  min-width: 60px;
  max-width: 60px;
  width: 60px;
}

.tree-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid #404040;
  background: #2d2d2d;
}

.tree-collapse-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tree-collapse-btn:hover {
  background: #3d3d3d;
  color: white;
}

.tree-items {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #363636;
  user-select: none;
  white-space: nowrap;
}

/* Tree Item - Collapsed State (center thumbnails) */
.tree-panel.collapsed .tree-item {
  justify-content: center;
  padding: 8px;
}

.tree-item:hover {
  background: #3d3d3d;
}

.tree-item.active {
  background: #1a1a1a;
  border-left: 3px solid #007bff;
  padding-left: 9px; /* Compensate for border */
}

/* Adjust padding for collapsed active items */
.tree-panel.collapsed .tree-item.active {
  padding-left: 5px; /* Less compensation needed when centered */
}

.tree-item-thumbnail {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  display: block;
}

.tree-item-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: white;
}

.tree-item-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 3px;
  transition: all 0.2s;
  opacity: 0;
}

.tree-item:hover .tree-item-close {
  opacity: 1;
}

.tree-item-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ff6b6b;
}

/* Group Header in Tree View */
.tree-group-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  background: #2a2a2a;
  border-bottom: 1px solid #444;
  border-left: 3px solid transparent;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  user-select: none;
  transition: all 0.2s;
}

.tree-group-header:hover {
  background: #353535;
}

.tree-group-header.active {
  background: #1a1a1a;
  border-left-color: #888;
}

.tree-group-header.group-blue {
  border-left-color: #007bff;
}

.tree-group-header.group-blue.active {
  border-left-color: #0056b3;
  background: #1a2530;
}

.tree-group-header.group-orange {
  border-left-color: #ff8c00;
}

.tree-group-header.group-orange.active {
  border-left-color: #cc7000;
  background: #2d2215;
}

.group-collapse-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 0;
  margin-right: 8px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  transition: color 0.2s;
}

.group-collapse-btn:hover {
  color: #fff;
}

.tree-group-header.collapsed .group-collapse-btn {
  color: #666;
}

.group-header-title {
  flex: 1;
  color: #ccc;
  cursor: pointer;
}

.tree-panel.collapsed .group-header-title {
  display: none;
}

/* Tab group styling - Tree layout (indented) */
.tree-item.grouped {
  margin-left: 20px;
  border-left: 2px solid #666;
  padding-left: 10px;
}

.tree-item.grouped.active {
  border-left-color: #007bff;
  border-left-width: 3px;
  padding-left: 9px;
}


/* Tree-Large specific styles (only when NOT collapsed) */
.image-viewer.layout-tree-large .tree-panel:not(.collapsed) .tree-item {
  padding: 12px;
  gap: 12px;
}

.image-viewer.layout-tree-large .tree-panel:not(.collapsed) .tree-item-thumbnail {
  width: 200px;
  height: 200px;
}

.image-viewer.layout-tree-large .tree-panel:not(.collapsed) {
  min-width: 250px;
  max-width: 350px;
}

.tab-bar {
  display: flex;
  background: #2d2d2d;
  border-bottom: 1px solid #404040;
  flex-shrink: 0;
}

/* Invisible layout - floating controls only */
.tab-bar.layout-invisible {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 10;
  background: transparent;
  border-bottom: none;
  width: auto;
}

.tab-container {
  display: flex;
  flex: 1;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tab-container::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #2d2d2d;
  border-right: 1px solid #404040;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  max-width: 200px;
  white-space: nowrap;
  user-select: none;
}

.tab:hover {
  background: #3d3d3d;
}

.tab.active {
  background: #1a1a1a;
  border-bottom: 2px solid #007bff;
}

.tab-thumbnail {
  width: 20px;
  height: 20px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  display: block;
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.tab-close {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.2s;
}

.tab-close:hover {
  background: #ff4444;
  color: white;
}

/* Tab group styling - Top layout (border colors) */
.tab.group-blue {
  border-top: 3px solid #007bff;
}

.tab.group-orange {
  border-top: 3px solid #ff8c00;
}

.tab-controls {
  display: flex;
  align-items: center;
  padding: 0 8px;
  border-left: 1px solid #404040;
}

.new-tab-btn,
.layout-toggle-btn,
.size-toggle-btn {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 20px;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.new-tab-btn:hover,
.layout-toggle-btn:hover,
.size-toggle-btn:hover {
  background: #3d3d3d;
  color: white;
}

.size-toggle-btn {
  font-size: 14px;
  font-weight: 600;
}

/* Style for invisible mode controls */
.tab-bar.layout-invisible .tab-controls {
  background: rgba(45, 45, 45, 0.9);
  border-radius: 6px;
  border: 1px solid #404040;
  backdrop-filter: blur(10px);
}

/* Top-Large layout - large previews (200x200px) */
.tab-bar.layout-top-large {
  min-height: 230px;
}

.tab-bar.layout-top-large .tab {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 220px;
  max-width: 240px;
  padding: 12px 8px;
  gap: 8px;
}

.tab-bar.layout-top-large .tab-thumbnail {
  width: 200px;
  height: 200px;
  margin: 0;
}

.tab-bar.layout-top-large .tab-title {
  text-align: center;
  font-size: 12px;
}

.empty-content h3 {
  margin: 0 0 8px 0;
  color: white;
  font-size: 24px;
}

.empty-content p {
  margin: 0 0 24px 0;
  font-size: 16px;
}


/* Context Menu */
.context-menu {
  position: fixed;
  background: #2d2d2d;
  border: 1px solid #404040;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  min-width: 180px;
  padding: 4px 0;
}

.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 14px;
  color: #fff;
  transition: background-color 0.2s;
}

.context-menu-item:hover {
  background: #404040;
}

.context-menu-separator {
  height: 1px;
  background: #404040;
  margin: 4px 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .tab {
    min-width: 100px;
    max-width: 150px;
  }
}
</style>
