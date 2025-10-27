/**
 * Lazy loading utilities for images and tabs
 */

import { memoryManager } from './memoryManager'

export interface LazyLoadOptions {
  rootMargin?: string
  threshold?: number
  preloadDistance?: number
}

interface LoadRequest {
  url: string
  priority: 'high' | 'low'
  resolve: () => void
  reject: (error: Error) => void
  abortController: AbortController
}

export class LazyImageLoader {
  private observer: IntersectionObserver | null = null
  private loadingImages: Set<string> = new Set()
  private loadedImages: Set<string> = new Set()
  private requestQueue: LoadRequest[] = []
  private activeRequests = 0
  private readonly maxConcurrentRequests = 100 // Browser connection pool limit
  private readonly loadTimeout = 5000 // 5 second timeout for slow/corrupted images

  constructor(options: LazyLoadOptions = {}) {
    this.initializeObserver(options)
  }

  private initializeObserver(options: LazyLoadOptions): void {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported, falling back to immediate loading')
      return
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            this.loadImage(img)
            this.observer?.unobserve(img)
          }
        })
      },
      {
        rootMargin: options.rootMargin || '50px',
        threshold: options.threshold || 0.1
      }
    )
  }

  /**
   * Register an image for lazy loading
   */
  observe(img: HTMLImageElement, src: string): void {
    if (!this.observer) {
      // Fallback: load immediately if IntersectionObserver not supported
      this.loadImageDirectly(img, src)
      return
    }

    // Store the actual src in a data attribute
    img.dataset.src = src
    img.dataset.loading = 'lazy'
    
    // Set a placeholder or loading indicator
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+'
    
    this.observer.observe(img)
  }

  /**
   * Load an image that's in the viewport
   */
  private loadImage(img: HTMLImageElement): void {
    const src = img.dataset.src
    if (!src || this.loadingImages.has(src)) return

    this.loadImageDirectly(img, src)
  }

  /**
   * Load an image directly
   */
  private loadImageDirectly(img: HTMLImageElement, src: string): void {
    if (this.loadedImages.has(src)) {
      img.src = src
      return
    }

    this.loadingImages.add(src)

    // Check if image is already cached
    const cachedImage = memoryManager.getCachedImage(src)
    if (cachedImage && cachedImage.complete) {
      img.src = src
      this.loadingImages.delete(src)
      this.loadedImages.add(src)
      return
    }

    // Create a new image for preloading
    const preloadImg = new Image()
    
    preloadImg.onload = () => {
      img.src = src
      img.dataset.loading = 'loaded'
      
      // Cache the loaded image
      memoryManager.cacheImage(src, preloadImg)
      
      this.loadingImages.delete(src)
      this.loadedImages.add(src)
    }

    preloadImg.onerror = () => {
      img.dataset.loading = 'error'
      img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2NjYyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkVycm9yPC90ZXh0Pjwvc3ZnPg=='
      
      this.loadingImages.delete(src)
      console.error(`Failed to load image: ${src}`)
    }

    preloadImg.src = src
  }

  /**
   * Process the next request in the queue
   */
  private processQueue(): void {
    // Don't start new requests if we're at capacity
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return
    }

    // Sort queue by priority (high priority first)
    this.requestQueue.sort((a, b) => {
      if (a.priority === 'high' && b.priority === 'low') return -1
      if (a.priority === 'low' && b.priority === 'high') return 1
      return 0
    })

    const request = this.requestQueue.shift()
    if (!request) return

    this.activeRequests++
    this.loadImageWithTimeout(request)
      .finally(() => {
        this.activeRequests--
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

  /**
   * Destroy the lazy loader
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    this.cancelPendingRequests()
    this.clearCache()
  }
}

/**
 * Virtual scrolling for tab management
 */
export class VirtualTabScroller {
  private container: HTMLElement
  private itemHeight: number
  private visibleCount: number
  private scrollTop = 0
  private totalItems = 0

  constructor(container: HTMLElement, itemHeight: number = 40) {
    this.container = container
    this.itemHeight = itemHeight
    this.visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2 // Buffer
    
    this.setupScrollListener()
  }

  private setupScrollListener(): void {
    this.container.addEventListener('scroll', () => {
      this.scrollTop = this.container.scrollTop
      this.updateVisibleItems()
    })
  }

  /**
   * Update which items should be visible
   */
  private updateVisibleItems(): void {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight)
    const endIndex = Math.min(startIndex + this.visibleCount, this.totalItems)
    
    // Emit event for parent component to update visible items
    this.container.dispatchEvent(new CustomEvent('visibleRangeChanged', {
      detail: { startIndex, endIndex }
    }))
  }

  /**
   * Set total number of items
   */
  setTotalItems(count: number): void {
    this.totalItems = count
    this.updateVisibleItems()
  }

  /**
   * Get currently visible range
   */
  getVisibleRange(): { start: number; end: number } {
    const startIndex = Math.floor(this.scrollTop / this.itemHeight)
    const endIndex = Math.min(startIndex + this.visibleCount, this.totalItems)
    return { start: startIndex, end: endIndex }
  }

  /**
   * Scroll to a specific item
   */
  scrollToItem(index: number): void {
    const targetScrollTop = index * this.itemHeight
    this.container.scrollTo({
      top: targetScrollTop,
      behavior: 'smooth'
    })
  }

  /**
   * Destroy the virtual scroller
   */
  destroy(): void {
    // Remove event listeners
    this.container.removeEventListener('scroll', this.updateVisibleItems)
  }
}

// Export instances
export const lazyImageLoader = new LazyImageLoader()