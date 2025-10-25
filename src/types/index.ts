// Core data models and interfaces for the image viewer application

/**
 * Represents image file data with metadata
 */
export interface ImageData {
  id: string
  name: string
  path: string // File system path
  assetUrl: string // Tauri asset:// URL for direct file serving
  dimensions: {
    width: number
    height: number
  }
  fileSize: number
  lastModified: Date
}

/**
 * Represents a file or directory entry in the file system
 */
export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  isImage: boolean
  size?: number
  lastModified?: Date
}

/**
 * Paginated folder result from backend
 */
export interface PaginatedFolderResult {
  entries: FileEntry[]
  totalCount: number
  hasMore: boolean
  offset: number
  limit: number
}

/**
 * Represents folder context with lazy loading support
 */
export interface FolderContext {
  fileEntries: FileEntry[] // Lightweight list of all files in folder
  loadedImages: Map<string, ImageData> // Cache of loaded image metadata (keyed by path)
  folderPath: string
}

/**
 * Virtual folder context with pagination support for very large folders
 */
export interface VirtualFolderContext extends FolderContext {
  totalCount: number // Total number of images in folder
  loadedChunks: Set<number> // Track which chunks have been loaded
  chunkSize: number // Size of each pagination chunk
}

/**
 * Represents a tab containing an image
 */
export interface TabData {
  id: string
  title: string
  imageData: ImageData
  isActive: boolean
  order: number // For drag-and-drop reordering
  isFullyLoaded?: boolean // Tracks if folder context and adjacent images are loaded
  zoomLevel?: number // Zoom level for this tab
  fitMode?: 'fit-to-window' | 'actual-size' // Fit mode for this tab
  panOffset?: { x: number; y: number } // Pan offset for this tab
}

/**
 * Represents session data for saving/loading application state
 */
export interface SessionData {
  name?: string // Optional for auto-session
  tabs: Array<{
    id: string
    imagePath: string
    order: number
    zoomLevel?: number
    fitMode?: 'fit-to-window' | 'actual-size'
    panOffset?: { x: number; y: number }
  }>
  activeTabId: string | null
  createdAt: string // Use string for JSON serialization
}

/**
 * Represents the overall application state
 */
export interface ApplicationState {
  openTabs: Map<string, TabData>
  activeTabId: string | null
  supportedFormats: string[]
}

/**
 * Loading state interface for UI feedback
 */
export interface LoadingState {
  isLoading: boolean
  operation: string
  progress?: number
  message?: string
}

// Re-export service interfaces
export type {
  FileSystemService,
  SessionService,
  ImageManager,
  ZoomController,
  TabManager
} from './services'

