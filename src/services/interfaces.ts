// Service interfaces for the image viewer application

import type { FileEntry, ImageData, SessionData, FitMode } from '../types'

/**
 * Interface for file system operations
 */
export interface FileSystemService {
  /**
   * Browse folder contents and return file entries
   */
  browseFolder(path?: string): Promise<FileEntry[]>
  
  /**
   * Read image file and return image data with metadata
   */
  readImageFile(path: string): Promise<ImageData>
  
  /**
   * Get list of supported image file types
   */
  getSupportedImageTypes(): Promise<string[]>
  
  /**
   * Open native folder selection dialog
   */
  openFolderDialog(): Promise<string | null>
}

/**
 * Interface for session management operations
 */
export interface SessionService {
  /**
   * Save session data using native file dialog
   * @returns The saved file path or null if cancelled
   */
  saveSessionDialog(sessionData: SessionData): Promise<string | null>
  
  /**
   * Load session data using native file dialog
   * @returns The loaded session data or null if cancelled/failed
   */
  loadSessionDialog(): Promise<SessionData | null>
  
  /**
   * Save session data automatically (for app close/restore)
   */
  saveAutoSession(sessionData: SessionData): Promise<void>
  
  /**
   * Load automatically saved session data
   * @returns The loaded session data or null if none exists
   */
  loadAutoSession(): Promise<SessionData | null>
}

/**
 * Interface for managing open images and tabs
 */
export interface ImageManager {
  /**
   * Open an image and create a new tab
   * @returns The tab ID
   */
  openImage(imageData: ImageData): string
  
  /**
   * Close an image tab
   */
  closeImage(tabId: string): void
  
  /**
   * Switch to a specific image tab
   */
  switchToImage(tabId: string): void
  
  /**
   * Get the currently active image
   */
  getActiveImage(): ImageData | null
  
  /**
   * Get all open images
   */
  getAllOpenImages(): Map<string, ImageData>
}

/**
 * Interface for zoom and view controls
 */
export interface ZoomController {
  /**
   * Zoom in on the current image
   */
  zoomIn(): void
  
  /**
   * Zoom out on the current image
   */
  zoomOut(): void
  
  /**
   * Toggle through available fit modes
   */
  toggleFitMode(): void
  
  /**
   * Set specific zoom level
   */
  setZoomLevel(level: number): void
  
  /**
   * Get current zoom level
   */
  getCurrentZoom(): number
  
  /**
   * Get current fit mode
   */
  getFitMode(): FitMode
}

/**
 * Interface for tab management operations
 */
export interface TabManager {
  /**
   * Reorder tabs by moving from one index to another
   */
  reorderTabs(fromIndex: number, toIndex: number): void
  
  /**
   * Calculate optimal tab width based on container and tab count
   */
  calculateTabWidth(tabCount: number, containerWidth: number): number
  
  /**
   * Get the range of visible tabs for scrolling
   */
  getVisibleTabRange(scrollPosition: number, containerWidth: number): { start: number, end: number }
  
  /**
   * Update tab order for drag-and-drop operations
   */
  updateTabOrder(tabId: string, newOrder: number): void
}
