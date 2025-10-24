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
 * Represents folder context with lazy loading support
 */
export interface FolderContext {
  fileEntries: FileEntry[] // Lightweight list of all files in folder
  loadedImages: Map<string, ImageData> // Cache of loaded image metadata (keyed by path)
  folderPath: string
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

