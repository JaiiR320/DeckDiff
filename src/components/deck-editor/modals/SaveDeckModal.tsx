import type { FormEvent } from 'react'
import { useState } from 'react'

type SaveDeckModalProps = {
  defaultLabel: string
  isOpen: boolean
  onClose: () => void
  onSave: (label: string) => void
}

export function SaveDeckModal({ defaultLabel, isOpen, onClose, onSave }: SaveDeckModalProps) {
  const [label, setLabel] = useState(defaultLabel)

  if (!isOpen) return null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = label.trim()
    onSave(trimmed || defaultLabel)
  }

  function handleClose() {
    setLabel(defaultLabel)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <button
        type="button"
        aria-label="Close save deck modal"
        className="absolute inset-0"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
        <h2 className="text-xl font-semibold text-zinc-100">Save Deck</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Create a snapshot of your current deck state.
        </p>

        <form className="mt-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-zinc-400" htmlFor="save-label">
            Save label (optional)
          </label>
          <input
            id="save-label"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={defaultLabel}
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
          />

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
