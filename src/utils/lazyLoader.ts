/**
 * Image preloading utilities for smooth navigation
 */

import { memoryManager } from './memoryManager'

interface LoadRequest {
  url: string
  priority: 'high' | 'low'
  resolve: () => void
  reject: (error: Error) => void
  abortController: AbortController
}

export class LazyImageLoader {
  private loadingImages: Set<string> = new Set()
  private loadedImages: Set<string> = new Set()
  private requestQueue: LoadRequest[] = []
  private activeRequests: Map<LoadRequest, number> = new Map() // Map request to timestamp
  private readonly maxConcurrentRequests = 100 // Browser connection pool limit
  private readonly loadTimeout = 5000 // 5 second timeout for slow/corrupted images

  /**
   * Select active requests to abort based on priority and age
   * Priority 1: Oldest low-priority requests
   * Priority 2: Remaining low-priority requests
   * Priority 3: Oldest high-priority requests
   *
   * Returns up to 10 requests, prioritizing low-priority, but ensures at least 5 if needed
   */
  private selectRequestsToAbort(): LoadRequest[] {
    const activeRequestsArray = Array.from(this.activeRequests.entries())
      .map(([request, timestamp]) => ({ request, timestamp }))

    // Separate by priority and sort by age (oldest first)
    const lowPriority = activeRequestsArray
      .filter(item => item.request.priority === 'low')
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(item => item.request)

    const highPriority = activeRequestsArray
      .filter(item => item.request.priority === 'high')
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(item => item.request)

    const toAbort: LoadRequest[] = []

    // If we have >= 10 low-priority requests, abort exactly 10
    if (lowPriority.length >= 10) {
      return lowPriority.slice(0, 10)
    }

    // Otherwise, abort all low-priority
    toAbort.push(...lowPriority)

    // If we still need more to reach minimum 5, add high-priority (oldest first)
    const needed = Math.max(0, 5 - toAbort.length)
    if (needed > 0) {
      toAbort.push(...highPriority.slice(0, needed))
    }

    return toAbort
  }

  /**
   * Process the next request in the queue
   */
  private processQueue(): void {
    // If no queued requests, nothing to do
    if (this.requestQueue.length === 0) {
      return
    }

    // If at capacity, abort old/low-priority requests to make room
    if (this.activeRequests.size >= this.maxConcurrentRequests) {
      const requestsToAbort = this.selectRequestsToAbort()

      for (const request of requestsToAbort) {
        request.abortController.abort()
        this.activeRequests.delete(request)
        this.loadingImages.delete(request.url)
        request.reject(new Error(`Request aborted to make room for higher priority: ${request.url}`))
      }

      console.log(`🚫 Aborted ${requestsToAbort.length} requests to make room for new high-priority requests`)
    }

    // Sort queue by priority (high priority first)
    this.requestQueue.sort((a, b) => {
      if (a.priority === 'high' && b.priority === 'low') return -1
      if (a.priority === 'low' && b.priority === 'high') return 1
      return 0
    })

    const request = this.requestQueue.shift()
    if (!request) return

    // Track active request with timestamp
    this.activeRequests.set(request, Date.now())

    this.loadImageWithTimeout(request)
      .finally(() => {
        this.activeRequests.delete(request)
        this.processQueue() // Process next request
      })
  }

  /**
   * Load an image with timeout handling
   */
  private async loadImageWithTimeout(request: LoadRequest): Promise<void> {
    const { url, resolve, reject, abortController } = request

    // Check cache first
    const cachedImage = memoryManager.getCachedImage(url)
    if (cachedImage && cachedImage.complete) {
      this.loadedImages.add(url)
      this.loadingImages.delete(url)
      resolve()
      return
    }

    const img = new Image()
    const timeoutId = setTimeout(() => {
      abortController.abort()
      this.loadingImages.delete(url)
      reject(new Error(`Image load timeout: ${url}`))
    }, this.loadTimeout)

    img.onload = () => {
      clearTimeout(timeoutId)
      memoryManager.cacheImage(url, img)
      this.loadedImages.add(url)
      this.loadingImages.delete(url)
      resolve()
    }

    img.onerror = () => {
      clearTimeout(timeoutId)
      this.loadingImages.delete(url)
      reject(new Error(`Failed to load image: ${url}`))
    }

    // Check if aborted before starting load
    if (abortController.signal.aborted) {
      clearTimeout(timeoutId)
      this.loadingImages.delete(url)
      reject(new Error(`Load aborted: ${url}`))
      return
    }

    img.src = url
  }

  /**
   * Preload images that are likely to be viewed soon (with throttling and deduplication)
   */
  preloadImages(urls: string[], priority: 'high' | 'low' = 'low'): Promise<void> {
    const loadPromises: Promise<void>[] = []

    for (const url of urls) {
      // Deduplication: skip if already loaded or loading
      if (this.loadedImages.has(url) || this.loadingImages.has(url)) {
        continue
      }

      this.loadingImages.add(url)

      const promise = new Promise<void>((resolve, reject) => {
        const abortController = new AbortController()

        const request: LoadRequest = {
          url,
          priority,
          resolve,
          reject,
          abortController
        }

        this.requestQueue.push(request)
      })

      loadPromises.push(promise)
    }

    // Start processing the queue
    this.processQueue()

    // Return a promise that resolves when all images are loaded (or failed)
    return Promise.allSettled(loadPromises).then(results => {
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      if (successful > 0 || failed > 0) {
        console.log(`📸 Preloaded ${successful}/${urls.length} images (${failed} failed)`)
      }
    })
  }

  /**
   * Cancel all pending preload requests
   */
  cancelPendingRequests(): void {
    // Abort all queued requests
    for (const request of this.requestQueue) {
      request.abortController.abort()
      request.reject(new Error('Request cancelled'))
    }

    this.requestQueue = []
    console.log('🚫 Cancelled all pending image preload requests')
  }

  /**
   * Clear all loaded images from memory
   */
  clearCache(): void {
    this.loadedImages.clear()
    this.loadingImages.clear()
  }
}

// Export singleton instance
export const lazyImageLoader = new LazyImageLoader()
