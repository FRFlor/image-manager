# Implementation Plan

- [x] 1. Set up Tauri project structure and configuration
  - Initialize Tauri in the existing Vue project
  - Configure Tauri permissions for file system access and dialogs
  - Set up asset protocol for serving images
  - Configure build settings for cross-platform compilation
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 2. Implement core data models and interfaces
  - Create TypeScript interfaces for ImageData, TabData, SessionData, and ApplicationState
  - Implement FileEntry interface for directory browsing
  - Create service interfaces for FileSystemService and SessionService
  - _Requirements: 1.1, 2.1, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Build Rust backend commands for file system operations
  - Implement browse_folder command for directory traversal
  - Create read_image_file command with image metadata extraction
  - Add get_supported_image_types command
  - Implement open_folder_dialog command for native folder selection
  - Add file type validation and error handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4. Create folder navigation component
  - Build FolderNavigator.vue component with directory tree display
  - Implement folder browsing and navigation functionality
  - Add image file filtering and visual indicators
  - Create file selection (single and multiple) with Ctrl/Cmd+click support
  - Integrate with Tauri file system commands
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4_

- [x] 5. Implement basic image viewer with tab management
  - ✅ Created ImageViewer.vue component with full-screen viewing
  - ✅ Implemented basic tab system with creation, switching, and closing
  - ✅ Added keyboard navigation (arrow keys) between folder images
  - ✅ Built responsive tab bar with scrolling support
  - ✅ Integrated with native file picker for clean UX
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.8, 3.9, 3.10, 3.11_

- [x] 6. Enhance tab management functionality
  - ✅ **Add Enter key shortcut to open new image in new tab** (while staying in current viewer)
  - ✅ **Fix Ctrl+O to open new tab instead of returning to file picker**
  - ✅ **Add Ctrl+Tab to switch to tab on the right of current tab**
  - ✅ **Add Ctrl+Shift+Tab to switch to tab on the left of current tab**
  - ✅ Implement proper tab state persistence across navigation (arrow key navigation should not affect other tabs)
  - ✅ Add keyboard shortcuts for tab management (Ctrl+T for new tab, Ctrl+W to close tab)
  - ✅ Improve tab closing behavior and active tab selection
  - ✅ Ensure tab names show only image filename (not full path)
  - ✅ Add tab context menu (right-click options)
  - ✅ Ensure multiple tabs can have different folder contexts
  - ✅ **Add gaming-style navigation (A/D for images, Shift+A/D for tabs)**
  - ✅ **Add Shift+Arrow keys for tab switching**
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 7. Integrate image loading with Tauri asset protocol
  - ✅ Configured Tauri asset protocol for secure image serving
  - ✅ Implemented image loading using asset:// URLs
  - ✅ Added error handling for corrupted or unsupported image files
  - ✅ Created loading states in components
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7.5. Implement centralized keyboard shortcuts configuration system
  - ✅ Created `src/config/keyboardShortcuts.ts` as single source of truth for all shortcuts
  - ✅ Built TypeScript interfaces for keyboard shortcut definitions
  - ✅ Implemented `matchesShortcut` helper function for event matching
  - ✅ Created utility functions for shortcut formatting and categorization
  - ✅ Refactored ImageViewer component to use centralized configuration
  - ✅ Added comprehensive documentation and README
  - ✅ Created steering file to enforce centralized shortcut management
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5 (Architecture improvement)_

- [x] 8. Add keyboard-based tab reordering
  - ✅ **Implemented keyboard shortcuts for tab reordering** (Alt+Arrow keys, Alt+A/D)
  - ✅ **Added moveTabLeft and moveTabRight functions** for swapping tab positions
  - ✅ **Integrated tab reordering actions into centralized keyboard shortcut system**
  - ✅ **Added proper tab order state management** with sortedTabs computed property
  - ✅ **Ensured smooth visual transitions** for tab position changes
  - _Requirements: 3.6, 3.7_

- [x] 9. Add zoom and pan controls to image viewer
  - ✅ Implement zoom in/out functionality with mouse wheel
  - ✅ **Add zoom keyboard shortcuts to centralized configuration** (Ctrl/Cmd +, -, 0)
  - ✅ Add toggle between fit-to-window and actual size modes
  - ✅ Implement pan functionality for zoomed images
  - ✅ Add zoom level indicator and reset functionality
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 11. Build session persistence system
  - Implement Rust commands for auto-session save/load
  - Create automatic session saving on application close
  - Add session restoration on application startup
  - Handle missing image files during session restore
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 12. Create manual session save/load functionality
  - Implement save_session_dialog and load_session_dialog Rust commands using native file dialogs
  - Integrate save/load session into the Window Menu under "File > Save Session" and "File > Close Session". Keep "File > Close Window" functional.
  - Add native file dialogs with .session.json filtering and default extensions
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 10. Integrate all components in main application
  - ✅ Updated App.vue to manage application state and view switching
  - ✅ Implemented seamless flow between file picker and image viewer
  - ✅ Added global keyboard shortcut handling (arrow keys, Ctrl+O, Escape)
  - ✅ Connected all components with proper data flow
  - ✅ **Removed FolderNavigator component and simplified app to single image viewer**
  - _Requirements: All requirements integration_

- [x] 13. Add comprehensive error handling and user feedback
  - Create loading states and progress indicators
  - _Requirements: 2.5, 5.6, 7.4, 8.6_

- [ ] 14. Create comprehensive test suite
  - Write unit tests for Rust backend commands
  - Create component tests for Vue components
  - Add integration tests for file operations and session management
  - Implement end-to-end tests for complete user workflows
  - Test cross-platform compatibility and keyboard shortcuts
  - _Requirements: All requirements validation_

- [x] 15. Optimize performance and finalize application
  - Implement lazy loading for images and tabs
  - Optimize memory usage and cleanup
  - Add performance monitoring and optimization
  - Configure final build settings and packaging
  - _Requirements: 4.1, 4.2, 4.3, 4.4_