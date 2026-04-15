import { createFileRoute, redirect } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { DeckActionsModal } from '../components/decks/DeckActionsModal'
import { CreateDeckModal } from '../components/decks/CreateDeckModal'
import { DeckCard } from '../components/decks/DeckCard'
import { LegacyImportModal } from '../components/decks/LegacyImportModal'
import type { DeckItem } from '../lib/deck'
import { formatDeckExport } from '../lib/decklist'
import { clearLegacyDecks, loadDecks } from '../lib/storage'
import {
  createDeckForUser,
  deleteDeckForUser,
  importLegacyDecksForUser,
  listDecks,
  renameDeckForUser,
} from '#/server/decks'
import { getCurrentSession } from '#/server/session'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getCurrentSession()
    if (!session) {
      throw redirect({ to: '/auth' })
    }
  },
  loader: async () => listDecks(),
  component: App,
})

function App() {
  const initialDecks = Route.useLoaderData()
  const [decks, setDecks] = useState<DeckItem[]>(initialDecks)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [editingDeck, setEditingDeck] = useState<DeckItem | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [legacyDecks, setLegacyDecks] = useState<unknown[]>([])
  const [isLegacyImportOpen, setIsLegacyImportOpen] = useState(false)
  const [isImportingLegacyDecks, setIsImportingLegacyDecks] = useState(false)
  const [legacyImportError, setLegacyImportError] = useState<string | null>(null)

  useEffect(() => {
    const nextLegacyDecks = loadDecks()
    setLegacyDecks(nextLegacyDecks)
    setIsLegacyImportOpen(nextLegacyDecks.length > 0)
  }, [])

  function closeModal() {
    setIsCreateOpen(false)
    setDeckName('')
  }

  function closeEditModal() {
    setEditingDeck(null)
  }

  function closeLegacyImportModal() {
    setIsLegacyImportOpen(false)
    setLegacyImportError(null)
  }

  function handleDeleteLegacyDecks() {
    clearLegacyDecks()
    setLegacyDecks([])
    setIsLegacyImportOpen(false)
    setLegacyImportError(null)
  }

  async function handleCreateDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = deckName.trim()
    if (!name) {
      return
    }

    try {
      const newDeck = await createDeckForUser({
        data: { name },
      })

      if (!newDeck) {
        throw new Error('Could not create deck.')
      }

      setDecks((currentDecks) => [newDeck, ...currentDecks])
      setErrorMessage(null)
      closeModal()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not create deck right now.')
    }
  }

  async function handleRenameDeck(deckId: string, newName: string) {
    try {
      const updatedDeck = await renameDeckForUser({
        data: { deckId, newName },
      })

      if (!updatedDeck) {
        throw new Error('Could not rename deck.')
      }

      setDecks((currentDecks) => currentDecks.map((d) => (d.id === deckId ? updatedDeck : d)))
      setEditingDeck(updatedDeck)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not rename deck right now.')
    }
  }

  async function handleDeleteDeck(deckId: string) {
    try {
      await deleteDeckForUser({
        data: { deckId },
      })

      setDecks((currentDecks) => currentDecks.filter((d) => d.id !== deckId))
      setEditingDeck(null)
      setErrorMessage(null)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not delete deck right now.')
    }
  }

  async function handleImportLegacyDecks() {
    if (legacyDecks.length === 0) {
      return
    }

    setIsImportingLegacyDecks(true)
    setLegacyImportError(null)

    try {
      const result = await importLegacyDecksForUser({
        data: { decks: legacyDecks },
      })

      setDecks(result.decks)
      clearLegacyDecks()
      setLegacyDecks([])
      setIsLegacyImportOpen(false)
      setErrorMessage(null)
    } catch (error) {
      setLegacyImportError(error instanceof Error ? error.message : 'Could not import local decks right now.')
    } finally {
      setIsImportingLegacyDecks(false)
    }
  }

  function handleExportDeck(deck: DeckItem) {
    const latestSave = deck.saves[deck.saves.length - 1]
    if (!latestSave) {
      // No saves yet - export empty or show alert
      alert('No cards to export. Import or add cards first.')
      return
    }

    const exportText = formatDeckExport(latestSave.cards)

    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${deck.name.replace(/\s+/g, '-').toLowerCase()}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setEditingDeck(null)
  }

  return (
    <>
      <main className="mx-auto min-h-screen w-full max-w-7xl px-8 py-8">
        {errorMessage ? (
          <p className="mb-6 rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </p>
        ) : null}

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/50 text-zinc-400 transition hover:border-cyan-500/50 hover:text-cyan-300"
          >
            <Plus className="h-9 w-9" strokeWidth={1.75} />
            <span className="mt-5 text-xl font-medium text-zinc-300">New Deck</span>
          </button>

          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} onEdit={setEditingDeck} />
          ))}
        </section>

        {decks.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500">No decks yet. Create one to get started.</p>
        ) : null}
      </main>

      {isCreateOpen ? (
        <CreateDeckModal
          deckName={deckName}
          onDeckNameChange={setDeckName}
          onClose={closeModal}
          onSubmit={handleCreateDeck}
        />
      ) : null}

        {editingDeck ? (
          <DeckActionsModal
            deck={editingDeck}
          isOpen={true}
          onClose={closeEditModal}
          onRename={handleRenameDeck}
          onDelete={handleDeleteDeck}
          onExport={handleExportDeck}
        />
      ) : null}

      <LegacyImportModal
        isOpen={isLegacyImportOpen}
        isImporting={isImportingLegacyDecks}
        deckCount={legacyDecks.length}
        errorMessage={legacyImportError}
        onClose={closeLegacyImportModal}
        onImport={() => void handleImportLegacyDecks()}
        onDelete={handleDeleteLegacyDecks}
      />
    </>
  )
}
