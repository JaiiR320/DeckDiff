import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { DeckActionsModal } from '../components/decks/DeckActionsModal'
import { CreateDeckModal } from '../components/decks/CreateDeckModal'
import { DeckCard } from '../components/decks/DeckCard'
import { createDeck, slugifyName, type DeckItem } from '../lib/deck'
import { formatDeckExport } from '../lib/decklist'
import { deleteDeck, loadDecks, upsertDeck } from '../lib/storage'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const [decks, setDecks] = useState<DeckItem[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [editingDeck, setEditingDeck] = useState<DeckItem | null>(null)

  // Load decks from storage on mount
  useEffect(() => {
    setDecks(loadDecks())
  }, [])

  function closeModal() {
    setIsCreateOpen(false)
    setDeckName('')
  }

  function closeEditModal() {
    setEditingDeck(null)
  }

  function handleCreateDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = deckName.trim()
    if (!name) {
      return
    }

    const newDeck = createDeck(name)
    upsertDeck(newDeck)
    setDecks((currentDecks) => [...currentDecks, newDeck])
    closeModal()
  }

  function handleRenameDeck(deckId: string, newName: string) {
    const deck = decks.find((d) => d.id === deckId)
    if (!deck) return

    const newId = slugifyName(newName)
    const updatedDeck: DeckItem = {
      ...deck,
      id: newId,
      name: newName,
      updatedAt: new Date().toISOString(),
    }

    // Delete old deck and save new one
    deleteDeck(deckId)
    upsertDeck(updatedDeck)

    setDecks((currentDecks) =>
      currentDecks.map((d) => (d.id === deckId ? updatedDeck : d))
    )
  }

  function handleDeleteDeck(deckId: string) {
    deleteDeck(deckId)
    setDecks((currentDecks) => currentDecks.filter((d) => d.id !== deckId))
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
    </>
  )
}
