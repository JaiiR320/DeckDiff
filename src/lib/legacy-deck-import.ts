import { slugifyName } from './deck'
import type { ValidatedDeckCard } from './decklist'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isValidatedDeckCard(value: unknown): value is ValidatedDeckCard {
  return (
    isRecord(value) &&
    typeof value.oracleId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.quantity === 'number' &&
    typeof value.typeLine === 'string' &&
    typeof value.category === 'string' &&
    typeof value.setCode === 'string' &&
    typeof value.collectorNumber === 'string'
  )
}

export type LegacyDeckImportSave = {
  label: string
  savedAt: Date
  cards: ValidatedDeckCard[]
}

export type LegacyDeckImport = {
  name: string
  slug: string
  createdAt: Date
  updatedAt: Date
  saves: LegacyDeckImportSave[]
}

export function parseImportDate(value: string | undefined, fallback: Date) {
  if (!value) {
    return fallback
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export function resolveLegacyImportIdentity(name: string, existingSlugs: Set<string>) {
  const trimmedName = name.trim() || 'Deck'
  const baseSlug = slugifyName(trimmedName) || 'deck'
  let nextName = trimmedName
  let nextSlug = baseSlug
  let suffix = 2

  while (existingSlugs.has(nextSlug)) {
    nextName = `${trimmedName} (${suffix})`
    nextSlug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  existingSlugs.add(nextSlug)

  return {
    name: nextName,
    slug: nextSlug,
  }
}

export function normalizeLegacyDecks(legacyDecks: unknown[], existingSlugs: Set<string>) {
  const normalizedDecks: LegacyDeckImport[] = []

  for (const legacyDeck of legacyDecks) {
    if (!isRecord(legacyDeck) || typeof legacyDeck.name !== 'string' || !legacyDeck.name.trim()) {
      continue
    }

    const fallbackCreatedAt = new Date()
    const createdAt = parseImportDate(
      typeof legacyDeck.createdAt === 'string' ? legacyDeck.createdAt : undefined,
      fallbackCreatedAt,
    )
    const updatedAt = parseImportDate(typeof legacyDeck.updatedAt === 'string' ? legacyDeck.updatedAt : undefined, createdAt)
    const identity = resolveLegacyImportIdentity(legacyDeck.name, existingSlugs)
    const rawSaves = Array.isArray(legacyDeck.saves) ? legacyDeck.saves : []
    const saves: LegacyDeckImportSave[] = []

    for (const save of rawSaves) {
      if (!isRecord(save) || !Array.isArray(save.cards)) {
        continue
      }

      const cards = save.cards.filter(isValidatedDeckCard)

      if (cards.length !== save.cards.length) {
        continue
      }

      saves.push({
        label: typeof save.label === 'string' && save.label.trim() ? save.label.trim() : 'Imported save',
        savedAt: parseImportDate(typeof save.savedAt === 'string' ? save.savedAt : undefined, updatedAt),
        cards,
      })
    }

    normalizedDecks.push({
      name: identity.name,
      slug: identity.slug,
      createdAt,
      updatedAt,
      saves,
    })
  }

  return normalizedDecks
}
