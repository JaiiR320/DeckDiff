import type { CardCategory, InvalidDeckCard, ValidatedDeckCard } from '../../lib/decklist'

export type DeckState = {
  rawText: string
  cards: ValidatedDeckCard[]
  invalidCards: InvalidDeckCard[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | null
}

export type EditorRow = {
  oracleId: string
  name: string
  category: CardCategory
  typeLine: string
  baselineQuantity: number
  currentQuantity: number
  status: 'same' | 'added' | 'removed' | 'changed'
}

export type ExportModalState = {
  includeQuantity: boolean
}
