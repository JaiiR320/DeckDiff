import { Link } from "@tanstack/react-router";
import { Layers, MoreVertical } from "lucide-react";
import { IconButton } from "#/components/ui/IconButton";
import type { DeckItem, DeckTileCover, DeckTileCoverCard } from "../../lib/deck";
import { getImageCropStyle } from "../../lib/imageCrop";

type DeckCardProps = {
  deck: DeckItem;
  onEdit: (deck: DeckItem) => void;
};

export function DeckCard({ deck, onEdit }: DeckCardProps) {
  const editButton = (
    <IconButton
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onEdit(deck);
      }}
      aria-label={`Edit ${deck.name}`}
      variant="ghost"
      className="absolute right-6 top-6 z-20 cursor-pointer p-2 opacity-0 group-hover:opacity-100"
    >
      <MoreVertical className="size-5" strokeWidth={1.75} />
    </IconButton>
  );

  if (deck.cover) {
    return (
      <div className="group relative flex aspect-[3/2] min-h-48 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-left transition hover:border-zinc-700 sm:min-h-0">
        <CoverImage cover={deck.cover} />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/85 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 to-transparent" />
        <div className="pointer-events-none relative z-10 flex h-full flex-col justify-between px-7 py-6 pr-16">
          <div className="flex items-center gap-3">
            <Layers className="size-8 shrink-0 text-cyan-300 drop-shadow-lg" strokeWidth={1.75} />
            <span className="text-3xl font-semibold tracking-tight text-zinc-100 drop-shadow-lg">
              {deck.name}
            </span>
          </div>
          <p className="mt-2 text-lg text-zinc-300 drop-shadow-lg">
            {deck.saves.length} snapshot{deck.saves.length === 1 ? "" : "s"}
          </p>
        </div>

        <Link
          to="/decks/$deckId"
          params={{ deckId: deck.id }}
          className="absolute inset-0 z-10 rounded-2xl"
          aria-label={`Open ${deck.name}`}
        />

        <IconButton
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(deck);
          }}
          aria-label={`Edit ${deck.name}`}
          variant="ghost"
          className="absolute right-6 top-6 z-20 cursor-pointer bg-black/35 p-2 text-zinc-100 backdrop-blur-sm hover:bg-black/50"
        >
          <MoreVertical className="size-5" strokeWidth={1.75} />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="group relative flex aspect-[3/2] min-h-48 flex-col rounded-2xl border border-zinc-800 bg-zinc-950 px-7 py-6 text-left transition hover:border-zinc-700 sm:min-h-0">
      <div className="pointer-events-none flex items-center gap-3 pr-10">
        <Layers className="size-8 shrink-0 text-cyan-300" strokeWidth={1.75} />
        <span className="text-3xl font-semibold tracking-tight text-zinc-100">{deck.name}</span>
      </div>

      <div className="pointer-events-none mt-auto">
        <p className="mt-2 text-lg text-zinc-500">
          {deck.saves.length} snapshot{deck.saves.length === 1 ? "" : "s"}
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
      {editButton}
    </div>
  );
}

function CoverImage({ cover }: { cover: DeckTileCover }) {
  if (cover.kind === "split") {
    const leftCard = cover.reversed ? cover.cards[1] : cover.cards[0];
    const rightCard = cover.reversed ? cover.cards[0] : cover.cards[1];

    return (
      <div className="absolute inset-0 opacity-85">
        <div className="absolute inset-0 overflow-hidden [clip-path:polygon(0_0,57%_0,43%_100%,0_100%)]">
          <img
            src={leftCard.imageUrl}
            alt={leftCard.name}
            className={
              leftCard.crop
                ? "object-fill"
                : "absolute left-[-31%] top-[-40%] h-auto w-[142%] max-w-none"
            }
            style={leftCard.crop ? getImageCropStyle(leftCard.crop) : undefined}
            loading="lazy"
          />
        </div>
        <div className="absolute inset-0 overflow-hidden [clip-path:polygon(57%_0,100%_0,100%_100%,43%_100%)]">
          <img
            src={rightCard.imageUrl}
            alt={rightCard.name}
            className={
              rightCard.crop
                ? "object-fill"
                : "absolute right-[-31%] top-[-40%] h-auto w-[142%] max-w-none"
            }
            style={rightCard.crop ? getImageCropStyle(rightCard.crop) : undefined}
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  return <SingleCoverImage cover={cover} />;
}

function SingleCoverImage({ cover }: { cover: DeckTileCoverCard }) {
  return (
    <img
      src={cover.imageUrl}
      alt={cover.name}
      className={
        cover.crop
          ? "object-fill opacity-85"
          : "absolute left-[-21%] top-[-40%] h-auto w-[142%] max-w-none opacity-85"
      }
      style={cover.crop ? getImageCropStyle(cover.crop) : undefined}
      loading="lazy"
    />
  );
}
