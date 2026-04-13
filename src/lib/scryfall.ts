import {
  type InvalidDeckCard,
  type ParsedDeckEntry,
  type ValidatedDeckCard,
  getCardCategory,
} from './decklist'

type ScryfallCard = {
  name: string
  oracle_id: string | null
  id: string
  type_line: string
  set: string
  collector_number: string
}

type ScryfallCollectionResponse = {
  data: ScryfallCard[]
  not_found?: Array<{ name?: string }>
}

type ScryfallSearchResponse = {
  data: ScryfallCard[]
}

type ScryfallErrorResponse = {
  object: 'error'
  details: string
}

export type SearchCardResult = {
  oracleId: string
  name: string
  typeLine: string
  category: ReturnType<typeof getCardCategory>
  setCode?: string
  collectorNumber?: string
}

const SCRYFALL_COLLECTION_LIMIT = 75

function normalizeCardQuery(query: string) {
  return query
    .replace(/\s*\/\/\s*/g, ' // ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getCollectionLookupName(name: string) {
  const normalizedName = normalizeCardQuery(name)
  return normalizedName.includes('//')
    ? normalizedName.split('//')[0]?.trim() ?? normalizedName
    : normalizedName
}

function toSearchCardResult(card: ScryfallCard): SearchCardResult {
  return {
    oracleId: card.oracle_id ?? card.id,
    name: card.name,
    typeLine: card.type_line,
    category: getCardCategory(card.type_line),
    setCode: card.set?.toUpperCase(),
    collectorNumber: card.collector_number,
  }
}

function chunkNames(names: string[], size: number) {
  const chunks: string[][] = []

  for (let index = 0; index < names.length; index += size) {
    chunks.push(names.slice(index, index + size))
  }

  return chunks
}

async function fetchCardCollection(names: string[]) {
  const response = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifiers: names.map((name) => ({ name })),
    }),
  })

  if (!response.ok) {
    throw new Error('Could not validate cards with Scryfall.')
  }

  return (await response.json()) as ScryfallCollectionResponse
}

async function fetchCardCollectionByEntries(entries: ParsedDeckEntry[]) {
  const response = await fetch('https://api.scryfall.com/cards/collection', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifiers: entries.map((entry) =>
        entry.setCode
          ? { name: getCollectionLookupName(entry.name), set: entry.setCode.toLowerCase() }
          : { name: getCollectionLookupName(entry.name) },
      ),
    }),
  })

  if (!response.ok) {
    throw new Error('Could not validate cards with Scryfall.')
  }

  return (await response.json()) as ScryfallCollectionResponse
}

export async function searchCards(query: string) {
  const normalizedQuery = normalizeCardQuery(query)
  const headers = { Accept: 'application/json' }

  if (normalizedQuery.includes('//')) {
    const namedResponse = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(normalizedQuery)}`,
      { headers },
    )

    if (namedResponse.ok) {
      const card = (await namedResponse.json()) as ScryfallCard
      return [toSearchCardResult(card)]
    }

    const namedError = (await namedResponse.json()) as ScryfallErrorResponse
    if (namedError.object !== 'error') {
      return [] as SearchCardResult[]
    }
  }

  const response = await fetch(
    `https://api.scryfall.com/cards/search?unique=cards&order=name&q=${encodeURIComponent(normalizedQuery)}`,
    { headers },
  )

  if (!response.ok) {
    const fallbackResponse = await fetch(
      `https://api.scryfall.com/cards/search?unique=cards&order=name&q=${encodeURIComponent(`name:"${normalizedQuery}"`)}`,
      { headers },
    )

    if (!fallbackResponse.ok) {
      return [] as SearchCardResult[]
    }

    const fallbackPayload = (await fallbackResponse.json()) as ScryfallSearchResponse
    return fallbackPayload.data.slice(0, 8).map(toSearchCardResult)
  }

  const payload = (await response.json()) as ScryfallSearchResponse

  return payload.data.slice(0, 8).map(toSearchCardResult)
}

export async function validateDeckEntries(entries: ParsedDeckEntry[]) {
  if (entries.length === 0) {
    return {
      validCards: [] as ValidatedDeckCard[],
      invalidCards: [] as InvalidDeckCard[],
    }
  }

  const payloads: ScryfallCollectionResponse[] = []
  const uniqueEntries = [
    ...new Map(
      entries.map((entry) => [
        `${getCollectionLookupName(entry.name).toLowerCase()}::${entry.setCode ?? ''}`,
        entry,
      ]),
    ).values(),
  ]

  for (let index = 0; index < uniqueEntries.length; index += SCRYFALL_COLLECTION_LIMIT) {
    payloads.push(
      await fetchCardCollectionByEntries(uniqueEntries.slice(index, index + SCRYFALL_COLLECTION_LIMIT)),
    )
  }

  const allCards = payloads.flatMap((payload) => payload.data)
  const allNotFound = payloads.flatMap((payload) => payload.not_found ?? [])
  const cardByKey = new Map(
    allCards.map((card) => [`${card.name.toLowerCase()}::${card.set?.toUpperCase() ?? ''}`, card]),
  )
  const invalidNames = new Set(
    allNotFound.map((entry) => entry.name?.toLowerCase()).filter(Boolean),
  )

  const validCards: ValidatedDeckCard[] = []
  const invalidCards: InvalidDeckCard[] = []

  for (const entry of entries) {
    const lookupName = getCollectionLookupName(entry.name)
    const exactMatch = cardByKey.get(`${lookupName.toLowerCase()}::${entry.setCode ?? ''}`)
    const fallbackMatch = allCards.find(
      (card) =>
        (card.name.toLowerCase() === lookupName.toLowerCase() ||
          card.name.toLowerCase() === normalizeCardQuery(entry.name).toLowerCase()) &&
        (!entry.setCode || card.set?.toUpperCase() === entry.setCode),
    )
    const matchedCard = exactMatch ?? fallbackMatch

    if (!matchedCard || invalidNames.has(lookupName.toLowerCase())) {
      invalidCards.push({
        lineNumber: entry.lineNumber,
        quantity: entry.quantity,
        name: entry.name,
        reason: entry.setCode
          ? `Card not found on Scryfall for set ${entry.setCode}.`
          : 'Card not found on Scryfall.',
      })
      continue
    }

    validCards.push({
      oracleId: matchedCard.oracle_id ?? matchedCard.id,
      name: matchedCard.name,
      quantity: entry.quantity,
      typeLine: matchedCard.type_line,
      category: getCardCategory(matchedCard.type_line),
      setCode: matchedCard.set?.toUpperCase(),
      collectorNumber: matchedCard.collector_number,
    })
  }

  return { validCards, invalidCards }
}
