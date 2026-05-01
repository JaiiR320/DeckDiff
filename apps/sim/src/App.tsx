import { DragDropProvider, type DragEndEvent, type DragMoveEvent } from "@dnd-kit/react";
import { Feedback } from "@dnd-kit/dom";
import { createGame } from "@deckdiff/core";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@deckdiff/schemas";
import { BattlefieldCard } from "./components/BattlefieldCard.js";
import { Card } from "./components/Card.js";
import { CardPreviewPopup } from "./components/CardPreviewPopup.js";
import { DropZone } from "./components/DropZone.js";
import { HandZone, handCardCenter } from "./components/HandZone.js";
import { PileZone } from "./components/PileZone.js";
import { SelectionMarquee } from "./components/SelectionMarquee.js";
import type { CardPosition, DropTarget } from "./sim/types.js";
import { parseCardTargetId, parseDropTarget } from "./sim/targets.js";
import { snapPosition } from "./sim/geometry.js";
import {
  canPreviewObject,
  findObjectLocation,
  isLibraryTopObject,
  isObjectRevealed,
  isPlayerZone,
  sameTarget,
  topCard,
  zoneObjects,
} from "./sim/gameQueries.js";
import {
  actionObjectIds,
  canMoveObjectToTarget,
  moveObjects,
  reorderZoneBefore,
  reorderZoneToIndex,
  toggleFaceDown,
  toggleFlipped,
  toggleRevealedToAll,
  toggleTapped,
} from "./sim/actions.js";
import { cardImageCacheKey, getCardImage, type SimCardImage } from "./sim/cardImages.js";
import { useBattlefieldLayout } from "./hooks/useBattlefieldLayout.js";
import { useSelectionMarquee } from "./hooks/useSelectionMarquee.js";
import { useSimUiStore } from "./simUiStore.js";

const pileZones = ["library", "graveyard", "exile", "command"] as const;

type CardImagesByName = Record<string, SimCardImage | null>;

function handInsertIndexFromClientX(clientX: number, handRect: DOMRectReadOnly, cardCount: number) {
  const localX = clientX - handRect.left;
  for (let index = 0; index < cardCount; index += 1) {
    if (localX < handCardCenter(index, cardCount, handRect.width)) return index;
  }

  return cardCount;
}

/** Creates the local seed game until server state exists. */
function createSeedGame(): GameState {
  return createGame({
    players: [
      {
        id: "p1",
        name: "Player",
        library: [
          "Brainstorm",
          "Ponder",
          "Counterspell",
          "Island",
          "Swords to Plowshares",
          "Mystic Remora",
          "Arcane Signet",
          "Malakir Rebirth",
          "Sol Ring",
          "Island",
          "Command Tower",
          "Llanowar Elves",
          "Lightning Greaves",
          "Rhystic Study",
        ],
        hand: ["Charred Foyer // Warped Space"],
        battlefield: [],
        graveyard: [],
        exile: [],
        command: [],
      },
    ],
  });
}

/** Reads the battlefield element bounds for drop math. */
function getBattlefieldRect(): DOMRect | undefined {
  return document.querySelector<HTMLElement>(".battlefield")?.getBoundingClientRect();
}

function gameCardNames(game: GameState) {
  return [
    ...game.players.flatMap((player) => [
      ...player.zones.library.objects,
      ...player.zones.hand.objects,
      ...player.zones.graveyard.objects,
    ]),
    ...game.zones.battlefield.objects,
    ...game.zones.stack.objects,
    ...game.zones.exile.objects,
    ...game.zones.command.objects,
  ].map((object) => object.name);
}

export function App() {
  const [game, setGame] = useState(createSeedGame);
  const [cardImagesByName, setCardImagesByName] = useState<CardImagesByName>({});
  const handCardsRectRef = useRef<DOMRectReadOnly | null>(null);
  const player = game.players[0]!;
  const battlefieldObjects = game.zones.battlefield.objects;
  const hoveredObjectId = useSimUiStore((state) => state.hoveredObjectId);
  const hoverClientX = useSimUiStore((state) => state.hoverClientX);
  const selectedObjectIds = useSimUiStore((state) => state.selectedObjectIds);
  const handPreview = useSimUiStore((state) => state.handPreview);
  const hoveredLocation = hoveredObjectId ? findObjectLocation(game, hoveredObjectId) : null;
  const previewLocation =
    hoveredLocation && canPreviewObject(hoveredLocation, player.id) ? hoveredLocation : null;
  const previewSide =
    hoverClientX !== null && hoverClientX > window.innerWidth / 2 ? "left" : "right";
  const layout = useBattlefieldLayout(battlefieldObjects);
  const { selectionBox, battlefieldPointerHandlers } = useSelectionMarquee({
    objects: battlefieldObjects,
    positions: layout.positions,
  });
  const handleHandCardsRectChange = useCallback((rect: DOMRectReadOnly | null) => {
    handCardsRectRef.current = rect;
  }, []);
  const previewMovedHandObjectIds =
    handPreview?.playerId === player.id &&
    player.zones.hand.objects.some((object) => object.objectId === handPreview.draggedObjectId)
      ? selectedObjectIds.includes(handPreview.draggedObjectId)
        ? selectedObjectIds
        : [handPreview.draggedObjectId]
      : [];

  useEffect(() => {
    const uniqueNames = [...new Set(gameCardNames(game))];
    const missingNames = uniqueNames.filter(
      (name) => !Object.hasOwn(cardImagesByName, cardImageCacheKey(name)),
    );
    if (missingNames.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missingNames.map(
        async (name) => [cardImageCacheKey(name), await getCardImage(name)] as const,
      ),
    ).then((entries) => {
      if (cancelled) return;
      setCardImagesByName((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });

    return () => {
      cancelled = true;
    };
  }, [cardImagesByName, game]);

  /** Toggles tapped for the current action cards. */
  const toggleActionCardsTapped = useCallback((fallbackObjectId?: string) => {
    const { selectedObjectIds, hoveredObjectId } = useSimUiStore.getState();
    const objectIds = actionObjectIds({
      selectedObjectIds,
      hoveredObjectId,
      fallbackObjectId,
    });

    setGame((currentGame) => toggleTapped(currentGame, objectIds));
  }, []);

  /** Toggles face-down state for the current action cards. */
  const toggleActionCardsFaceDown = useCallback((fallbackObjectId?: string) => {
    const { selectedObjectIds, hoveredObjectId } = useSimUiStore.getState();
    const objectIds = actionObjectIds({
      selectedObjectIds,
      hoveredObjectId,
      fallbackObjectId,
    });

    setGame((currentGame) => toggleFaceDown(currentGame, objectIds));
  }, []);

  /** Toggles alternate printed face for current double-faced action cards. */
  const toggleActionCardsAlternateFace = useCallback(
    (fallbackObjectId?: string) => {
      const { selectedObjectIds, hoveredObjectId } = useSimUiStore.getState();
      const objectIds = actionObjectIds({
        selectedObjectIds,
        hoveredObjectId,
        fallbackObjectId,
      });

      setGame((currentGame) => {
        const doubleFacedObjectIds = objectIds.filter((objectId) => {
          const found = findObjectLocation(currentGame, objectId);
          if (!found) return false;
          return cardImagesByName[cardImageCacheKey(found.object.name)]?.hasAlternateFace ?? false;
        });

        return toggleFlipped(currentGame, doubleFacedObjectIds);
      });
    },
    [cardImagesByName],
  );

  useHotkey(
    "T",
    () => {
      if (useSimUiStore.getState().draggedObjectId !== null) return;
      toggleActionCardsTapped();
    },
    { preventDefault: true },
  );

  useHotkey(
    "F",
    () => {
      if (useSimUiStore.getState().draggedObjectId !== null) return;
      const hoveredObjectId = useSimUiStore.getState().hoveredObjectId;
      if (hoveredObjectId && isLibraryTopObject(game, hoveredObjectId)) {
        setGame((currentGame) => toggleRevealedToAll(currentGame, hoveredObjectId));
        return;
      }

      toggleActionCardsFaceDown();
    },
    { preventDefault: true },
  );

  useHotkey(
    "Z",
    () => {
      if (useSimUiStore.getState().draggedObjectId !== null) return;
      toggleActionCardsAlternateFace();
    },
    { preventDefault: true },
  );

  /** Moves a card or selected group within the battlefield. */
  function handleBattlefieldMove(objectId: string, delta: CardPosition) {
    const { selectedObjectIds } = useSimUiStore.getState();
    const movedObjectIds = selectedObjectIds.includes(objectId) ? selectedObjectIds : [objectId];
    layout.moveBattlefieldObjects(movedObjectIds, delta);
  }

  /** Reorders cards within a player's hand. */
  function handleHandReorder(objectId: string, targetObjectId: string, playerId: string) {
    const { selectedObjectIds } = useSimUiStore.getState();
    const handObjectIds = player.zones.hand.objects.map((object) => object.objectId);
    const movedObjectIds = selectedObjectIds.includes(objectId)
      ? selectedObjectIds.filter((selectedObjectId) => handObjectIds.includes(selectedObjectId))
      : [objectId];
    if (movedObjectIds.length === 0) return;

    setGame((currentGame) =>
      reorderZoneBefore(currentGame, { zone: "hand", playerId }, movedObjectIds, targetObjectId),
    );
  }

  /** Reorders cards within a player's hand using a preview insertion index. */
  function handleHandReorderToIndex(objectId: string, insertIndex: number, playerId: string) {
    const { selectedObjectIds } = useSimUiStore.getState();
    const handObjectIds = player.zones.hand.objects.map((object) => object.objectId);
    const movedObjectIds = selectedObjectIds.includes(objectId)
      ? selectedObjectIds.filter((selectedObjectId) => handObjectIds.includes(selectedObjectId))
      : [objectId];
    if (movedObjectIds.length === 0) return;

    setGame((currentGame) =>
      reorderZoneToIndex(currentGame, { zone: "hand", playerId }, movedObjectIds, insertIndex),
    );
  }

  function handTargetFromDndTarget(targetId: unknown): DropTarget | null {
    const targetObjectId = parseCardTargetId(targetId);
    if (targetObjectId) {
      const targetFound = findObjectLocation(game, targetObjectId);
      if (targetFound?.zone.zone === "hand" && targetFound.zone.playerId) return targetFound.zone;
      return null;
    }

    const target = parseDropTarget(targetId, player.id);
    return target?.zone === "hand" && target.playerId ? target : null;
  }

  /** Moves a card or selected group to a new zone. */
  function handleZoneMove(
    objectId: string,
    target: DropTarget,
    dropPosition: CardPosition,
    insertIndex?: number,
  ) {
    const { selectedObjectIds, setHoveredObjectId, setSelectedObjectIds } =
      useSimUiStore.getState();
    const movedObjectIds = selectedObjectIds.includes(objectId) ? selectedObjectIds : [objectId];
    const legalMovedObjectIds = movedObjectIds.filter((movedObjectId) =>
      canMoveObjectToTarget(game, movedObjectId, target, player.id),
    );
    if (legalMovedObjectIds.length === 0) return;

    if (target.zone === "battlefield") {
      if (!layout.canPlaceOnBattlefield(dropPosition, legalMovedObjectIds.length)) return;
    }

    const nextGame = moveObjects(game, legalMovedObjectIds, target, player.id, insertIndex);

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
  }

  /** Routes a completed drag to move, reorder, or cancel behavior. */
  function handleDragEnd(event: DragEndEvent) {
    const objectId = event.operation.source?.id;
    if (event.canceled || typeof objectId !== "string") {
      clearDragState();
      return;
    }

    const found = findObjectLocation(game, objectId);
    if (!found) {
      clearDragState();
      return;
    }

    const { x, y } = event.operation.transform;
    const sourceElement = event.operation.source?.element;
    const targetElement = event.operation.target?.element;
    const sourceRect = sourceElement?.getBoundingClientRect();
    const targetRect = targetElement?.getBoundingClientRect();
    const battlefieldRect = getBattlefieldRect();
    const battlefieldDropPosition = sourceRect
      ? snapPosition({
          x: sourceRect.left - (battlefieldRect?.left ?? 0),
          y: sourceRect.top - (battlefieldRect?.top ?? 0),
        })
      : { x: 24, y: 24 };
    const zoneDropPosition = sourceRect
      ? snapPosition({
          x: sourceRect.left - (targetRect?.left ?? 0),
          y: sourceRect.top - (targetRect?.top ?? 0),
        })
      : { x: 24, y: 24 };
    const targetHand = handTargetFromDndTarget(event.operation.target?.id);
    const handPreview = useSimUiStore.getState().handPreview;
    const targetHandPlayerId = targetHand?.playerId;
    if (
      targetHand &&
      targetHandPlayerId &&
      handPreview?.draggedObjectId === objectId &&
      handPreview.playerId === targetHandPlayerId
    ) {
      if (found.zone.zone === "hand" && found.zone.playerId === targetHandPlayerId) {
        handleHandReorderToIndex(objectId, handPreview.insertIndex, targetHandPlayerId);
      } else {
        handleZoneMove(
          objectId,
          { zone: "hand", playerId: targetHandPlayerId },
          battlefieldDropPosition,
          handPreview.insertIndex,
        );
      }
      clearDragState();
      return;
    }

    const targetObjectId = parseCardTargetId(event.operation.target?.id);

    if (targetObjectId) {
      const targetFound = findObjectLocation(game, targetObjectId);
      if (targetFound?.zone.zone === "hand" && targetFound.zone.playerId) {
        const targetIndex = player.zones.hand.objects.findIndex(
          (object) => object.objectId === targetObjectId,
        );
        if (found.zone.zone === "hand" && found.zone.playerId === targetFound.zone.playerId) {
          handleHandReorder(objectId, targetObjectId, targetFound.zone.playerId);
        } else {
          handleZoneMove(
            objectId,
            { zone: "hand", playerId: targetFound.zone.playerId },
            battlefieldDropPosition,
            Math.max(0, targetIndex),
          );
        }
        clearDragState();
        return;
      }

      if (targetFound?.zone.zone === "battlefield") {
        if (found.zone.zone === "battlefield") handleBattlefieldMove(objectId, { x, y });
        else handleZoneMove(objectId, { zone: "battlefield" }, battlefieldDropPosition);
        clearDragState();
        return;
      }
    }

    const target = parseDropTarget(event.operation.target?.id, player.id);

    if (!target) {
      if (found.zone.zone === "battlefield") handleBattlefieldMove(objectId, { x, y });
      clearDragState();
      return;
    }

    if (sameTarget(found.zone, target)) {
      if (target.zone === "battlefield") handleBattlefieldMove(objectId, { x, y });
      clearDragState();
      return;
    }

    handleZoneMove(objectId, target, zoneDropPosition);
    clearDragState();
  }

  /** Clears transient drag state after drag completion. */
  function clearDragState() {
    useSimUiStore.getState().clearDrag();
  }

  /** Tracks group drag offset while a selected card moves. */
  function handleDragMove(event: DragMoveEvent) {
    const objectId = event.operation.source?.id;
    if (typeof objectId !== "string") return;

    const { selectedObjectIds, setDragOffset, setHandPreview } = useSimUiStore.getState();
    if (selectedObjectIds.length >= 2 && selectedObjectIds.includes(objectId)) {
      setDragOffset(event.operation.transform);
    }

    const targetHand = handTargetFromDndTarget(event.operation.target?.id);
    const targetHandPlayerId = targetHand?.playerId;
    const handRect = handCardsRectRef.current;
    const sourceRect = event.operation.source?.element?.getBoundingClientRect();
    if (!targetHand || !targetHandPlayerId || !handRect || !sourceRect) {
      setHandPreview(null);
      return;
    }

    const found = findObjectLocation(game, objectId);
    const targetHandObjects =
      targetHandPlayerId === player.id ? player.zones.hand.objects : zoneObjects(game, targetHand);
    const movedObjectIds = selectedObjectIds.includes(objectId) ? selectedObjectIds : [objectId];
    const movedObjectIdSet = new Set(
      found?.zone.zone === "hand" && found.zone.playerId === targetHandPlayerId
        ? movedObjectIds
        : [],
    );
    const previewCardCount = targetHandObjects.filter(
      (object) => !movedObjectIdSet.has(object.objectId),
    ).length;
    const insertIndex = handInsertIndexFromClientX(
      sourceRect.left + sourceRect.width / 2,
      handRect,
      previewCardCount,
    );

    setHandPreview({ playerId: targetHandPlayerId, draggedObjectId: objectId, insertIndex });
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
        useSimUiStore.getState().startDrag(objectId);
      }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <main className="sim-table">
        <DropZone
          target={{ zone: "battlefield" }}
          className="battlefield"
          {...battlefieldPointerHandlers}
        >
          {selectionBox ? <SelectionMarquee box={selectionBox} /> : null}
          {battlefieldObjects.map((object) => (
            <BattlefieldCard
              key={object.objectId}
              object={object}
              image={cardImagesByName[cardImageCacheKey(object.name)]}
              position={layout.positions[object.objectId] ?? { x: 24, y: 24 }}
              zIndex={layout.zIndexByObjectId.get(object.objectId) ?? 1}
              onToggleTapped={toggleActionCardsTapped}
            />
          ))}
        </DropZone>

        <aside className="zone-tray">
          <HandZone
            target={{ zone: "hand", playerId: player.id }}
            count={player.zones.hand.objects.length}
            previewInsertIndex={
              handPreview?.playerId === player.id ? handPreview.insertIndex : null
            }
            previewMovedObjectIds={previewMovedHandObjectIds}
            onCardsRectChange={handleHandCardsRectChange}
          >
            {player.zones.hand.objects.map((object) => (
              <Card
                key={object.objectId}
                object={object}
                image={cardImagesByName[cardImageCacheKey(object.name)]}
                onToggleTapped={toggleActionCardsTapped}
              />
            ))}
          </HandZone>

          {pileZones.map((zone) => {
            const target: DropTarget = isPlayerZone(zone)
              ? { zone, playerId: player.id }
              : { zone };
            const objects = zoneObjects(game, target);
            const topObject = topCard(objects);

            return (
              <PileZone key={zone} target={target} label={zone} count={objects.length}>
                {topObject ? (
                  <Card
                    key={topObject.objectId}
                    object={topObject}
                    image={cardImagesByName[cardImageCacheKey(topObject.name)]}
                    isFaceDown={zone === "library" && !isObjectRevealed(topObject, player.id)}
                    onToggleTapped={toggleActionCardsTapped}
                  />
                ) : null}
              </PileZone>
            );
          })}
        </aside>

        {previewLocation ? (
          <CardPreviewPopup
            object={previewLocation.object}
            image={cardImagesByName[cardImageCacheKey(previewLocation.object.name)]}
            side={previewSide}
          />
        ) : null}
      </main>
    </DragDropProvider>
  );
}
