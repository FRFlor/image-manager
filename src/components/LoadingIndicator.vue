<template>
  <div v-if="isVisible" class="loading-overlay" :class="{ 'fullscreen': fullscreen }">
    <div class="loading-content">
      <div class="loading-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
        <div class="spinner-ring"></div>
      </div>
      
      <div class="loading-text">
        <div class="loading-message">{{ message || 'Loading...' }}</div>
        <div v-if="operation" class="loading-operation">{{ operation }}</div>
      </div>
      
      <div v-if="showProgress && progress !== undefined" class="loading-progress">
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: `${Math.max(0, Math.min(100, progress))}%` }"
          ></div>
        </div>
        <div class="progress-text">{{ Math.round(progress) }}%</div>
      </div>
      
      <button
        v-if="cancellable && onCancel"
        @click="handleCancel"
        class="cancel-button"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  loading?: boolean
  message?: string
  operation?: string
  progress?: number
  showProgress?: boolean
  fullscreen?: boolean
  cancellable?: boolean
  onCancel?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showProgress: false,
  fullscreen: false,
  cancellable: false
})

const isVisible = computed(() => props.loading)

const handleCancel = () => {
  if (props.onCancel) {
    props.onCancel()
  }
}
</script>

<style scoped>
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.loading-overlay.fullscreen {
  position: fixed;
  z-index: 9998;
}

.loading-content {
  background: #2d2d2d;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border: 1px solid #404040;
  min-width: 200px;
  max-width: 400px;
}

.loading-spinner {
  position: relative;
  width: 60px;
  height: 60px;
  margin: 0 auto 24px;
}

.spinner-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

.spinner-ring:nth-child(1) {
  border-top-color: #007bff;
  animation-delay: 0s;
}

.spinner-ring:nth-child(2) {
  border-right-color: #007bff;
  animation-delay: 0.5s;
  width: 80%;
  height: 80%;
  top: 10%;
  left: 10%;
}

.spinner-ring:nth-child(3) {
  border-bottom-color: #007bff;
  animation-delay: 1s;
  width: 60%;
  height: 60%;
  top: 20%;
  left: 20%;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  margin-bottom: 20px;
}

.loading-message {
  font-size: 18px;
  font-weight: 600;
  color: white;
  margin-bottom: 8px;
}

.loading-operation {
  font-size: 14px;
  color: #ccc;
  font-style: italic;
}

.loading-progress {
  margin-bottom: 20px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #404040;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-text {
  font-size: 12px;
  color: #999;
  font-weight: 500;
}

.cancel-button {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.cancel-button:hover {
  background: #5a6268;
  transform: translateY(-1px);
}

.cancel-button:active {
  transform: translateY(0);
}

/* Responsive design */
@media (max-width: 480px) {
  .loading-content {
    padding: 24px;
    margin: 20px;
    min-width: auto;
  }
  
  .loading-spinner {
    width: 50px;
    height: 50px;
    margin-bottom: 20px;
  }
  
  .loading-message {
    font-size: 16px;
  }
}
</style>