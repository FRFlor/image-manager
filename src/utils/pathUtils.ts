/**
 * Utility functions for cross-platform path handling
 */

/**
 * Finds the last directory separator in a file path, supporting both Unix (/) and Windows (\) separators
 * @param path - The file path to analyze
 * @returns The index of the last directory separator, or -1 if not found
 */
export function getLastSeparatorIndex(path: string): number {
  return Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
}

/**
 * Extracts the directory path from a file path
 * @param filePath - The full file path
 * @returns The directory portion of the path
 */
export function getDirectoryPath(filePath: string): string {
  const lastSeparatorIndex = getLastSeparatorIndex(filePath)
  return filePath.substring(0, lastSeparatorIndex)
}
