import type { FormEvent } from "react";
import { X } from "lucide-react";

type ImportDeckModalProps = {
  hasCards: boolean;
  draftDeck: string;
  onDraftDeckChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOverride?: () => void;
};

export function ImportDeckModal({
  hasCards,
  draftDeck,
  onDraftDeckChange,
  onClose,
  onSubmit,
  onOverride,
}: ImportDeckModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <button
        type="button"
        aria-label="Close import modal"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Import Deck</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {hasCards
                ? "Bulk add to your deck, or override it with the pasted list."
                : "Paste the baseline deck list."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="mt-5" onSubmit={onSubmit}>
          <textarea
            autoFocus
            spellCheck={false}
            value={draftDeck}
            onChange={(event) => onDraftDeckChange(event.target.value)}
            placeholder="Paste a deck list here"
            className="min-h-80 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
          />

          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              Cancel
            </button>
            {hasCards ? (
              <>
                <button
                  type="button"
                  onClick={onOverride}
                  disabled={!draftDeck.trim()}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Override
                </button>
                <button
                  type="submit"
                  disabled={!draftDeck.trim()}
                  className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Bulk Add
                </button>
              </>
            ) : (
              <button
                type="submit"
                disabled={!draftDeck.trim()}
                className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Validate Import
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
