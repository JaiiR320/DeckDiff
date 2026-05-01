import { Feedback } from "@dnd-kit/dom";
import { DragDropProvider, type DragEndEvent, type DragMoveEvent } from "@dnd-kit/react";
import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { GameState, PlayerState } from "@deckdiff/schemas";
import type { CardImagesByName } from "./cards/useCardImages.js";
import {
  canMoveObjectToTarget,
  moveObjects,
  reorderZoneBefore,
  reorderZoneToIndex,
} from "./game.js";
import { snapPosition } from "./battlefield/geometry.js";
import {
  effectiveDropTargetId,
  getDragObjectIds,
  resolveDragEndAction,
  resolveHandPreview,
} from "./drag/dragRouting.js";
import { stackOrderedIds, useBattlefieldLayout } from "./battlefield/useBattlefieldLayout.js";
import { useSelectionMarquee } from "./selection/useSelectionMarquee.js";
import type { CardPosition, DropTarget } from "./types.js";
import { useSimUiStore } from "./store.js";
import { BattlefieldZone } from "./battlefield/BattlefieldZone.js";
import { CardPreviewLayer } from "./cards/CardPreviewLayer.js";
import { DragPreviewLayer, type DragPreviewItem } from "./cards/DragPreviewLayer.js";
import { ZoneTray } from "./tray/ZoneTray.js";
import { findObjectLocation } from "./zones.js";

/** Reads the battlefield element bounds for drop math. */
function getBattlefieldRect(): DOMRect | undefined {
  return document.querySelector<HTMLElement>(".battlefield")?.getBoundingClientRect();
}

function dropPositionFromRects(
  sourceRect: DOMRect | undefined,
  targetRect: DOMRect | undefined,
): CardPosition {
  return sourceRect
    ? snapPosition({
        x: sourceRect.left - (targetRect?.left ?? 0),
        y: sourceRect.top - (targetRect?.top ?? 0),
      })
    : { x: 24, y: 24 };
}

function translatedRect(rect: DOMRect, delta: CardPosition): DOMRect {
  return new DOMRect(rect.x + delta.x, rect.y + delta.y, rect.width, rect.height);
}

function rectCenterIsInside(
  rect: DOMRect | DOMRectReadOnly | undefined,
  bounds: DOMRect | DOMRectReadOnly | undefined,
): boolean {
  if (!rect || !bounds) return false;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  return (
    centerX >= bounds.left &&
    centerX <= bounds.right &&
    centerY >= bounds.top &&
    centerY <= bounds.bottom
  );
}

function elementIsInsideBattlefield(element: Element | undefined): boolean {
  return Boolean(element?.closest(".battlefield"));
}

function battlefieldDragPreviewItems({
  game,
  primaryObjectId,
  dragObjectIds,
  positions,
}: {
  game: GameState;
  primaryObjectId: string;
  dragObjectIds: string[];
  positions: Record<string, CardPosition | undefined>;
}): DragPreviewItem[] | null {
  const primaryFound = findObjectLocation(game, primaryObjectId);
  const primaryPosition = positions[primaryObjectId];
  if (primaryFound?.zone.zone !== "battlefield" || !primaryPosition) return null;

  return stackOrderedIds(Object.keys(positions), dragObjectIds).map((objectId) => {
    const position = positions[objectId] ?? primaryPosition;
    return {
      objectId,
      offset: {
        x: position.x - primaryPosition.x,
        y: position.y - primaryPosition.y,
      },
    };
  });
}

export function SimTable({
  game,
  setGame,
  actorPlayer,
  actorPlayerId,
  cardImagesByName,
  onToggleTapped,
}: {
  game: GameState;
  setGame: (game: GameState | ((currentGame: GameState) => GameState)) => void;
  actorPlayer: PlayerState;
  actorPlayerId: string;
  cardImagesByName: CardImagesByName;
  onToggleTapped: (objectId?: string) => void;
}) {
  const handCardsRectRef = useRef<DOMRectReadOnly | null>(null);
  const dragStartRectRef = useRef<DOMRect | null>(null);
  const [dragStartRect, setDragStartRect] = useState<DOMRect | null>(null);
  const [dragPreviewItems, setDragPreviewItems] = useState<DragPreviewItem[] | null>(null);
  const battlefieldObjects = game.zones.battlefield.objects;
  const layout = useBattlefieldLayout(battlefieldObjects);
  const { selectionBox, battlefieldPointerHandlers } = useSelectionMarquee({
    objects: battlefieldObjects,
    positions: layout.positions,
  });

  const handleHandCardsRectChange = useCallback((rect: DOMRectReadOnly | null) => {
    handCardsRectRef.current = rect;
  }, []);

  /** Moves a card or selected group within the battlefield. */
  function handleBattlefieldMove(objectId: string, delta: CardPosition) {
    const { dragObjectIds } = useSimUiStore.getState();
    const movedObjectIds = dragObjectIds.length > 0 ? dragObjectIds : [objectId];
    layout.moveBattlefieldObjects(movedObjectIds, delta);
    layout.bringObjectsToFront(movedObjectIds);
  }

  /** Reorders cards within a player's hand. */
  function handleHandReorder(objectId: string, targetObjectId: string, playerId: string) {
    const { dragObjectIds } = useSimUiStore.getState();
    const movedObjectIds = dragObjectIds.length > 0 ? dragObjectIds : [objectId];
    if (movedObjectIds.length === 0) return;

    setGame((currentGame) =>
      reorderZoneBefore(currentGame, { zone: "hand", playerId }, movedObjectIds, targetObjectId),
    );
  }

  /** Reorders cards within a player's hand using a preview insertion index. */
  function handleHandReorderToIndex(objectId: string, insertIndex: number, playerId: string) {
    const { dragObjectIds } = useSimUiStore.getState();
    const movedObjectIds = dragObjectIds.length > 0 ? dragObjectIds : [objectId];
    if (movedObjectIds.length === 0) return;

    setGame((currentGame) =>
      reorderZoneToIndex(currentGame, { zone: "hand", playerId }, movedObjectIds, insertIndex),
    );
  }

  /** Moves a card or selected group to a new zone. */
  function handleZoneMove(
    objectId: string,
    target: DropTarget,
    dropPosition: CardPosition,
    insertIndex?: number,
  ) {
    const { dragObjectIds, setHoveredObjectId, setSelectedObjectIds } = useSimUiStore.getState();
    const movedObjectIds = dragObjectIds.length > 0 ? dragObjectIds : [objectId];
    const legalMovedObjectIds = movedObjectIds.filter((movedObjectId) =>
      canMoveObjectToTarget(game, movedObjectId, target, actorPlayerId),
    );
    if (legalMovedObjectIds.length === 0) return;

    if (target.zone === "battlefield") {
      if (!layout.canPlaceOnBattlefield(dropPosition, legalMovedObjectIds.length)) return;
    }

    const nextGame = moveObjects(game, legalMovedObjectIds, target, actorPlayerId, insertIndex);

    setGame(nextGame);
    setSelectedObjectIds([]);
    setHoveredObjectId(null);

    if (target.zone !== "battlefield") {
      layout.removeObjects(legalMovedObjectIds);
      return;
    }

    layout.syncAfterBattlefieldEntry(
      legalMovedObjectIds,
      nextGame.zones.battlefield.objects,
      dropPosition,
    );
    layout.bringObjectsToFront(legalMovedObjectIds);
  }

  /** Clears transient drag state after drag completion. */
  function clearDragState() {
    dragStartRectRef.current = null;
    setDragStartRect(null);
    setDragPreviewItems(null);
    useSimUiStore.getState().clearDrag();
  }

  /** Routes a completed drag to move, reorder, or cancel behavior. */
  function handleDragEnd(event: DragEndEvent) {
    const sourceElement = event.operation.source?.element;
    const targetElement = event.operation.target?.element;
    const sourceRect = dragStartRectRef.current
      ? translatedRect(dragStartRectRef.current, event.operation.transform)
      : sourceElement?.getBoundingClientRect();
    const targetRect = targetElement?.getBoundingClientRect();
    const battlefieldRect = getBattlefieldRect();
    const battlefieldDropPosition = dropPositionFromRects(sourceRect, battlefieldRect);
    const zoneDropPosition = dropPositionFromRects(sourceRect, targetRect);
    const targetId = effectiveDropTargetId({
      game,
      targetId: event.operation.target?.id,
      sourceCenterInsideBattlefield: rectCenterIsInside(sourceRect, battlefieldRect),
      targetElementInsideBattlefield: elementIsInsideBattlefield(targetElement),
    });
    const action = resolveDragEndAction({
      game,
      actorPlayerId,
      objectId: event.operation.source?.id,
      canceled: event.canceled,
      targetId,
      delta: event.operation.transform,
      handPreview: useSimUiStore.getState().handPreview,
    });

    // Commit position/order updates before clearing the drag preview to avoid a one-frame snapback.
    flushSync(() => {
      switch (action.type) {
        case "battlefield-move":
          handleBattlefieldMove(action.objectId, action.delta);
          break;
        case "hand-reorder":
          handleHandReorder(action.objectId, action.targetObjectId, action.playerId);
          break;
        case "hand-reorder-to-index":
          handleHandReorderToIndex(action.objectId, action.insertIndex, action.playerId);
          break;
        case "zone-move":
          handleZoneMove(
            action.objectId,
            action.target,
            action.dropPosition === "battlefield" ? battlefieldDropPosition : zoneDropPosition,
            action.insertIndex,
          );
          break;
      }

      clearDragState();
    });
  }

  /** Tracks group drag offset while a selected card moves. */
  function handleDragMove(event: DragMoveEvent) {
    const objectId = event.operation.source?.id;
    if (typeof objectId !== "string") return;

    const { dragObjectIds, setDragOffset, setHandPreview } = useSimUiStore.getState();
    setDragOffset(event.operation.transform);

    const handRect = handCardsRectRef.current;
    const sourceRect = dragStartRectRef.current
      ? translatedRect(dragStartRectRef.current, event.operation.transform)
      : event.operation.source?.element?.getBoundingClientRect();
    const nextHandPreview = resolveHandPreview({
      game,
      objectId,
      targetId: event.operation.target?.id,
      actorPlayerId,
      dragObjectIds,
      handRect,
      sourceRect,
    });
    if (nextHandPreview || (handRect && !rectCenterIsInside(sourceRect, handRect))) {
      setHandPreview(nextHandPreview);
    }
  }

  return (
    <DragDropProvider
      plugins={(plugins) => [
        ...plugins.filter((plugin) => plugin !== Feedback),
        Feedback.configure({ dropAnimation: null }),
      ]}
      onDragStart={(event) => {
        const objectId = event.operation.source?.id;
        if (typeof objectId !== "string") return;
        const startRect = event.operation.source?.element?.getBoundingClientRect() ?? null;
        dragStartRectRef.current = startRect;
        setDragStartRect(startRect);
        const { selectedObjectIds } = useSimUiStore.getState();
        const dragObjectIds = getDragObjectIds({
          game,
          primaryObjectId: objectId,
          selectedObjectIds,
          actorPlayerId,
        });
        setDragPreviewItems(
          battlefieldDragPreviewItems({
            game,
            primaryObjectId: objectId,
            dragObjectIds,
            positions: layout.positions,
          }),
        );
        useSimUiStore.getState().startDrag(objectId, dragObjectIds);
      }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <main className="sim-table">
        <BattlefieldZone
          objects={battlefieldObjects}
          positions={layout.positions}
          zIndexByObjectId={layout.zIndexByObjectId}
          selectionBox={selectionBox}
          pointerHandlers={battlefieldPointerHandlers}
          cardImagesByName={cardImagesByName}
          onToggleTapped={onToggleTapped}
        />

        <ZoneTray
          game={game}
          player={actorPlayer}
          actorPlayerId={actorPlayerId}
          cardImagesByName={cardImagesByName}
          onCardsRectChange={handleHandCardsRectChange}
          onToggleTapped={onToggleTapped}
        />

        <CardPreviewLayer
          game={game}
          actorPlayerId={actorPlayerId}
          cardImagesByName={cardImagesByName}
        />

        <DragPreviewLayer
          game={game}
          actorPlayerId={actorPlayerId}
          cardImagesByName={cardImagesByName}
          startRect={dragStartRect}
          previewItems={dragPreviewItems}
        />
      </main>
    </DragDropProvider>
  );
}
