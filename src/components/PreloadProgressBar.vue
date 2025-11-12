<template>
  <div v-if="progress < 100" class="preload-progress-container">
    <div
      class="preload-progress-bar"
      :style="{ width: `${progress}%` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  progress: number // 0-100
}>()
</script>

<style scoped>
.preload-progress-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: rgba(255, 255, 255, 0.1);
  z-index: 9999;
  overflow: hidden;
}

.preload-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #4a9eff 0%, #7ec8ff 100%);
  transition: width 0.3s ease-out;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.6);
}
</style>
