import type { PointerEvent } from "react";
import type { GameObject } from "@deckdiff/schemas";
import { cardImageCacheKey } from "../cards/cardImages.js";
import type { CardImagesByName } from "../cards/useCardImages.js";
import type { CardPosition, PositionMap, SelectionBox } from "../types.js";
import { useSimUiStore } from "../store.js";
import { BattlefieldCard } from "./BattlefieldCard.js";
import { DropZone } from "../drag/DropZone.js";
import { SelectionMarquee } from "../selection/SelectionMarquee.js";

type PointerHandlers = {
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
};

export function BattlefieldZone({
  objects,
  positions,
  zIndexByObjectId,
  selectionBox,
  pointerHandlers,
  cardImagesByName,
  onToggleTapped,
}: {
  objects: GameObject[];
  positions: PositionMap;
  zIndexByObjectId: Map<string, number>;
  selectionBox: SelectionBox | null;
  pointerHandlers: PointerHandlers;
  cardImagesByName: CardImagesByName;
  onToggleTapped: (objectId?: string) => void;
}) {
  const dragObjectIds = useSimUiStore((state) => state.dragObjectIds);
  const dragObjectIdSet = new Set(dragObjectIds);

  return (
    <DropZone target={{ zone: "battlefield" }} className="battlefield" {...pointerHandlers}>
      {selectionBox ? <SelectionMarquee box={selectionBox} /> : null}
      {objects
        .filter((object) => !dragObjectIdSet.has(object.objectId))
        .map((object) => (
          <BattlefieldCard
            key={object.objectId}
            object={object}
            image={cardImagesByName[cardImageCacheKey(object.name)]}
            position={positions[object.objectId] ?? ({ x: 24, y: 24 } satisfies CardPosition)}
            zIndex={zIndexByObjectId.get(object.objectId) ?? 1}
            onToggleTapped={onToggleTapped}
          />
        ))}
    </DropZone>
  );
}
