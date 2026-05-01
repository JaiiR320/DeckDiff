import type { GameState } from "@deckdiff/schemas";
import { useSimUiStore } from "../store.js";
import { canPreviewObject, findObjectLocation } from "../zones.js";
import { cardImageCacheKey } from "./cardImages.js";
import { CardPreviewPopup } from "./CardPreviewPopup.js";
import type { CardImagesByName } from "./useCardImages.js";

export function CardPreviewLayer({
  game,
  actorPlayerId,
  cardImagesByName,
}: {
  game: GameState;
  actorPlayerId: string;
  cardImagesByName: CardImagesByName;
}) {
  const isDragging = useSimUiStore((state) => state.primaryDragObjectId !== null);
  const hoveredObjectId = useSimUiStore((state) => state.hoveredObjectId);
  const hoverClientX = useSimUiStore((state) => state.hoverClientX);
  if (isDragging) return null;

  const hoveredLocation = hoveredObjectId ? findObjectLocation(game, hoveredObjectId) : null;
  const previewLocation =
    hoveredLocation && canPreviewObject(hoveredLocation, actorPlayerId) ? hoveredLocation : null;
  if (!previewLocation) return null;

  return (
    <CardPreviewPopup
      object={previewLocation.object}
      image={cardImagesByName[cardImageCacheKey(previewLocation.object.name)]}
      side={hoverClientX !== null && hoverClientX > window.innerWidth / 2 ? "left" : "right"}
    />
  );
}
