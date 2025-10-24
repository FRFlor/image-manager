import { invoke } from '@tauri-apps/api/core'
import type { SessionData } from '../types'
import type { SessionService } from './interfaces'

/**
 * Implementation of SessionService using Tauri commands
 */
export class TauriSessionService implements SessionService {
  /**
   * Save session data using native file dialog
   */
  async saveSessionDialog(sessionData: SessionData): Promise<string | null> {
    try {
      const result = await invoke<string | null>('save_session_dialog', { sessionData })
      return result
    } catch (error) {
      console.error('Failed to save session via dialog:', error)
      throw new Error(`Failed to save session: ${error}`)
    }
  }

  /**
   * Load session data using native file dialog
   */
  async loadSessionDialog(): Promise<SessionData | null> {
    try {
      const result = await invoke<SessionData | null>('load_session_dialog')
      return result
    } catch (error) {
      console.error('Failed to load session via dialog:', error)
      throw new Error(`Failed to load session: ${error}`)
    }
  }

  /**
   * Save session data automatically (for app close/restore)
   */
  async saveAutoSession(sessionData: SessionData): Promise<void> {
    try {
      console.log('Calling Rust save_auto_session with data:', sessionData)
      await invoke('save_auto_session', { sessionData })
      console.log('Rust save_auto_session completed successfully')
    } catch (error) {
      console.error('Failed to save auto-session:', error)
      throw new Error(`Failed to save auto-session: ${error}`)
    }
  }

  /**
   * Load automatically saved session data
   */
  async loadAutoSession(): Promise<SessionData | null> {
    try {
      console.log('Calling Rust load_auto_session')
      const result = await invoke<SessionData | null>('load_auto_session')
      console.log('Rust load_auto_session returned:', result)
      if (result) {
        console.log('Auto-session loaded successfully')
      } else {
        console.log('No auto-session found')
      }
      return result
    } catch (error) {
      console.error('Failed to load auto-session:', error)
      throw new Error(`Failed to load auto-session: ${error}`)
    }
  }
}

// Export a singleton instance
export const sessionService = new TauriSessionService()