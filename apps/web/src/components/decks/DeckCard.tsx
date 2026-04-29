import { Link } from "@tanstack/react-router";
import { Layers, MoreVertical } from "lucide-react";
import type { DeckItem } from "../../lib/deck";

type DeckCardProps = {
  deck: DeckItem;
  onEdit: (deck: DeckItem) => void;
};

export function DeckCard({ deck, onEdit }: DeckCardProps) {
  return (
    <div className="group relative flex min-h-48 flex-col rounded-2xl border border-zinc-800 bg-zinc-950 px-7 py-6 text-left shadow-[0_24px_60px_rgba(0,0,0,0.25)] transition hover:border-zinc-700">
      {/* Content - sits below the Link */}
      <div className="pointer-events-none">
        <Layers className="h-8 w-8 text-cyan-300" strokeWidth={1.75} />
      </div>

      <div className="pointer-events-none mt-8">
        <span className="text-3xl font-semibold tracking-tight text-zinc-100">{deck.name}</span>
        <p className="mt-2 text-lg text-zinc-500">
          {deck.saves.length} save{deck.saves.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Link covers the whole card but allows clicks to pass through to interactive children via pointer-events */}
      <Link
        to="/decks/$deckId"
        params={{ deckId: deck.id }}
        className="absolute inset-0 rounded-2xl"
        aria-label={`Open ${deck.name}`}
      />

      {/* Edit button - positioned outside content, after Link in DOM so it's on top */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit(deck);
        }}
        aria-label={`Edit ${deck.name}`}
        className="absolute right-6 top-6 cursor-pointer rounded-lg p-2 text-zinc-500 opacity-0 transition hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
      >
        <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
