/**
 * Batch metadata loader for efficient bulk image metadata loading
 * Reduces IPC overhead by loading multiple images in a single Tauri call
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import type { ImageData, FileEntry, FolderContext } from '../types'

interface PendingBatch {
  paths: string[]
  callbacks: Map<string, (imageData: ImageData | null) => void>
  timeoutId: number
}

export class BatchMetadataLoader {
  private pendingBatch: PendingBatch | null = null
  private readonly batchSize = 50 // Load up to 50 images at once
  private readonly batchDelay = 10 // ms to wait before sending batch (allows grouping)
  private loadingPaths = new Set<string>() // Track currently loading paths to avoid duplicates

  /**
   * Load image metadata for a single path, batching with other requests
   */
  async loadImageMetadata(filePath: string, folderContext: FolderContext): Promise<ImageData | null> {
    // Check if already loaded in cache
    if (folderContext.loadedImages.has(filePath)) {
      return folderContext.loadedImages.get(filePath)!
    }

    // Check if already loading
    if (this.loadingPaths.has(filePath)) {
      // Wait for existing batch to complete
      return new Promise<ImageData | null>((resolve) => {
        const checkInterval = setInterval(() => {
          if (folderContext.loadedImages.has(filePath)) {
            clearInterval(checkInterval)
            resolve(folderContext.loadedImages.get(filePath)!)
          } else if (!this.loadingPaths.has(filePath)) {
            // Loading failed
            clearInterval(checkInterval)
            resolve(null)
          }
        }, 50)
      })
    }

    // Mark as loading
    this.loadingPaths.add(filePath)

    return new Promise<ImageData | null>((resolve) => {
      // Create or add to pending batch
      if (!this.pendingBatch) {
        this.pendingBatch = {
          paths: [],
          callbacks: new Map(),
          timeoutId: window.setTimeout(() => this.flushBatch(folderContext), this.batchDelay)
        }
      }

      this.pendingBatch.paths.push(filePath)
      this.pendingBatch.callbacks.set(filePath, resolve)

      // If batch is full, flush immediately
      if (this.pendingBatch.paths.length >= this.batchSize) {
        clearTimeout(this.pendingBatch.timeoutId)
        this.flushBatch(folderContext)
      }
    })
  }

  /**
   * Load multiple image metadata entries in a single batch
   */
  async loadImageMetadataBatch(
    filePaths: string[],
    folderContext: FolderContext
  ): Promise<Map<string, ImageData | null>> {
    const results = new Map<string, ImageData | null>()

    // Filter out already loaded images
    const pathsToLoad = filePaths.filter(path => !folderContext.loadedImages.has(path))

    if (pathsToLoad.length === 0) {
      // All already loaded
      for (const path of filePaths) {
        results.set(path, folderContext.loadedImages.get(path) || null)
      }
      return results
    }

    try {
      // Call batch Tauri command
      const batchResults = await invoke<Array<any | null>>('read_image_files_batch', {
        paths: pathsToLoad
      })

      // Process results
      for (let i = 0; i < pathsToLoad.length; i++) {
        const path = pathsToLoad[i]
        if (!path) continue // Skip if path is undefined

        const rawData = batchResults[i]

        if (rawData) {
          const imageData: ImageData = {
            id: rawData.id,
            name: rawData.name,
            path: rawData.path,
            assetUrl: convertFileSrc(rawData.path),
            dimensions: rawData.dimensions,
            fileSize: rawData.file_size,
            lastModified: new Date(rawData.last_modified)
          }

          // Cache it
          folderContext.loadedImages.set(path, imageData)
          results.set(path, imageData)
        } else {
          // Failed to load
          results.set(path, null)
        }

        // Remove from loading set
        this.loadingPaths.delete(path)
      }

      console.log(`📦 Batch loaded ${batchResults.filter(r => r !== null).length}/${pathsToLoad.length} images`)
    } catch (error) {
      console.error('Batch metadata load failed:', error)
      // Mark all as failed
      for (const path of pathsToLoad) {
        results.set(path, null)
        this.loadingPaths.delete(path)
      }
    }

    // Add already loaded images to results
    for (const path of filePaths) {
      if (!results.has(path) && folderContext.loadedImages.has(path)) {
        results.set(path, folderContext.loadedImages.get(path)!)
      }
    }

    return results
  }

  /**
   * Flush pending batch immediately
   */
  private async flushBatch(folderContext: FolderContext): Promise<void> {
    if (!this.pendingBatch || this.pendingBatch.paths.length === 0) {
      this.pendingBatch = null
      return
    }

    const batch = this.pendingBatch
    this.pendingBatch = null

    try {
      // Load all images in batch
      const results = await this.loadImageMetadataBatch(batch.paths, folderContext)

      // Resolve all callbacks
      for (const [path, callback] of batch.callbacks.entries()) {
        callback(results.get(path) || null)
      }
    } catch (error) {
      console.error('Failed to flush batch:', error)
      // Resolve all with null
      for (const callback of batch.callbacks.values()) {
        callback(null)
      }
    }
  }

  /**
   * Cancel any pending batches
   */
  cancelPending(): void {
    if (this.pendingBatch) {
      clearTimeout(this.pendingBatch.timeoutId)
      // Resolve all with null
      for (const callback of this.pendingBatch.callbacks.values()) {
        callback(null)
      }
      this.pendingBatch = null
    }
    this.loadingPaths.clear()
  }

  /**
   * Preload a range of images around a current index
   */
  async preloadRange(
    currentIndex: number,
    range: number,
    fileEntries: FileEntry[],
    folderContext: FolderContext
  ): Promise<void> {
    const startIndex = Math.max(0, currentIndex - range)
    const endIndex = Math.min(fileEntries.length - 1, currentIndex + range)

    const pathsToLoad: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      if (i !== currentIndex) {
        const entry = fileEntries[i]
        if (entry && !folderContext.loadedImages.has(entry.path)) {
          pathsToLoad.push(entry.path)
        }
      }
    }

    if (pathsToLoad.length > 0) {
      await this.loadImageMetadataBatch(pathsToLoad, folderContext)
    }
  }

  /**
   * Preload images in a specific direction (for directional navigation)
   */
  async preloadDirectional(
    currentIndex: number,
    direction: 'forward' | 'backward',
    distance: number,
    fileEntries: FileEntry[],
    folderContext: FolderContext
  ): Promise<void> {
    const pathsToLoad: string[] = []

    if (direction === 'forward') {
      const endIndex = Math.min(fileEntries.length - 1, currentIndex + distance)
      for (let i = currentIndex + 1; i <= endIndex; i++) {
        const entry = fileEntries[i]
        if (entry && !folderContext.loadedImages.has(entry.path)) {
          pathsToLoad.push(entry.path)
        }
      }
    } else {
      const startIndex = Math.max(0, currentIndex - distance)
      for (let i = currentIndex - 1; i >= startIndex; i--) {
        const entry = fileEntries[i]
        if (entry && !folderContext.loadedImages.has(entry.path)) {
          pathsToLoad.push(entry.path)
        }
      }
    }

    if (pathsToLoad.length > 0) {
      await this.loadImageMetadataBatch(pathsToLoad, folderContext)
    }
  }
}

// Export singleton instance
export const batchMetadataLoader = new BatchMetadataLoader()
