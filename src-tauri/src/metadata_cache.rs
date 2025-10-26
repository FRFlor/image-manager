use rusqlite::{Connection, params, OptionalExtension};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use chrono::Utc;

/// Cached metadata for an image file
#[derive(Debug, Clone)]
pub struct CachedMetadata {
    pub width: u32,
    pub height: u32,
    #[allow(dead_code)]
    pub file_size: u64,
}

/// SQLite-backed persistent cache for image metadata
pub struct MetadataCache {
    conn: Arc<Mutex<Connection>>,
    max_entries: usize,
}

impl MetadataCache {
    /// Create or open the metadata cache database
    pub fn new(max_entries: usize) -> Result<Self, String> {
        let db_path = Self::get_cache_db_path()?;

        // Ensure the directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create cache directory: {}", e))?;
        }

        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open cache database: {}", e))?;

        // Initialize the database schema
        conn.execute(
            "CREATE TABLE IF NOT EXISTS image_metadata (
                file_path TEXT PRIMARY KEY,
                last_modified TEXT NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                file_size INTEGER NOT NULL,
                last_accessed TEXT NOT NULL
            )",
            [],
        ).map_err(|e| format!("Failed to create table: {}", e))?;

        // Create index on last_accessed for efficient LRU eviction
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_last_accessed ON image_metadata(last_accessed)",
            [],
        ).map_err(|e| format!("Failed to create index: {}", e))?;

        println!("Metadata cache initialized at: {}", db_path.display());

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
            max_entries,
        })
    }

    /// Get the platform-specific path for the cache database
    fn get_cache_db_path() -> Result<PathBuf, String> {
        let app_data_dir = dirs::data_dir()
            .ok_or("Failed to get application data directory")?
            .join("image-viewer");
        Ok(app_data_dir.join("metadata.db"))
    }

    /// Get cached metadata for a file if it exists and is still valid
    pub fn get(&self, file_path: &str, last_modified: &str) -> Result<Option<CachedMetadata>, String> {
        let conn = self.conn.lock().unwrap();

        let result: Option<(u32, u32, u64, String)> = conn
            .query_row(
                "SELECT width, height, file_size, last_modified FROM image_metadata WHERE file_path = ?1",
                params![file_path],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()
            .map_err(|e| format!("Cache query failed: {}", e))?;

        if let Some((width, height, file_size, cached_modified)) = result {
            // Check if the file has been modified since caching
            if cached_modified == last_modified {
                // Update last_accessed timestamp
                let now = Utc::now().to_rfc3339();
                conn.execute(
                    "UPDATE image_metadata SET last_accessed = ?1 WHERE file_path = ?2",
                    params![now, file_path],
                ).map_err(|e| format!("Failed to update last_accessed: {}", e))?;

                return Ok(Some(CachedMetadata {
                    width,
                    height,
                    file_size,
                }));
            } else {
                // File was modified, remove stale entry
                conn.execute(
                    "DELETE FROM image_metadata WHERE file_path = ?1",
                    params![file_path],
                ).map_err(|e| format!("Failed to delete stale entry: {}", e))?;
            }
        }

        Ok(None)
    }

    /// Store metadata in the cache
    pub fn set(
        &self,
        file_path: &str,
        last_modified: &str,
        width: u32,
        height: u32,
        file_size: u64,
    ) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().to_rfc3339();

        // Insert or replace the entry
        conn.execute(
            "INSERT OR REPLACE INTO image_metadata (file_path, last_modified, width, height, file_size, last_accessed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![file_path, last_modified, width, height, file_size, now],
        ).map_err(|e| format!("Failed to insert cache entry: {}", e))?;

        // Check if we need to evict old entries (LRU)
        self.evict_if_needed(&conn)?;

        Ok(())
    }

    /// Evict least recently used entries if cache exceeds max size
    fn evict_if_needed(&self, conn: &Connection) -> Result<(), String> {
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_metadata", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count entries: {}", e))?;

        if count as usize > self.max_entries {
            let to_delete = count as usize - self.max_entries;

            conn.execute(
                "DELETE FROM image_metadata WHERE file_path IN (
                    SELECT file_path FROM image_metadata ORDER BY last_accessed ASC LIMIT ?1
                )",
                params![to_delete],
            ).map_err(|e| format!("Failed to evict entries: {}", e))?;

            println!("Evicted {} old cache entries (LRU)", to_delete);
        }

        Ok(())
    }

    /// Get cache statistics
    pub fn get_stats(&self) -> Result<CacheStats, String> {
        let conn = self.conn.lock().unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM image_metadata", [], |row| row.get(0))
            .map_err(|e| format!("Failed to count entries: {}", e))?;

        Ok(CacheStats {
            entry_count: count as usize,
            max_entries: self.max_entries,
        })
    }

    /// Clear all entries from the cache
    #[allow(dead_code)]
    pub fn clear(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM image_metadata", [])
            .map_err(|e| format!("Failed to clear cache: {}", e))?;
        println!("Cache cleared");
        Ok(())
    }

    /// Flush the cache to ensure all data is written to disk
    pub fn flush(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();

        // Execute a checkpoint to flush WAL (Write-Ahead Logging) to the main database file
        conn.pragma_update(None, "wal_checkpoint", "TRUNCATE")
            .map_err(|e| format!("Failed to checkpoint WAL: {}", e))?;

        println!("Cache flushed to disk");
        Ok(())
    }
}

/// Cache statistics
#[derive(Debug)]
pub struct CacheStats {
    pub entry_count: usize,
    pub max_entries: usize,
}
