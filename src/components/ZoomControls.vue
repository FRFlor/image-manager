<template>
  <div class="zoom-controls">
      <div class="zoom-info">
        <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
        <span class="fit-mode">{{ fitModeLabel }}</span>
      </div>
      <div class="zoom-buttons">
        <button @click="zoomOut" class="zoom-btn" :disabled="isZoomLocked"
                title="Zoom out (Ctrl/Cmd -)">
          −
        </button>
        <button @click="resetZoom" class="zoom-btn" title="Reset zoom (Ctrl/Cmd 0)">
          ↻
        </button>
        <button @click="zoomIn" class="zoom-btn" title="Zoom in (Ctrl/Cmd +)">
          +
        </button>
        <button @click="toggleFitMode" class="zoom-btn fit-toggle" title="Toggle fit modes (Ctrl/Cmd /)">
          🖼️
        </button>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useZoomControls } from "../composables/useZoomControls.ts"
import type { FitMode } from "../types"

const {
  zoomLevel,
  fitMode,
  isZoomLocked,
  zoomIn,
  zoomOut,
  resetZoom,
  toggleFitMode,
} = useZoomControls()

const fitModeLabelMap: Record<FitMode, string> = {
  'fit-to-window': 'Fit Window',
  'fit-by-width': 'Fit Width',
  'fit-by-height': 'Fit Height',
  'actual-size': 'Actual Size',
}

const fitModeLabel = computed(() => fitModeLabelMap[fitMode.value])
</script>

<style scoped>
/* Zoom Controls */
.zoom-controls {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(45, 45, 45, 0.9);
  border: 1px solid #404040;
  border-radius: 8px;
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(10px);
  z-index: 1000;
}

.zoom-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 50px;
}

.zoom-level {
  font-size: 14px;
  font-weight: 600;
  color: white;
}

.fit-mode {
  font-size: 10px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.zoom-buttons {
  display: flex;
  gap: 4px;
}

.zoom-btn {
  width: 32px;
  height: 32px;
  background: #404040;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.zoom-btn:hover:not(:disabled) {
  background: #505050;
  transform: scale(1.05);
}

.zoom-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-btn.fit-toggle {
  font-size: 10px;
  font-weight: 600;
}
</style>
