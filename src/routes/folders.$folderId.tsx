import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { DeckAlerts } from '../components/deck-editor/DeckAlerts'
import { EditorDeckList } from '../components/deck-editor/EditorDeckList'
import { EditorHeader } from '../components/deck-editor/EditorHeader'
import { ExportDeckModal } from '../components/deck-editor/modals/ExportDeckModal'
import { ImportDeckModal } from '../components/deck-editor/modals/ImportDeckModal'
import { buildEditorRows, groupEditorRows } from '../components/deck-editor/editorRows'
import type { DeckState, ExportModalState, EditorRow } from '../components/deck-editor/types'
import {
  formatDecklist,
  mergeValidatedCards,
  parseDecklist,
  type ValidatedDeckCard,
} from '../lib/decklist'
import { formatFolderName, getFolderById } from '../lib/folders'
import { type SearchCardResult, validateDeckEntries } from '../lib/scryfall'

export const Route = createFileRoute('/folders/$folderId')({
  component: FolderDetailPage,
})

const emptyDeckState: DeckState = {
  rawText: '',
  cards: [],
  invalidCards: [],
  status: 'idle',
  errorMessage: null,
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
  })

  const mergedWorkingCards = mergeValidatedCards(workingCards)
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

  function toggleExportQuantity() {
    setExportOptions((current) => ({
      ...current,
      includeQuantity: !current.includeQuantity,
    }))
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

  function restoreCard(row: EditorRow) {
    setWorkingCards((currentCards) => {
      const nextCards = currentCards.filter((card) => card.oracleId !== row.oracleId)

      if (row.baselineQuantity <= 0) {
        return nextCards
      }

      return [
        ...nextCards,
        {
          oracleId: row.oracleId,
          name: row.name,
          quantity: row.baselineQuantity,
          typeLine: row.typeLine,
          category: row.category,
        },
      ]
    })
  }

  function exportResult() {
    if (mergedWorkingCards.length === 0) {
      return
    }

    openExportModal()
  }

  async function copyExportToClipboard() {
    await navigator.clipboard.writeText(exportPreview)
    closeExportModal()
  }

  const exportPreview = formatDecklist(mergedWorkingCards, {
    includeQuantity: exportOptions.includeQuantity,
    includeSet: false,
    includeCollectorNumber: false,
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
            exportDisabled={mergedWorkingCards.length === 0 || baselineDeck.status === 'loading'}
            onAddCard={addCard}
          />

          <DeckAlerts deck={baselineDeck} onDismissWarnings={dismissWarnings} />

          <EditorDeckList
            groupedRows={groupedRows}
            emptyMessage="Import a deck or add cards to start building."
            resultCardTotal={resultCardTotal}
            onAdjustQuantity={adjustQuantity}
            onRestoreCard={restoreCard}
          />
        </section>
      </main>

      {isImportOpen ? (
        <ImportDeckModal
          draftDeck={draftDeck}
          onDraftDeckChange={setDraftDeck}
          onClose={closeImportModal}
          onSubmit={handleImportDeck}
        />
      ) : null}

      {isExportOpen ? (
        <ExportDeckModal
          exportOptions={exportOptions}
          exportPreview={exportPreview}
          onClose={closeExportModal}
          onCopy={() => void copyExportToClipboard()}
          onToggleIncludeQuantity={toggleExportQuantity}
        />
      ) : null}
    </>
  )
}
