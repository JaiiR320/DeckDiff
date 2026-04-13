import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronDown, Download, Import, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CARD_CATEGORIES,
  type CardCategory,
  type InvalidDeckCard,
  type ValidatedDeckCard,
  formatDeckExport,
  mergeValidatedCards,
  parseDecklist,
} from '../lib/decklist'
import { formatFolderName, getFolderById } from '../lib/folders'
import { searchCards, type SearchCardResult, validateDeckEntries } from '../lib/scryfall'

export const Route = createFileRoute('/folders/$folderId')({
  component: FolderDetailPage,
})

type DeckSide = 'left' | 'right'

type DeckColumnState = {
  rawText: string
  validCards: ValidatedDeckCard[]
  invalidCards: InvalidDeckCard[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | null
}

type DiffRow = {
  oracleId: string
  name: string
  category: CardCategory
  leftQuantity: number | null
  rightQuantity: number | null
  state: 'removed' | 'added' | 'changed' | 'same'
}

const emptyDeckState: DeckColumnState = {
  rawText: '',
  validCards: [],
  invalidCards: [],
  status: 'idle',
  errorMessage: null,
}

function buildDiffRows(leftCards: ValidatedDeckCard[], rightCards: ValidatedDeckCard[]) {
  const leftMerged = mergeValidatedCards(leftCards)
  const rightMerged = mergeValidatedCards(rightCards)
  const leftByOracleId = new Map(leftMerged.map((card) => [card.oracleId, card]))
  const rightByOracleId = new Map(rightMerged.map((card) => [card.oracleId, card]))
  const allOracleIds = new Set([...leftByOracleId.keys(), ...rightByOracleId.keys()])
  const rows: DiffRow[] = []

  for (const oracleId of allOracleIds) {
    const leftCard = leftByOracleId.get(oracleId)
    const rightCard = rightByOracleId.get(oracleId)

    rows.push({
      oracleId,
      name: leftCard?.name ?? rightCard?.name ?? 'Unknown Card',
      category: leftCard?.category ?? rightCard?.category ?? 'Other',
      leftQuantity: leftCard?.quantity ?? null,
      rightQuantity: rightCard?.quantity ?? null,
      state:
        leftCard && rightCard
          ? leftCard.quantity === rightCard.quantity
            ? 'same'
            : 'changed'
          : leftCard
            ? 'removed'
            : 'added',
    })
  }

  rows.sort((left, right) => {
    const categoryCompare = CARD_CATEGORIES.indexOf(left.category) - CARD_CATEGORIES.indexOf(right.category)
    if (categoryCompare !== 0) {
      return categoryCompare
    }

    return left.name.localeCompare(right.name)
  })

  return rows
}

function FolderDetailPage() {
  const { folderId } = Route.useParams()
  const folder = getFolderById(folderId)
  const folderName = folder?.name ?? formatFolderName(folderId)
  const [leftDeck, setLeftDeck] = useState<DeckColumnState>(emptyDeckState)
  const [rightDeck, setRightDeck] = useState<DeckColumnState>(emptyDeckState)
  const [importSide, setImportSide] = useState<DeckSide | null>(null)
  const [draftDeck, setDraftDeck] = useState('')

  function openImportModal(side: DeckSide) {
    setImportSide(side)
    setDraftDeck(side === 'left' ? leftDeck.rawText : rightDeck.rawText)
  }

  function closeImportModal() {
    setImportSide(null)
    setDraftDeck('')
  }

  async function handleImportDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!importSide) {
      return
    }

    const setDeck = importSide === 'left' ? setLeftDeck : setRightDeck
    const rawText = draftDeck.trim()
    const { entries, errors } = parseDecklist(rawText)

    setDeck((currentDeck) => ({
      ...currentDeck,
      rawText,
      status: 'loading',
      invalidCards: [],
      errorMessage: null,
    }))
    closeImportModal()

    try {
      const { validCards, invalidCards } = await validateDeckEntries(entries)

      setDeck({
        rawText,
        validCards,
        invalidCards: [
          ...errors.map((error) => ({
            lineNumber: error.lineNumber,
            quantity: 0,
            name: error.text,
            reason: error.reason,
          })),
          ...invalidCards,
        ],
        status: 'ready',
        errorMessage: null,
      })
      closeImportModal()
    } catch (error) {
      setDeck({
        rawText,
        validCards: [],
        invalidCards: [],
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Could not import this deck right now.',
      })
    }
  }

  function dismissWarnings(side: DeckSide) {
    const setDeck = side === 'left' ? setLeftDeck : setRightDeck

    setDeck((currentDeck) => ({
      ...currentDeck,
      invalidCards: [],
    }))
  }

  function handleExportDeck(side: DeckSide) {
    const deck = side === 'left' ? leftDeck : rightDeck
    if (deck.validCards.length === 0) {
      return
    }

    const file = new Blob([formatDeckExport(deck.validCards)], { type: 'text/plain' })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = `${folderName.toLowerCase().replace(/\s+/g, '-')}-${side}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleAddCard(side: DeckSide, card: SearchCardResult) {
    const setDeck = side === 'left' ? setLeftDeck : setRightDeck

    setDeck((currentDeck) => ({
      ...currentDeck,
      validCards: [
        ...currentDeck.validCards,
        {
          oracleId: card.oracleId,
          name: card.name,
          quantity: 1,
          typeLine: card.typeLine,
          category: card.category,
        },
      ],
      status: 'ready',
      errorMessage: null,
    }))
  }

  const diffRows = buildDiffRows(leftDeck.validCards, rightDeck.validCards)

  return (
    <>
      <main className="mx-auto min-h-screen w-full max-w-7xl px-8 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Link
            to="/"
            className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
          >
            Back
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
              {folderName}
            </h1>
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
          <div className="grid border-b border-zinc-800 md:grid-cols-2">
            <DeckColumnHeader
              side="left"
              title="Left Deck"
              deck={leftDeck}
              onImport={() => openImportModal('left')}
              onExport={() => handleExportDeck('left')}
              onAddCard={handleAddCard}
            />
            <DeckColumnHeader
              side="right"
              title="Right Deck"
              deck={rightDeck}
              onImport={() => openImportModal('right')}
              onExport={() => handleExportDeck('right')}
              onAddCard={handleAddCard}
            />
          </div>

          <div className="grid gap-5 border-b border-zinc-800 p-5 md:grid-cols-2">
            <DeckAlerts
              side="left"
              deck={leftDeck}
              onDismissWarnings={() => dismissWarnings('left')}
            />
            <DeckAlerts
              side="right"
              deck={rightDeck}
              onDismissWarnings={() => dismissWarnings('right')}
            />
          </div>

          <SplitDiffView leftDeck={leftDeck} rightDeck={rightDeck} diffRows={diffRows} />
        </section>
      </main>

      {importSide ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <button
            type="button"
            aria-label="Close import deck modal"
            className="absolute inset-0"
            onClick={closeImportModal}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">Import Deck</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Paste the deck list for the {importSide === 'left' ? 'left' : 'right'} column.
                </p>
              </div>
              <button
                type="button"
                onClick={closeImportModal}
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-5" onSubmit={handleImportDeck}>
              <textarea
                autoFocus
                spellCheck={false}
                value={draftDeck}
                onChange={(event) => setDraftDeck(event.target.value)}
                placeholder="Paste a deck list here"
                className="min-h-80 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
              />

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeImportModal}
                  className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!draftDeck.trim()}
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
                >
                  Validate Deck
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}

function DeckColumnHeader({
  side,
  title,
  deck,
  onImport,
  onExport,
  onAddCard,
}: {
  side: DeckSide
  title: string
  deck: DeckColumnState
  onImport: () => void
  onExport: () => void
  onAddCard: (side: DeckSide, card: SearchCardResult) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchCardResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 3) {
      setResults([])
      setIsSearching(false)
      return
    }

    let isCancelled = false
    setIsSearching(true)

    const timeoutId = window.setTimeout(async () => {
      const nextResults = await searchCards(trimmedQuery)

      if (isCancelled) {
        return
      }

      setResults(nextResults)
      setIsSearching(false)
    }, 300)

    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query])

  function handleSelectCard(card: SearchCardResult) {
    onAddCard(side, card)
    setQuery('')
    setResults([])
    setIsSearching(false)
  }

  return (
    <div className="flex flex-col gap-4 border-b border-zinc-800 p-5 last:border-b-0 md:border-b-0 md:first:border-r">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {deck.status === 'loading'
              ? 'Validating deck...'
              : deck.validCards.length > 0
                ? `${deck.validCards.length} valid card entries`
                : 'No deck imported'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={deck.validCards.length === 0 || deck.status === 'loading'}
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Export
          </button>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <Import className="h-4 w-4" strokeWidth={1.75} />
            Import
          </button>
        </div>
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Add card"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
        />

        {query.trim().length >= 3 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
            {isSearching ? (
              <div className="px-4 py-3 text-sm text-zinc-500">Searching cards...</div>
            ) : results.length > 0 ? (
              <div className="divide-y divide-zinc-800">
                {results.map((card) => (
                  <button
                    key={`${card.oracleId}-${card.name}`}
                    type="button"
                    onClick={() => handleSelectCard(card)}
                    className="block w-full px-4 py-3 text-left transition hover:bg-zinc-900"
                  >
                    <div className="text-sm font-medium text-zinc-100">{card.name}</div>
                    <div className="mt-1 text-xs text-zinc-500">{card.typeLine}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-sm text-zinc-500">No cards found.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function DeckAlerts({
  side,
  deck,
  onDismissWarnings,
}: {
  side: DeckSide
  deck: DeckColumnState
  onDismissWarnings: () => void
}) {
  return (
    <div>
      {deck.errorMessage ? (
        <div className="mb-4 rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-300">
          {deck.errorMessage}
        </div>
      ) : null}

      {deck.invalidCards.length > 0 ? (
        <section className="mb-4 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-sm font-semibold text-amber-200">Warnings</h3>
            <button
              type="button"
              onClick={onDismissWarnings}
              className="rounded-lg p-1.5 text-amber-300 transition hover:bg-amber-900/30 hover:text-amber-100"
              aria-label="Dismiss warnings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-amber-100/90">
            {deck.invalidCards.map((card) => (
              <li key={`${card.lineNumber}-${card.name}`}>
                <span className="font-medium">Line {card.lineNumber}:</span> {card.name}{' '}
                <span className="text-amber-300">{card.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {deck.status === 'loading' ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
          <p className="max-w-sm text-sm text-zinc-500">Validating the {side} deck with Scryfall.</p>
        </div>
      ) : (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
          <p className="max-w-sm text-sm text-zinc-500">
            {deck.rawText
              ? `No valid cards were loaded into the ${side} deck.`
              : `Import a ${side} deck to start building the diff.`}
          </p>
        </div>
      )}
    </div>
  )
}

function SplitDiffView({
  leftDeck,
  rightDeck,
  diffRows,
}: {
  leftDeck: DeckColumnState
  rightDeck: DeckColumnState
  diffRows: DiffRow[]
}) {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  function toggleCategory(category: string) {
    setCollapsedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }))
  }

  const categoriesWithCards = CARD_CATEGORIES.filter((category) =>
    diffRows.some((row) => row.category === category),
  )

  const isReadyForDiff =
    leftDeck.status !== 'loading' &&
    rightDeck.status !== 'loading' &&
    (leftDeck.validCards.length > 0 || rightDeck.validCards.length > 0)

  return (
    <div className="p-5">
      {!isReadyForDiff ? (
        <div className="flex min-h-[24rem] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
          <p className="max-w-sm text-sm text-zinc-500">
            Import cards into the left and right decks to start comparing changes.
          </p>
        </div>
      ) : categoriesWithCards.length === 0 ? (
        <div className="flex min-h-[24rem] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
          <p className="max-w-sm text-sm text-zinc-500">
            No cards available to compare between the master deck on the left and the compared deck on the right.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {categoriesWithCards.map((category) => {
            const categoryRows = diffRows.filter((row) => row.category === category)
            const changedCount = categoryRows.filter((row) => row.state !== 'same').length

            return (
              <section key={category} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60">
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${collapsedCategories[category] ? '' : 'border-b border-zinc-800'}`}
                >
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
                      {category}
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600">
                      {categoryRows.length} card{categoryRows.length === 1 ? '' : 's'}
                      {changedCount > 0 ? `, ${changedCount} change${changedCount === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-zinc-500 transition ${collapsedCategories[category] ? '-rotate-90' : 'rotate-0'}`}
                  />
                </button>

                {collapsedCategories[category] ? null : (
                  <div>
                    <div className="grid grid-cols-2 border-b border-zinc-800 bg-zinc-950/80 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                      <div className="border-r border-zinc-800 px-4 py-2">Master</div>
                      <div className="px-4 py-2">Compared</div>
                    </div>
                    <div className="divide-y divide-zinc-800">
                      {categoryRows.map((row) => (
                        <div key={row.oracleId} className="grid grid-cols-2">
                          <DiffCell side="left" row={row} />
                          <DiffCell side="right" row={row} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DiffCell({ side, row }: { side: DeckSide; row: DiffRow }) {
  const quantity = side === 'left' ? row.leftQuantity : row.rightQuantity
  const isChanged = row.state === 'changed'
  const isRemoved = row.state === 'removed' && side === 'left'
  const isAdded = row.state === 'added' && side === 'right'
  const colorClass = isChanged
    ? 'bg-amber-950/30'
    : isRemoved
      ? 'bg-rose-950/30'
      : isAdded
        ? 'bg-emerald-950/30'
        : 'bg-transparent'

  return (
    <div
      className={`min-h-14 px-4 py-3 text-sm ${colorClass} ${side === 'left' ? 'border-r border-zinc-800' : ''}`}
    >
      {quantity === null ? null : (
        <div className="flex items-center justify-between gap-4">
          <span className="text-zinc-100">{row.name}</span>
          <span className="font-medium text-zinc-400">{quantity}</span>
        </div>
      )}
    </div>
  )
}
