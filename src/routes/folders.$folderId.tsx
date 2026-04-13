import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronDown, Download, Import, RotateCcw, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CARD_CATEGORIES,
  type CardCategory,
  type DeckExportOptions,
  type InvalidDeckCard,
  type ValidatedDeckCard,
  formatDecklist,
  mergeValidatedCards,
  parseDecklist,
} from '../lib/decklist'
import { formatFolderName, getFolderById } from '../lib/folders'
import { searchCards, type SearchCardResult, validateDeckEntries } from '../lib/scryfall'

export const Route = createFileRoute('/folders/$folderId')({
  component: FolderDetailPage,
})

type DeckState = {
  rawText: string
  cards: ValidatedDeckCard[]
  invalidCards: InvalidDeckCard[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorMessage: string | null
}

type EditorRow = {
  oracleId: string
  name: string
  category: CardCategory
  typeLine: string
  baselineQuantity: number
  currentQuantity: number
  status: 'same' | 'added' | 'removed' | 'changed'
}

type ExportModalState = {
  includeQuantity: boolean
  includeSet: boolean
  includeCollectorNumber: boolean
}

const emptyDeckState: DeckState = {
  rawText: '',
  cards: [],
  invalidCards: [],
  status: 'idle',
  errorMessage: null,
}

function buildEditorRows(baselineCards: ValidatedDeckCard[], workingCards: ValidatedDeckCard[]) {
  const baseline = mergeValidatedCards(baselineCards)
  const working = mergeValidatedCards(workingCards)
  const baselineById = new Map(baseline.map((card) => [card.oracleId, card]))
  const workingById = new Map(working.map((card) => [card.oracleId, card]))
  const allIds = new Set([...baselineById.keys(), ...workingById.keys()])
  const rows: EditorRow[] = []

  for (const oracleId of allIds) {
    const baselineCard = baselineById.get(oracleId)
    const workingCard = workingById.get(oracleId)
    const baselineQuantity = baselineCard?.quantity ?? 0
    const currentQuantity = workingCard?.quantity ?? 0

    rows.push({
      oracleId,
      name: workingCard?.name ?? baselineCard?.name ?? 'Unknown Card',
      category: workingCard?.category ?? baselineCard?.category ?? 'Other',
      typeLine: workingCard?.typeLine ?? baselineCard?.typeLine ?? '',
      baselineQuantity,
      currentQuantity,
      status:
        baselineQuantity === 0
          ? 'added'
          : currentQuantity === 0
            ? 'removed'
            : baselineQuantity !== currentQuantity
              ? 'changed'
              : 'same',
    })
  }

  return rows.sort((left, right) => {
    const categoryCompare = CARD_CATEGORIES.indexOf(left.category) - CARD_CATEGORIES.indexOf(right.category)
    if (categoryCompare !== 0) {
      return categoryCompare
    }

    return left.name.localeCompare(right.name)
  })
}

function groupEditorRows(rows: EditorRow[]) {
  const grouped: Record<CardCategory, EditorRow[]> = {
    Land: [],
    Creature: [],
    Artifact: [],
    Enchantment: [],
    Instant: [],
    Sorcery: [],
    Planeswalker: [],
    Battle: [],
    Other: [],
  }

  for (const row of rows) {
    grouped[row.category].push(row)
  }

  return grouped
}

function FolderDetailPage() {
  const { folderId } = Route.useParams()
  const folder = getFolderById(folderId)
  const folderName = folder?.name ?? formatFolderName(folderId)
  const [baselineDeck, setBaselineDeck] = useState<DeckState>(emptyDeckState)
  const [workingCards, setWorkingCards] = useState<ValidatedDeckCard[]>([])
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [draftDeck, setDraftDeck] = useState('')
  const [exportOptions, setExportOptions] = useState<ExportModalState>({
    includeQuantity: true,
    includeSet: false,
    includeCollectorNumber: false,
  })

  const editorRows = buildEditorRows(baselineDeck.cards, workingCards)
  const groupedRows = groupEditorRows(editorRows)
  const resultCardTotal = editorRows.reduce((total, row) => total + row.currentQuantity, 0)

  function openImportModal() {
    setDraftDeck(baselineDeck.rawText)
    setIsImportOpen(true)
  }

  function closeImportModal() {
    setDraftDeck('')
    setIsImportOpen(false)
  }

  function openExportModal() {
    setIsExportOpen(true)
  }

  function closeExportModal() {
    setIsExportOpen(false)
  }

  async function handleImportDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const rawText = draftDeck.trim()
    const { entries, errors } = parseDecklist(rawText)

    setBaselineDeck((currentDeck) => ({
      ...currentDeck,
      rawText,
      status: 'loading',
      invalidCards: [],
      errorMessage: null,
    }))
    closeImportModal()

    try {
      const { validCards, invalidCards } = await validateDeckEntries(entries)
      const warnings = [
        ...errors.map((error) => ({
          lineNumber: error.lineNumber,
          quantity: 0,
          name: error.text,
          reason: error.reason,
        })),
        ...invalidCards,
      ]

      setBaselineDeck({
        rawText,
        cards: validCards,
        invalidCards: warnings,
        status: 'ready',
        errorMessage: null,
      })
      setWorkingCards(validCards)
    } catch (error) {
      setBaselineDeck({
        rawText,
        cards: [],
        invalidCards: [],
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Could not import this deck right now.',
      })
      setWorkingCards([])
    }
  }

  function dismissWarnings() {
    setBaselineDeck((currentDeck) => ({
      ...currentDeck,
      invalidCards: [],
    }))
  }

  function addCard(card: SearchCardResult) {
    setWorkingCards((currentCards) => [
      ...currentCards,
      {
        oracleId: card.oracleId,
        name: card.name,
        quantity: 1,
        typeLine: card.typeLine,
        category: card.category,
      },
    ])
  }

  function adjustQuantity(row: EditorRow, delta: number) {
    setWorkingCards((currentCards) => {
      const currentIndex = currentCards.findIndex((card) => card.oracleId === row.oracleId)

      if (currentIndex === -1) {
        if (delta <= 0) {
          return currentCards
        }

        return [
          ...currentCards,
          {
            oracleId: row.oracleId,
            name: row.name,
            quantity: 1,
            typeLine: row.typeLine,
            category: row.category,
          },
        ]
      }

      return currentCards
        .map((card, index) =>
          index === currentIndex
            ? {
                ...card,
                quantity: card.quantity + delta,
              }
            : card,
        )
        .filter((card) => card.quantity > 0)
    })
  }

  function removeCard(row: EditorRow) {
    setWorkingCards((currentCards) => currentCards.filter((card) => card.oracleId !== row.oracleId))
  }

  function restoreCard(row: EditorRow) {
    if (row.baselineQuantity <= 0) {
      return
    }

    setWorkingCards((currentCards) => [
      ...currentCards,
      {
        oracleId: row.oracleId,
        name: row.name,
        quantity: row.baselineQuantity,
        typeLine: row.typeLine,
        category: row.category,
      },
    ])
  }

  function exportResult() {
    const mergedWorkingCards = mergeValidatedCards(workingCards)
    if (mergedWorkingCards.length === 0) {
      return
    }

    openExportModal()
  }

  async function copyExportToClipboard() {
    const mergedWorkingCards = mergeValidatedCards(workingCards)
    const text = formatDecklist(mergedWorkingCards, {
      includeQuantity: exportOptions.includeQuantity,
      includeSet: exportOptions.includeSet || exportOptions.includeCollectorNumber,
      includeCollectorNumber: exportOptions.includeCollectorNumber,
      setStyle: 'brackets',
    })

    await navigator.clipboard.writeText(text)
    closeExportModal()
  }

  const exportPreview = formatDecklist(mergeValidatedCards(workingCards), {
    includeQuantity: exportOptions.includeQuantity,
    includeSet: exportOptions.includeSet || exportOptions.includeCollectorNumber,
    includeCollectorNumber: exportOptions.includeCollectorNumber,
    setStyle: 'brackets',
  })

  return (
    <>
      <main className="mx-auto min-h-screen w-full max-w-5xl px-8 py-8">
        <div className="mb-8 flex items-center gap-4">
          <Link
            to="/"
            className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
          >
            Back
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{folderName}</h1>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
          <EditorHeader
            onImport={openImportModal}
            onExport={exportResult}
            exportDisabled={mergeValidatedCards(workingCards).length === 0 || baselineDeck.status === 'loading'}
            onAddCard={addCard}
          />

          <DeckAlerts
            deck={baselineDeck}
            onDismissWarnings={dismissWarnings}
            emptyMessage="Import a baseline deck to start editing."
          />

          <EditorDeckList
            groupedRows={groupedRows}
            emptyMessage="No cards in this deck yet."
            resultCardTotal={resultCardTotal}
            onAdjustQuantity={adjustQuantity}
            onRemoveCard={removeCard}
            onRestoreCard={restoreCard}
          />
        </section>
      </main>

      {isImportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <button
            type="button"
            aria-label="Close import modal"
            className="absolute inset-0"
            onClick={closeImportModal}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">Import Deck</h2>
                <p className="mt-1 text-sm text-zinc-500">Paste the baseline deck list.</p>
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
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Validate Import
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isExportOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <button
            type="button"
            aria-label="Close export modal"
            className="absolute inset-0"
            onClick={closeExportModal}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-0 shadow-2xl shadow-black/40">
            <div className="border-b border-zinc-800 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-zinc-100">Export Deck</h2>
                </div>
                <button
                  type="button"
                  onClick={closeExportModal}
                  className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="flex flex-wrap gap-3">
                <ToggleChip
                  label="Quantity"
                  checked={exportOptions.includeQuantity}
                  onToggle={() =>
                    setExportOptions((current) => ({
                      ...current,
                      includeQuantity: !current.includeQuantity,
                    }))
                  }
                />
                <ToggleChip
                  label="Set"
                  checked={exportOptions.includeSet || exportOptions.includeCollectorNumber}
                  onToggle={() =>
                    setExportOptions((current) => {
                      const nextIncludeSet = !current.includeSet

                      return {
                        ...current,
                        includeSet: nextIncludeSet,
                        includeCollectorNumber: nextIncludeSet ? current.includeCollectorNumber : false,
                      }
                    })
                  }
                />
                <ToggleChip
                  label="Number"
                  checked={exportOptions.includeCollectorNumber}
                  onToggle={() =>
                    setExportOptions((current) => ({
                      ...current,
                      includeSet: true,
                      includeCollectorNumber: !current.includeCollectorNumber,
                    }))
                  }
                />
              </div>

              <textarea
                readOnly
                value={exportPreview}
                className="min-h-80 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-200 outline-none"
              />
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-5">
              <button
                type="button"
                onClick={closeExportModal}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void copyExportToClipboard()}
                className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ToggleChip({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 text-sm transition ${checked ? 'border-cyan-800 bg-cyan-950/40 text-cyan-200' : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800'}`}
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-cyan-500/80' : 'bg-zinc-800'}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </span>
      {label}
    </button>
  )
}

function EditorHeader({
  onImport,
  onExport,
  exportDisabled,
  onAddCard,
}: {
  onImport: () => void
  onExport: () => void
  exportDisabled: boolean
  onAddCard: (card: SearchCardResult) => void
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
    onAddCard(card)
    setQuery('')
    setResults([])
    setIsSearching(false)
  }

  return (
    <div className="border-b border-zinc-800 p-5">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
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

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
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
    </div>
  )
}

function DeckAlerts({
  deck,
  onDismissWarnings,
  emptyMessage,
}: {
  deck: DeckState
  onDismissWarnings: () => void
  emptyMessage: string
}) {
  return (
    <div className="space-y-4 px-5 pt-5">
      {deck.errorMessage ? (
        <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-300">
          {deck.errorMessage}
        </div>
      ) : null}

      {deck.invalidCards.length > 0 ? (
        <section className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
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
        <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
          <p className="max-w-sm text-sm text-zinc-500">Validating the imported deck with Scryfall.</p>
        </div>
      ) : null}

      {deck.status === 'idle' ? (
        <div className="flex min-h-20 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
          <p className="max-w-sm text-sm text-zinc-500">{emptyMessage}</p>
        </div>
      ) : null}
    </div>
  )
}

function EditorDeckList({
  groupedRows,
  emptyMessage,
  resultCardTotal,
  onAdjustQuantity,
  onRemoveCard,
  onRestoreCard,
}: {
  groupedRows: Record<CardCategory, EditorRow[]>
  emptyMessage: string
  resultCardTotal: number
  onAdjustQuantity: (row: EditorRow, delta: number) => void
  onRemoveCard: (row: EditorRow) => void
  onRestoreCard: (row: EditorRow) => void
}) {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const categoriesWithRows = CARD_CATEGORIES.filter((category) => groupedRows[category].length > 0)
  const areAllCollapsed =
    categoriesWithRows.length > 0 && categoriesWithRows.every((category) => collapsedCategories[category])

  function toggleCategory(category: string) {
    setCollapsedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }))
  }

  function setAllCategoriesCollapsed(isCollapsed: boolean) {
    setCollapsedCategories(
      Object.fromEntries(categoriesWithRows.map((category) => [category, isCollapsed])),
    )
  }

  if (categoriesWithRows.length === 0) {
    return (
      <div className="p-5">
        <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
          <p className="max-w-sm text-sm text-zinc-500">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-5 pb-5 pt-1">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          {resultCardTotal} total card{resultCardTotal === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          onClick={() => setAllCategoriesCollapsed(!areAllCollapsed)}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
        >
          {areAllCollapsed ? 'Expand All' : 'Collapse All'}
        </button>
      </div>

      {categoriesWithRows.map((category) => (
        <section key={category} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
          {(() => {
            const rows = groupedRows[category]
            const addedCount = rows.filter((row) => row.status === 'added').length
            const changedCount = rows.filter((row) => row.status === 'changed').length
            const removedCount = rows.filter((row) => row.status === 'removed').length

            return (
          <button
            type="button"
            onClick={() => toggleCategory(category)}
            className={`flex w-full items-center justify-between gap-3 bg-zinc-900/80 px-4 py-3 text-left ${collapsedCategories[category] ? '' : 'border-b border-zinc-800'}`}
          >
            <div>
              <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{category}</h3>
              <p className="mt-1 font-mono text-[11px] text-zinc-600">
                {rows.length} card{rows.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-wide">
                <span className="text-emerald-300">+{addedCount}</span>
                <span className="text-amber-300">~{changedCount}</span>
                <span className="text-rose-300">-{removedCount}</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-zinc-500 transition ${collapsedCategories[category] ? '-rotate-90' : 'rotate-0'}`}
              />
            </div>
          </button>
            )
          })()}

          {collapsedCategories[category] ? null : (
            <div className="divide-y divide-zinc-800">
              {groupedRows[category].map((row) => {
                const toneClass =
                  row.status === 'added'
                    ? 'border-l-4 border-emerald-500 bg-emerald-950/20'
                    : row.status === 'removed'
                      ? 'border-l-4 border-rose-500 bg-rose-950/20'
                      : row.status === 'changed'
                        ? 'border-l-4 border-amber-500 bg-amber-950/20'
                        : 'border-l-4 border-transparent'
                const markerClass =
                  row.status === 'added'
                    ? 'text-emerald-300'
                    : row.status === 'removed'
                      ? 'text-rose-300'
                      : row.status === 'changed'
                        ? 'text-amber-300'
                        : 'text-zinc-700'
                const marker = row.status === 'added' ? '+' : row.status === 'removed' ? '-' : row.status === 'changed' ? '~' : ' '

                return (
                  <div
                    key={row.oracleId}
                    className={`grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-sm ${toneClass}`}
                  >
                    <span className={`font-mono text-xs font-semibold ${markerClass}`}>{marker}</span>
                    <span className="text-zinc-100">{row.name}</span>
                    <div className="flex items-center gap-2">
                      <QuantityStepper
                        quantity={row.currentQuantity}
                        baselineQuantity={row.baselineQuantity}
                        tone={row.status}
                        decrementLabel={`Decrease ${row.name} quantity`}
                        incrementLabel={`Increase ${row.name} quantity`}
                        onDecrement={() => onAdjustQuantity(row, -1)}
                        onIncrement={() => onAdjustQuantity(row, 1)}
                      />
                      {row.status === 'removed' ? (
                        <button
                          type="button"
                          onClick={() => onRestoreCard(row)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-800 bg-rose-950/40 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-rose-200 transition hover:bg-rose-950/60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restore
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onRemoveCard(row)}
                          className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-wide text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function QuantityStepper({
  quantity,
  baselineQuantity,
  tone,
  decrementLabel,
  incrementLabel,
  onDecrement,
  onIncrement,
}: {
  quantity: number
  baselineQuantity: number
  tone: EditorRow['status']
  decrementLabel: string
  incrementLabel: string
  onDecrement: () => void
  onIncrement: () => void
}) {
  const badgeClass =
    tone === 'added'
      ? 'border-emerald-900 bg-emerald-950/40 text-emerald-300'
      : tone === 'removed'
        ? 'border-rose-900 bg-rose-950/40 text-rose-300'
        : tone === 'changed'
          ? 'border-amber-900 bg-amber-950/40 text-amber-300'
          : 'border-zinc-800 bg-zinc-900 text-zinc-400'

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={decrementLabel}
        onClick={onDecrement}
        disabled={quantity === 0 && baselineQuantity === 0}
        className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        -
      </button>
      <span
        className={`min-w-10 rounded-md border px-2 py-1 text-center font-mono text-[11px] font-medium ${badgeClass}`}
      >
        {quantity}
      </span>
      <button
        type="button"
        aria-label={incrementLabel}
        onClick={onIncrement}
        className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px] font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
      >
        +
      </button>
    </div>
  )
}
