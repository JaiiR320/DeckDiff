const STORAGE_KEY = 'deckdiffer:decks'

/**
 * Loads all decks from localStorage.
 * Returns empty array if no decks exist or if parsing fails.
 */
export function loadDecks(): unknown[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return []
    }
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
  } catch {
    // If parsing fails, return empty array
    return []
  }
}

export function clearLegacyDecks(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear legacy decks from localStorage:', error)
  }
}
