/**
 * Lazy loading utilities for images and tabs
 */

import { memoryManager } from './memoryManager'

export interface LazyLoadOptions {
  rootMargin?: string
  threshold?: number
  preloadDistance?: number
}

export class LazyImageLoader {
  private observer: IntersectionObserver | null = null
  private loadingImages: Set<string> = new Set()
  private loadedImages: Set<string> = new Set()

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
   * Preload images that are likely to be viewed soon
   */
  preloadImages(urls: string[], priority: 'high' | 'low' = 'low'): void {
    const loadPromises = urls.map(url => {
      if (this.loadedImages.has(url) || this.loadingImages.has(url)) {
        return Promise.resolve()
      }

      return new Promise<void>((resolve, reject) => {
        const img = new Image()
        
        img.onload = () => {
          memoryManager.cacheImage(url, img)
          this.loadedImages.add(url)
          resolve()
        }
        
        img.onerror = () => {
          console.warn(`Failed to preload image: ${url}`)
          reject(new Error(`Failed to preload: ${url}`))
        }
        
        // Use requestIdleCallback for low priority preloading
        if (priority === 'low' && 'requestIdleCallback' in window) {
          requestIdleCallback(() => {
            img.src = url
          })
        } else {
          img.src = url
        }
      })
    })

    Promise.allSettled(loadPromises).then(results => {
      const successful = results.filter(r => r.status === 'fulfilled').length
      console.log(`📸 Preloaded ${successful}/${urls.length} images`)
    })
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