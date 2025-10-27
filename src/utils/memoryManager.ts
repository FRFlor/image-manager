/**
 * Memory management utilities for efficient resource cleanup
 */

export interface ResourceCleanup {
  cleanup(): void
}

interface CacheEntry {
  image: HTMLImageElement
  lastAccessed: number
  position?: number // Optional position in folder for directional eviction
}

export class MemoryManager {
  private static instance: MemoryManager
  private resources: Set<ResourceCleanup> = new Set()
  private imageCache: Map<string, CacheEntry> = new Map()
  private maxCacheSize = 200 // Balanced cache size (increased from 100, but not too aggressive)
  private cleanupInterval: number | null = null
  private currentPosition: number = -1 // Track current position for directional eviction
  private navigationDirection: 'forward' | 'backward' | 'unknown' = 'unknown'

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
   * Set current position for directional eviction
   */
  setCurrentPosition(position: number, direction: 'forward' | 'backward' | 'unknown' = 'unknown'): void {
    this.currentPosition = position
    this.navigationDirection = direction
  }

  /**
   * Cache an image element for reuse (directional LRU eviction)
   */
  cacheImage(url: string, imageElement: HTMLImageElement, position?: number): void {
    // If cache is full, evict using directional LRU
    if (this.imageCache.size >= this.maxCacheSize) {
      this.evictDirectionalLRU()
    }

    // Add to cache with current timestamp and optional position
    this.imageCache.set(url, {
      image: imageElement,
      lastAccessed: Date.now(),
      position
    })
  }

  /**
   * Evict using directional LRU - never evict images ahead in navigation direction
   */
  private evictDirectionalLRU(): void {
    // If we don't have position info, fall back to standard LRU
    if (this.currentPosition === -1) {
      this.evictLRU()
      return
    }

    let victimKey: string | null = null
    let victimScore = -Infinity // Higher score = better candidate for eviction

    const protectionDistance = 20 // Never evict images within ±20 of current position

    for (const [key, entry] of this.imageCache.entries()) {
      // Skip if position not set
      if (entry.position === undefined) {
        continue
      }

      const distance = entry.position - this.currentPosition
      const absDistance = Math.abs(distance)

      // NEVER evict images within protection distance
      if (absDistance <= protectionDistance) {
        continue
      }

      // Calculate eviction score based on:
      // 1. Distance from current position (farther = higher score)
      // 2. Navigation direction (behind us = higher score)
      // 3. Last accessed time (older = higher score)

      let score = absDistance // Base score is distance

      // Boost score if image is behind us in navigation direction
      if (this.navigationDirection === 'forward' && distance < 0) {
        score *= 2 // Images behind us are 2x more likely to be evicted
      } else if (this.navigationDirection === 'backward' && distance > 0) {
        score *= 2 // Images ahead of us are 2x more likely to be evicted
      }

      // Factor in age (older = slightly higher score)
      const age = Date.now() - entry.lastAccessed
      score += age / 1000 // Add 1 point per second of age

      if (score > victimScore) {
        victimScore = score
        victimKey = key
      }
    }

    // If we found a victim, evict it
    if (victimKey) {
      const entry = this.imageCache.get(victimKey)
      if (entry) {
        this.cleanupImageElement(entry.image)
      }
      this.imageCache.delete(victimKey)
      console.log(`🗑️ Directional eviction: removed image at position ${entry?.position} (score: ${victimScore.toFixed(1)})`)
    } else {
      // No suitable victim found, fall back to standard LRU
      this.evictLRU()
    }
  }

  /**
   * Evict the least recently used entry from cache (fallback method)
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    // Find the entry with the oldest access time
    for (const [key, entry] of this.imageCache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    // Remove the oldest entry
    if (oldestKey) {
      const entry = this.imageCache.get(oldestKey)
      if (entry) {
        this.cleanupImageElement(entry.image)
      }
      this.imageCache.delete(oldestKey)
    }
  }

  /**
   * Touch an entry to mark it as recently used (for LRU)
   */
  touchCachedImage(url: string): void {
    const entry = this.imageCache.get(url)
    if (entry) {
      entry.lastAccessed = Date.now()
    }
  }

  /**
   * Get cached image element (updates access time)
   */
  getCachedImage(url: string): HTMLImageElement | undefined {
    const entry = this.imageCache.get(url)
    if (entry) {
      // Update access time for LRU
      entry.lastAccessed = Date.now()
      return entry.image
    }
    return undefined
  }

  /**
   * Remove image from cache
   */
  removeCachedImage(url: string): void {
    const entry = this.imageCache.get(url)
    if (entry) {
      this.cleanupImageElement(entry.image)
      this.imageCache.delete(url)
    }
  }

  /**
   * Evict entries older than specified age (in milliseconds)
   */
  evictOldEntries(maxAge: number = 300000): number {
    const now = Date.now()
    let evictedCount = 0

    for (const [key, entry] of this.imageCache.entries()) {
      if (now - entry.lastAccessed > maxAge) {
        this.cleanupImageElement(entry.image)
        this.imageCache.delete(key)
        evictedCount++
      }
    }

    return evictedCount
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
    for (const [, entry] of this.imageCache.entries()) {
      this.cleanupImageElement(entry.image)
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
    return usageRatio > 0.9 // 90% threshold - increased from 80% for more aggressive caching
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
      // Evict entries older than 5 minutes
      const evicted = this.evictOldEntries(300000)
      if (evicted > 0) {
        console.log(`🧹 Evicted ${evicted} old cache entries`)
      }

      // If memory is still high, perform aggressive cleanup
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