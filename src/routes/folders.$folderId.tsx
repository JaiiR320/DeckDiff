import { Link, createFileRoute } from '@tanstack/react-router'
import { Download, Import, X } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { formatFolderName, getFolderById } from '../lib/folders'

export const Route = createFileRoute('/folders/$folderId')({
  component: FolderDetailPage,
})

type DeckSide = 'left' | 'right'

function FolderDetailPage() {
  const { folderId } = Route.useParams()
  const folder = getFolderById(folderId)
  const folderName = folder?.name ?? formatFolderName(folderId)
  const [leftDeck, setLeftDeck] = useState('')
  const [rightDeck, setRightDeck] = useState('')
  const [importSide, setImportSide] = useState<DeckSide | null>(null)
  const [draftDeck, setDraftDeck] = useState('')

  function openImportModal(side: DeckSide) {
    setImportSide(side)
    setDraftDeck(side === 'left' ? leftDeck : rightDeck)
  }

  function closeImportModal() {
    setImportSide(null)
    setDraftDeck('')
  }

  function handleImportDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!importSide) {
      return
    }

    if (importSide === 'left') {
      setLeftDeck(draftDeck.trim())
    } else {
      setRightDeck(draftDeck.trim())
    }

    closeImportModal()
  }

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
              title="Left Deck"
              hasDeck={Boolean(leftDeck)}
              onImport={() => openImportModal('left')}
            />
            <DeckColumnHeader
              title="Right Deck"
              hasDeck={Boolean(rightDeck)}
              onImport={() => openImportModal('right')}
            />
          </div>

          <div className="grid min-h-[32rem] md:grid-cols-2">
            <DiffPlaceholder side="left" hasDeck={Boolean(leftDeck)} />
            <DiffPlaceholder side="right" hasDeck={Boolean(rightDeck)} />
          </div>
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
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
                >
                  Save Deck
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
  title,
  hasDeck,
  onImport,
}: {
  title: string
  hasDeck: boolean
  onImport: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800 p-5 last:border-b-0 md:border-b-0 md:first:border-r">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {hasDeck ? 'Deck imported' : 'No deck imported'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onImport}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <Import className="h-4 w-4" strokeWidth={1.75} />
          Import
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!hasDeck}
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Export
        </button>
      </div>
    </div>
  )
}

function DiffPlaceholder({
  side,
  hasDeck,
}: {
  side: DeckSide
  hasDeck: boolean
}) {
  return (
    <div className="border-zinc-800 p-5 md:first:border-r">
      <div className="flex h-full min-h-[26rem] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
        <p className="max-w-sm text-sm text-zinc-500">
          {hasDeck
            ? `The ${side} deck is loaded. Diff rows will appear here once comparison is implemented.`
            : `Import a ${side} deck to start building the diff.`}
        </p>
      </div>
    </div>
  )
}
