/**
 * Directional preloader for intelligent image preloading based on navigation patterns
 * Detects navigation direction and velocity to optimize preloading strategy
 */

import type { FileEntry, FolderContext } from '../types'
import { batchMetadataLoader } from './batchMetadataLoader'
import { lazyImageLoader } from './lazyLoader'

interface NavigationEvent {
  index: number
  timestamp: number
  direction: 'forward' | 'backward' | 'unknown'
}

export class DirectionalPreloader {
  private navigationHistory: NavigationEvent[] = []
  private readonly historySize = 10 // Keep last 10 navigation events
  private backgroundPreloadWorker: number | null = null
  private lastPreloadIndex: number = -1

  // Preload distances (balanced settings)
  private readonly basePreloadRange = 10 // ±10 images base (reduced from 100)
  private readonly directionBoostRange = 30 // +30 in direction of nav (reduced from 200)
  private readonly rapidModeMultiplier = 2 // 2x boost in rapid mode

  // Thresholds
  private readonly rapidNavigationThreshold = 200 // ms between navigations to trigger rapid mode
  private readonly velocityWindowSize = 3 // Use last 3 navigations to calculate velocity

  /**
   * Track a navigation event
   */
  trackNavigation(currentIndex: number, previousIndex: number): void {
    const direction = currentIndex > previousIndex
      ? 'forward'
      : currentIndex < previousIndex
        ? 'backward'
        : 'unknown'

    const event: NavigationEvent = {
      index: currentIndex,
      timestamp: Date.now(),
      direction
    }

    this.navigationHistory.push(event)

    // Keep only recent history
    if (this.navigationHistory.length > this.historySize) {
      this.navigationHistory.shift()
    }
  }

  /**
   * Determine if we're in rapid navigation mode
   */
  isRapidNavigation(): boolean {
    if (this.navigationHistory.length < 2) return false

    const recent = this.navigationHistory.slice(-this.velocityWindowSize)
    let totalTime = 0
    let navigationCount = 0

    for (let i = 1; i < recent.length; i++) {
      const current = recent[i]
      const previous = recent[i - 1]
      if (!current || !previous) continue

      const timeDiff = current.timestamp - previous.timestamp
      if (timeDiff < this.rapidNavigationThreshold) {
        totalTime += timeDiff
        navigationCount++
      }
    }

    // Rapid mode if average time between navigations < threshold
    return navigationCount > 0 && (totalTime / navigationCount) < this.rapidNavigationThreshold
  }

  /**
   * Get the dominant navigation direction
   */
  getNavigationDirection(): 'forward' | 'backward' | 'unknown' {
    if (this.navigationHistory.length < 2) return 'unknown'

    const recent = this.navigationHistory.slice(-this.velocityWindowSize)
    let forwardCount = 0
    let backwardCount = 0

    for (const event of recent) {
      if (event.direction === 'forward') forwardCount++
      else if (event.direction === 'backward') backwardCount++
    }

    if (forwardCount > backwardCount) return 'forward'
    if (backwardCount > forwardCount) return 'backward'
    return 'unknown'
  }

  /**
   * Calculate optimal preload ranges based on navigation pattern
   */
  getPreloadRanges(_currentIndex: number): { backward: number, forward: number } {
    const direction = this.getNavigationDirection()
    const isRapid = this.isRapidNavigation()
    const multiplier = isRapid ? this.rapidModeMultiplier : 1

    if (direction === 'forward') {
      // More forward, less backward
      return {
        backward: Math.floor(this.basePreloadRange * multiplier * 0.25), // 25% behind
        forward: Math.floor((this.basePreloadRange + this.directionBoostRange) * multiplier) // 300 ahead in rapid mode
      }
    } else if (direction === 'backward') {
      // More backward, less forward
      return {
        backward: Math.floor((this.basePreloadRange + this.directionBoostRange) * multiplier), // 300 behind in rapid mode
        forward: Math.floor(this.basePreloadRange * multiplier * 0.25) // 25% ahead
      }
    } else {
      // Balanced preload
      return {
        backward: Math.floor(this.basePreloadRange * multiplier),
        forward: Math.floor(this.basePreloadRange * multiplier)
      }
    }
  }

  /**
   * Preload images based on current navigation pattern
   */
  async preloadIntelligent(
    currentIndex: number,
    fileEntries: FileEntry[],
    folderContext: FolderContext
  ): Promise<void> {
    // Skip if we just preloaded this position
    if (this.lastPreloadIndex === currentIndex) {
      return
    }
    this.lastPreloadIndex = currentIndex

    const ranges = this.getPreloadRanges(currentIndex)
    const isRapid = this.isRapidNavigation()

    if (isRapid) {
      console.log(`⚡ RAPID NAVIGATION MODE: Preloading -${ranges.backward}/+${ranges.forward} images`)
    }

    // Calculate bounds
    const startIndex = Math.max(0, currentIndex - ranges.backward)
    const endIndex = Math.min(fileEntries.length - 1, currentIndex + ranges.forward)

    // Collect paths to preload (skip already loaded)
    const pathsToPreload: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      if (i !== currentIndex) {
        const entry = fileEntries[i]
        if (entry && !folderContext.loadedImages.has(entry.path)) {
          pathsToPreload.push(entry.path)
        }
      }
    }

    if (pathsToPreload.length === 0) {
      console.log('✅ All images in preload range already loaded')
      return
    }

    console.log(`🔄 Preloading ${pathsToPreload.length} images (rapid: ${isRapid})`)

    // Load metadata in batch (non-blocking)
    batchMetadataLoader.loadImageMetadataBatch(pathsToPreload, folderContext)
      .then(results => {
        // Extract successfully loaded image URLs for browser preload
        const urlsToPreload: string[] = []
        for (const [_path, imageData] of results.entries()) {
          if (imageData && imageData.assetUrl) {
            urlsToPreload.push(imageData.assetUrl)
          }
        }

        // Prioritize images closer to current position
        const priorityUrls: string[] = []
        const lowPriorityUrls: string[] = []

        const direction = this.getNavigationDirection()
        for (const [path, imageData] of results.entries()) {
          if (!imageData) continue

          const entryIndex = fileEntries.findIndex(e => e.path === path)
          const distance = Math.abs(entryIndex - currentIndex)

          // High priority: within ±20 images
          if (distance <= 20) {
            priorityUrls.push(imageData.assetUrl)
          }
          // Medium priority: in navigation direction
          else if (
            (direction === 'forward' && entryIndex > currentIndex) ||
            (direction === 'backward' && entryIndex < currentIndex)
          ) {
            priorityUrls.push(imageData.assetUrl)
          }
          // Low priority: opposite direction
          else {
            lowPriorityUrls.push(imageData.assetUrl)
          }
        }

        // Preload high priority first
        if (priorityUrls.length > 0) {
          lazyImageLoader.preloadImages(priorityUrls, 'high')
        }

        // Then low priority
        if (lowPriorityUrls.length > 0) {
          lazyImageLoader.preloadImages(lowPriorityUrls, 'low')
        }

        console.log(`📸 Browser preload queued: ${priorityUrls.length} high-priority, ${lowPriorityUrls.length} low-priority`)
      })
      .catch(err => {
        console.error('Preload failed:', err)
      })
  }

  /**
   * Start background preloading worker for continuous loading
   */
  startBackgroundPreload(
    currentIndex: number,
    fileEntries: FileEntry[],
    folderContext: FolderContext
  ): void {
    // Stop existing worker
    this.stopBackgroundPreload()

    // Start new worker that preloads in chunks
    let nextChunkStart = currentIndex + this.basePreloadRange + 1
    const chunkSize = 100

    this.backgroundPreloadWorker = window.setInterval(() => {
      // Check if we've preloaded everything
      if (nextChunkStart >= fileEntries.length) {
        this.stopBackgroundPreload()
        return
      }

      const chunkEnd = Math.min(nextChunkStart + chunkSize - 1, fileEntries.length - 1)
      const pathsToLoad: string[] = []

      for (let i = nextChunkStart; i <= chunkEnd; i++) {
        const entry = fileEntries[i]
        if (entry && !folderContext.loadedImages.has(entry.path)) {
          pathsToLoad.push(entry.path)
        }
      }

      if (pathsToLoad.length > 0) {
        batchMetadataLoader.loadImageMetadataBatch(pathsToLoad, folderContext)
          .then(results => {
            const urls = Array.from(results.values())
              .filter(img => img !== null)
              .map(img => img!.assetUrl)

            if (urls.length > 0) {
              lazyImageLoader.preloadImages(urls, 'low')
            }
          })
          .catch(err => console.warn('Background preload chunk failed:', err))
      }

      nextChunkStart = chunkEnd + 1
    }, 2000) // Load a chunk every 2 seconds
  }

  /**
   * Stop background preloading worker
   */
  stopBackgroundPreload(): void {
    if (this.backgroundPreloadWorker !== null) {
      clearInterval(this.backgroundPreloadWorker)
      this.backgroundPreloadWorker = null
    }
  }

  /**
   * Reset navigation history
   */
  reset(): void {
    this.navigationHistory = []
    this.lastPreloadIndex = -1
    this.stopBackgroundPreload()
  }
}

// Export singleton instance
export const directionalPreloader = new DirectionalPreloader()
