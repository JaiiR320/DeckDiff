import { Download, Pencil, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import type { DeckItem } from "../../lib/deck";

type DeckActionsModalProps = {
  deck: DeckItem;
  isOpen: boolean;
  onClose: () => void;
  onRename: (deckId: string, newName: string) => void;
  onDelete: (deckId: string) => void;
  onExport: (deck: DeckItem) => void;
};

export function DeckActionsModal({
  deck,
  isOpen,
  onClose,
  onRename,
  onDelete,
  onExport,
}: DeckActionsModalProps) {
  const [newName, setNewName] = useState(deck.name);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen) return null;

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (trimmed && trimmed !== deck.name) {
      onRename(deck.id, trimmed);
    }
    setIsEditing(false);
  }

  function handleDelete() {
    onDelete(deck.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <button
        type="button"
        aria-label="Close deck actions modal"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
        <h2 className="text-xl font-semibold text-zinc-100">{deck.name}</h2>

        <div className="mt-5 space-y-2">
          {/* Rename Section */}
          {isEditing ? (
            <form onSubmit={handleRenameSubmit} className="space-y-3">
              <label className="block text-sm font-medium text-zinc-400" htmlFor="deck-rename">
                New name
              </label>
              <input
                id="deck-rename"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter a new name"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setNewName(deck.name);
                  }}
                  className="flex-1 rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 px-4 py-3 text-left text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              <Pencil className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
              <span>Rename deck</span>
            </button>
          )}

          {/* Export Button */}
          <button
            type="button"
            onClick={() => onExport(deck)}
            className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 px-4 py-3 text-left text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <Download className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
            <span>Export deck list</span>
          </button>

          {/* Delete Section */}
          {showDeleteConfirm ? (
            <div className="space-y-3 rounded-xl border border-rose-900/50 bg-rose-950/20 p-4">
              <p className="text-sm text-rose-300">
                Are you sure? This will delete the deck and all {deck.saves.length} save
                {deck.saves.length === 1 ? "" : "s"}.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 px-4 py-3 text-left text-rose-400 transition hover:border-rose-900/50 hover:bg-rose-950/20"
            >
              <Trash2 className="h-5 w-5" strokeWidth={1.75} />
              <span>Delete deck</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          Close
        </button>
      </div>
    </div>
  );
}
