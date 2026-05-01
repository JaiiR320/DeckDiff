import type { GameState, PlayerState } from "@deckdiff/schemas";
import { cardImageCacheKey } from "../cards/cardImages.js";
import type { CardImagesByName } from "../cards/useCardImages.js";
import type { DropTarget } from "../types.js";
import { useSimUiStore } from "../store.js";
import { isObjectRevealed, isPlayerZone, topCard, zoneObjects } from "../zones.js";
import { Card } from "../cards/Card.js";
import { HandZone } from "./HandZone.js";
import { PileZone } from "./PileZone.js";

const pileZones = ["library", "graveyard", "exile", "command"] as const;

export function ZoneTray({
  game,
  player,
  actorPlayerId,
  cardImagesByName,
  onCardsRectChange,
  onToggleTapped,
}: {
  game: GameState;
  player: PlayerState;
  actorPlayerId: string;
  cardImagesByName: CardImagesByName;
  onCardsRectChange: (rect: DOMRectReadOnly | null) => void;
  onToggleTapped: (objectId?: string) => void;
}) {
  const handPreview = useSimUiStore((state) => state.handPreview);
  const dragObjectIds = useSimUiStore((state) => state.dragObjectIds);
  const dragObjectIdSet = new Set(dragObjectIds);
  const visibleHandObjects = player.zones.hand.objects.filter(
    (object) => !dragObjectIdSet.has(object.objectId),
  );

  return (
    <aside className="zone-tray">
      <HandZone
        target={{ zone: "hand", playerId: player.id }}
        count={player.zones.hand.objects.length}
        cardObjectIds={visibleHandObjects.map((object) => object.objectId)}
        previewInsertIndex={
          handPreview?.playerId === actorPlayerId ? handPreview.insertIndex : null
        }
        onCardsRectChange={onCardsRectChange}
      >
        {visibleHandObjects.map((object) => (
          <Card
            key={object.objectId}
            object={object}
            image={cardImagesByName[cardImageCacheKey(object.name)]}
            isSelectable={false}
            onToggleTapped={onToggleTapped}
          />
        ))}
      </HandZone>

      {pileZones.map((zone) => {
        const target: DropTarget = isPlayerZone(zone) ? { zone, playerId: player.id } : { zone };
        const objects = zoneObjects(game, target).filter(
          (object) => !dragObjectIdSet.has(object.objectId),
        );
        const topObject = topCard(objects);

        return (
          <PileZone key={zone} target={target} label={zone} count={objects.length}>
            {topObject ? (
              <Card
                key={topObject.objectId}
                object={topObject}
                image={cardImagesByName[cardImageCacheKey(topObject.name)]}
                isFaceDown={zone === "library" && !isObjectRevealed(topObject, actorPlayerId)}
                onToggleTapped={onToggleTapped}
              />
            ) : null}
          </PileZone>
        );
      })}
    </aside>
  );
}
