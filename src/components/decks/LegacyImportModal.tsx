import { X } from 'lucide-react'

type LegacyImportModalProps = {
  isOpen: boolean
  isImporting: boolean
  deckCount: number
  errorMessage: string | null
  onClose: () => void
  onImport: () => void
  onDelete: () => void
}

export function LegacyImportModal({
  isOpen,
  isImporting,
  deckCount,
  errorMessage,
  onClose,
  onImport,
  onDelete,
}: LegacyImportModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <button type="button" aria-label="Close import modal" className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
        <button
          type="button"
          aria-label="Close import modal"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-xl font-semibold text-zinc-100">Import local decks?</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          We found {deckCount} deck{deckCount === 1 ? '' : 's'} saved in this browser. Importing will add them
          to your account and delete the old local browser storage after the import finishes.
        </p>
        <p className="mt-3 text-sm leading-6 text-amber-300">
          Warning: deleting local decks is permanent. If import fails, nothing will be imported and your local decks
          will stay in this browser so you can export them manually.
        </p>

        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-rose-900/60 px-4 py-2 text-sm font-medium text-rose-300 transition hover:border-rose-800 hover:bg-rose-950/30"
          >
            Delete local decks
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={isImporting}
            className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting ? 'Importing...' : 'Import decks'}
          </button>
        </div>
      </div>
    </div>
  )
}
