#!/usr/bin/env node

/**
 * Clears the image metadata cache
 * This script deletes the SQLite database file that stores cached image metadata
 */

import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Determine the cache database path based on platform
function getCacheDbPath() {
  const platform = process.platform;
  let appDataDir;

  if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/image-viewer
    appDataDir = join(homedir(), 'Library', 'Application Support', 'image-viewer');
  } else if (platform === 'win32') {
    // Windows: %APPDATA%/image-viewer
    appDataDir = join(process.env.APPDATA || '', 'image-viewer');
  } else {
    // Linux: ~/.local/share/image-viewer
    appDataDir = join(homedir(), '.local', 'share', 'image-viewer');
  }

  return join(appDataDir, 'metadata.db');
}

function clearCache() {
  const cacheDbPath = getCacheDbPath();

  console.log(`Looking for cache at: ${cacheDbPath}`);

  if (existsSync(cacheDbPath)) {
    try {
      unlinkSync(cacheDbPath);
      console.log('✅ Cache cleared successfully!');
      console.log('📁 Next time you open the app, the cache will be rebuilt.');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error.message);
      console.error('💡 Make sure the app is not running and try again.');
      process.exit(1);
    }
  } else {
    console.log('ℹ️  No cache file found. Cache is already empty.');
  }
}

clearCache();
