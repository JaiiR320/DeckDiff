import { describe, expect, it } from 'vitest'
import { normalizeLegacyDecks, resolveLegacyImportIdentity } from './legacy-deck-import'

describe('resolveLegacyImportIdentity', () => {
  it('creates suffixed copies instead of reusing an existing slug', () => {
    const existingSlugs = new Set(['my-deck', 'my-deck-2'])

    const identity = resolveLegacyImportIdentity('My Deck', existingSlugs)

    expect(identity).toEqual({
      name: 'My Deck (3)',
      slug: 'my-deck-3',
    })
    expect(existingSlugs.has('my-deck-3')).toBe(true)
  })
})

describe('normalizeLegacyDecks', () => {
  it('preserves valid decks while suffixing colliding imports', () => {
    const legacyDecks = [
      {
        id: 'my-deck',
        name: 'My Deck',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        saves: [
          {
            id: 'save-1',
            label: 'Save #1',
            savedAt: '2024-01-02T00:00:00.000Z',
            cards: [
              {
                oracleId: 'card-1',
                name: 'Sol Ring',
                quantity: 1,
                typeLine: 'Artifact',
                category: 'Artifact',
                setCode: 'CMM',
                collectorNumber: '398',
              },
            ],
          },
        ],
      },
    ]

    const normalized = normalizeLegacyDecks(legacyDecks, new Set(['my-deck']))

    expect(normalized.ok).toBe(true)
    if (!normalized.ok) {
      throw new Error('Expected valid legacy deck normalization')
    }

    expect(normalized.decks).toHaveLength(1)
    expect(normalized.decks[0]?.name).toBe('My Deck (2)')
    expect(normalized.decks[0]?.slug).toBe('my-deck-2')
    expect(normalized.decks[0]?.saves).toHaveLength(1)
    expect(normalized.decks[0]?.saves[0]?.label).toBe('Save #1')
  })

  it('aborts the entire import when malformed decks or saves are found', () => {
    const malformedLegacyDecks = [
      null,
      {
        id: 'blank-name',
        name: '   ',
        createdAt: 'bad-date',
        updatedAt: 'bad-date',
        saves: [],
      },
      {
        id: 'valid-deck',
        name: 'Imported Deck',
        createdAt: 'bad-date',
        updatedAt: '2024-02-01T00:00:00.000Z',
        saves: [
          null,
          {
            id: 'bad-save',
            label: 'Broken Save',
            savedAt: '2024-02-02T00:00:00.000Z',
            cards: 'not-an-array',
          },
          {
            id: 'good-save',
            label: '  ',
            savedAt: 'bad-date',
            cards: [
              {
                oracleId: 'good-card',
                name: 'Island',
                quantity: 2,
                typeLine: 'Basic Land - Island',
                category: 'Land',
                setCode: 'M21',
                collectorNumber: '310',
              },
            ],
          },
          {
            id: 'invalid-card-save',
            label: 'Invalid cards',
            savedAt: '2024-02-02T00:00:00.000Z',
            cards: [{ name: 'Broken card' }],
          },
        ],
      },
    ]

    const normalized = normalizeLegacyDecks(malformedLegacyDecks, new Set())

    expect(normalized.ok).toBe(false)
    if (normalized.ok) {
      throw new Error('Expected malformed legacy decks to fail validation')
    }

    expect(normalized.message).toBe('Local deck 1 is not a valid object.')
  })
})
