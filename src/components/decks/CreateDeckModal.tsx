import type { FormEvent } from 'react'

type CreateDeckModalProps = {
  deckName: string
  onDeckNameChange: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function CreateDeckModal({
  deckName,
  onDeckNameChange,
  onClose,
  onSubmit,
}: CreateDeckModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <button type="button" aria-label="Close create deck modal" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
        <h1 className="text-xl font-semibold text-zinc-100">New Deck</h1>
        <form className="mt-5" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-zinc-400" htmlFor="deck-name">
            Deck name
          </label>
          <input
            id="deck-name"
            autoFocus
            value={deckName}
            onChange={(event) => onDeckNameChange(event.target.value)}
            placeholder="Enter a deck name"
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
          />
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
