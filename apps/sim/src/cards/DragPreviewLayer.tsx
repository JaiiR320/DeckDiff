import type { CSSProperties } from "react";
import type { GameState } from "@deckdiff/schemas";
import { useSimUiStore } from "../store.js";
import { findObjectLocation, isObjectRevealed } from "../zones.js";
import { cardImageCacheKey } from "./cardImages.js";
import { CardVisual } from "./Card.js";
import type { CardImagesByName } from "./useCardImages.js";
import type { CardPosition } from "../types.js";

export type DragPreviewItem = {
  objectId: string;
  offset: CardPosition;
};

export function DragPreviewLayer({
  game,
  actorPlayerId,
  cardImagesByName,
  startRect,
  previewItems,
}: {
  game: GameState;
  actorPlayerId: string;
  cardImagesByName: CardImagesByName;
  startRect: DOMRect | null;
  previewItems: DragPreviewItem[] | null;
}) {
  const dragObjectIds = useSimUiStore((state) => state.dragObjectIds);
  const dragOffset = useSimUiStore((state) => state.dragOffset);
  if (!startRect || dragObjectIds.length === 0) return null;

  const items =
    previewItems ??
    dragObjectIds.map((objectId, index) => ({
      objectId,
      offset: { x: index * 12, y: index * 12 },
    }));

  return (
    <div
      className="drag-preview-layer"
      style={
        {
          left: startRect.left,
          top: startRect.top,
          transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`,
        } as CSSProperties
      }
    >
      {items.map((item) => {
        const found = findObjectLocation(game, item.objectId);
        if (!found) return null;
        const isFaceDown =
          found.zone.zone === "library" && !isObjectRevealed(found.object, actorPlayerId);

        return (
          <div
            key={item.objectId}
            className="drag-preview-card"
            style={{ transform: `translate(${item.offset.x}px, ${item.offset.y}px)` }}
          >
            <CardVisual
              object={found.object}
              image={cardImagesByName[cardImageCacheKey(found.object.name)]}
              isFaceDown={isFaceDown}
            />
          </div>
        );
      })}
    </div>
  );
}
