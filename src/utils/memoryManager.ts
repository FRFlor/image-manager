/**
 * Memory management utilities for efficient resource cleanup
 */

export interface ResourceCleanup {
  cleanup(): void
}

export class MemoryManager {
  private static instance: MemoryManager
  private resources: Set<ResourceCleanup> = new Set()
  private imageCache: Map<string, HTMLImageElement> = new Map()
  private maxCacheSize = 50 // Maximum number of cached images
  private cleanupInterval: number | null = null

  private constructor() {
    this.startPeriodicCleanup()
    this.setupMemoryWarningHandlers()
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }

  /**
   * Register a resource for cleanup
   */
  registerResource(resource: ResourceCleanup): void {
    this.resources.add(resource)
  }

  /**
   * Unregister a resource
   */
  unregisterResource(resource: ResourceCleanup): void {
    this.resources.delete(resource)
  }

  /**
   * Cache an image element for reuse
   */
  cacheImage(url: string, imageElement: HTMLImageElement): void {
    // Remove oldest entries if cache is full
    if (this.imageCache.size >= this.maxCacheSize) {
      const firstKey = this.imageCache.keys().next().value
      if (firstKey) {
        const oldImage = this.imageCache.get(firstKey)
        if (oldImage) {
          this.cleanupImageElement(oldImage)
        }
        this.imageCache.delete(firstKey)
      }
    }

    this.imageCache.set(url, imageElement)
  }

  /**
   * Get cached image element
   */
  getCachedImage(url: string): HTMLImageElement | undefined {
    return this.imageCache.get(url)
  }

  /**
   * Remove image from cache
   */
  removeCachedImage(url: string): void {
    const image = this.imageCache.get(url)
    if (image) {
      this.cleanupImageElement(image)
      this.imageCache.delete(url)
    }
  }

  /**
   * Clean up an image element
   */
  private cleanupImageElement(image: HTMLImageElement): void {
    // Remove event listeners
    image.onload = null
    image.onerror = null
    image.onabort = null
    
    // Clear src to free memory
    image.src = ''
    image.srcset = ''
  }

  /**
   * Clear all cached images
   */
  clearImageCache(): void {
    for (const [, image] of this.imageCache.entries()) {
      this.cleanupImageElement(image)
    }
    this.imageCache.clear()
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): void {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc()
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): { used: number; total: number; limit: number } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      }
    }
    return null
  }

  /**
   * Check if memory usage is high
   */
  isMemoryUsageHigh(): boolean {
    const memory = this.getMemoryUsage()
    if (!memory) return false
    
    const usageRatio = memory.used / memory.limit
    return usageRatio > 0.8 // 80% threshold
  }

  /**
   * Perform aggressive cleanup when memory is low
   */
  performAggressiveCleanup(): void {
    console.warn('🧹 Performing aggressive memory cleanup due to high memory usage')
    
    // Clear image cache
    this.clearImageCache()
    
    // Cleanup all registered resources
    for (const resource of this.resources) {
      try {
        resource.cleanup()
      } catch (error) {
        console.error('Error during resource cleanup:', error)
      }
    }
    
    // Force garbage collection
    this.forceGarbageCollection()
    
    console.log('✅ Aggressive cleanup completed')
  }

  /**
   * Start periodic cleanup
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = window.setInterval(() => {
      if (this.isMemoryUsageHigh()) {
        this.performAggressiveCleanup()
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Setup memory warning handlers
   */
  private setupMemoryWarningHandlers(): void {
    // Listen for memory pressure events (if supported)
    if ('onmemorywarning' in window) {
      window.addEventListener('memorywarning', () => {
        console.warn('⚠️ Memory warning received, performing cleanup')
        this.performAggressiveCleanup()
      })
    }

    // Listen for page visibility changes to cleanup when hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Perform light cleanup when page is hidden
        this.clearImageCache()
      }
    })
  }

  /**
   * Cleanup and destroy the memory manager
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    this.clearImageCache()
    this.resources.clear()
  }
}

/**
 * Resource wrapper for automatic cleanup
 */
export class ManagedResource implements ResourceCleanup {
  private cleanupFn: () => void
  private isDestroyed = false

  constructor(cleanupFn: () => void) {
    this.cleanupFn = cleanupFn
    MemoryManager.getInstance().registerResource(this)
  }

  cleanup(): void {
    if (!this.isDestroyed) {
      this.cleanupFn()
      this.isDestroyed = true
      MemoryManager.getInstance().unregisterResource(this)
    }
  }

  isCleanedUp(): boolean {
    return this.isDestroyed
  }
}

// Export singleton instance
export const memoryManager = MemoryManager.getInstance()