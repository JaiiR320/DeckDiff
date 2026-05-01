import type { GameState } from "@deckdiff/schemas";
import type { CardPosition, DropTarget } from "../types.js";
import { findObjectLocation, sameTarget, zoneObjects } from "../zones.js";
import { handInsertIndexFromClientX } from "../tray/handLayout.js";
import { parseCardTargetId, parseDropTarget, zoneTargetId } from "./targets.js";

export type HandPreviewState = {
  playerId: string;
  primaryObjectId: string;
  dragObjectIds: string[];
  insertIndex: number;
};

export type DragEndAction =
  | { type: "none" }
  | { type: "battlefield-move"; objectId: string; delta: CardPosition }
  | {
      type: "zone-move";
      objectId: string;
      target: DropTarget;
      dropPosition: "battlefield" | "zone";
      insertIndex?: number;
    }
  | { type: "hand-reorder"; objectId: string; targetObjectId: string; playerId: string }
  | { type: "hand-reorder-to-index"; objectId: string; insertIndex: number; playerId: string };

export function effectiveDropTargetId({
  game,
  targetId,
  sourceCenterInsideBattlefield,
  targetElementInsideBattlefield,
}: {
  game: GameState;
  targetId: unknown;
  sourceCenterInsideBattlefield: boolean;
  targetElementInsideBattlefield: boolean;
}): unknown {
  if (sourceCenterInsideBattlefield || targetElementInsideBattlefield) {
    return zoneTargetId({ zone: "battlefield" });
  }

  const targetObjectId = parseCardTargetId(targetId) ?? (typeof targetId === "string" ? targetId : null);
  const targetFound = targetObjectId ? findObjectLocation(game, targetObjectId) : null;
  return targetFound?.zone.zone === "battlefield" ? zoneTargetId({ zone: "battlefield" }) : targetId;
}

export function handTargetFromDndTarget(
  game: GameState,
  targetId: unknown,
  actorPlayerId: string,
): DropTarget | null {
  const targetObjectId = parseCardTargetId(targetId);
  if (targetObjectId) {
    const targetFound = findObjectLocation(game, targetObjectId);
    if (targetFound?.zone.zone === "hand" && targetFound.zone.playerId) return targetFound.zone;
    return null;
  }

  const target = parseDropTarget(targetId, actorPlayerId);
  return target?.zone === "hand" && target.playerId ? target : null;
}

export function getDragObjectIds({
  game,
  primaryObjectId,
  selectedObjectIds,
  actorPlayerId,
}: {
  game: GameState;
  primaryObjectId: string;
  selectedObjectIds: string[];
  actorPlayerId: string;
}) {
  const primary = findObjectLocation(game, primaryObjectId);
  if (primary?.object.controllerPlayerId !== actorPlayerId) return [];

  if (!selectedObjectIds.includes(primaryObjectId)) return [primaryObjectId];

  return selectedObjectIds.filter((selectedObjectId) => {
    const found = findObjectLocation(game, selectedObjectId);
    return found?.object.controllerPlayerId === actorPlayerId;
  });
}

export function resolveDragEndAction({
  game,
  actorPlayerId,
  objectId,
  canceled,
  targetId,
  delta,
  handPreview,
}: {
  game: GameState;
  actorPlayerId: string;
  objectId: unknown;
  canceled: boolean;
  targetId: unknown;
  delta: CardPosition;
  handPreview: HandPreviewState | null;
}): DragEndAction {
  if (canceled || typeof objectId !== "string") return { type: "none" };

  const found = findObjectLocation(game, objectId);
  if (!found) return { type: "none" };

  const targetHand = handTargetFromDndTarget(game, targetId, actorPlayerId);
  const targetHandPlayerId = targetHand?.playerId;
  if (
    targetHand &&
    targetHandPlayerId &&
    handPreview?.primaryObjectId === objectId &&
    handPreview.playerId === targetHandPlayerId
  ) {
    if (found.zone.zone === "hand" && found.zone.playerId === targetHandPlayerId) {
      return {
        type: "hand-reorder-to-index",
        objectId,
        insertIndex: handPreview.insertIndex,
        playerId: targetHandPlayerId,
      };
    }

    return {
      type: "zone-move",
      objectId,
      target: { zone: "hand", playerId: targetHandPlayerId },
      dropPosition: "battlefield",
      insertIndex: handPreview.insertIndex,
    };
  }

  const targetObjectId = parseCardTargetId(targetId);
  if (targetObjectId) {
    const targetFound = findObjectLocation(game, targetObjectId);
    if (targetFound?.zone.zone === "hand" && targetFound.zone.playerId) {
      if (found.zone.zone === "hand" && found.zone.playerId === targetFound.zone.playerId) {
        if (handPreview?.primaryObjectId !== objectId) return { type: "none" };

        return {
          type: "hand-reorder",
          objectId,
          targetObjectId,
          playerId: targetFound.zone.playerId,
        };
      }

      const targetIndex = zoneObjects(game, targetFound.zone).findIndex(
        (object) => object.objectId === targetObjectId,
      );
      return {
        type: "zone-move",
        objectId,
        target: { zone: "hand", playerId: targetFound.zone.playerId },
        dropPosition: "battlefield",
        insertIndex: Math.max(0, targetIndex),
      };
    }

    if (targetFound?.zone.zone === "battlefield") {
      return found.zone.zone === "battlefield"
        ? { type: "battlefield-move", objectId, delta }
        : {
            type: "zone-move",
            objectId,
            target: { zone: "battlefield" },
            dropPosition: "battlefield",
          };
    }
  }

  const target = parseDropTarget(targetId, actorPlayerId);

  if (!target) {
    return found.zone.zone === "battlefield"
      ? { type: "battlefield-move", objectId, delta }
      : { type: "none" };
  }

  if (sameTarget(found.zone, target)) {
    return target.zone === "battlefield"
      ? { type: "battlefield-move", objectId, delta }
      : { type: "none" };
  }

  return { type: "zone-move", objectId, target, dropPosition: "zone" };
}

export function resolveHandPreview({
  game,
  objectId,
  targetId,
  actorPlayerId,
  dragObjectIds,
  handRect,
  sourceRect,
}: {
  game: GameState;
  objectId: unknown;
  targetId: unknown;
  actorPlayerId: string;
  dragObjectIds: string[];
  handRect: DOMRectReadOnly | null;
  sourceRect: DOMRect | undefined;
}): HandPreviewState | null {
  if (typeof objectId !== "string") return null;
  if (dragObjectIds.length === 0) return null;

  const targetHand = handTargetFromDndTarget(game, targetId, actorPlayerId);
  const targetHandPlayerId = targetHand?.playerId;
  if (!targetHand || !targetHandPlayerId || !handRect || !sourceRect) return null;

  const found = findObjectLocation(game, objectId);
  const targetHandObjects = zoneObjects(game, targetHand);
  const movedObjectIdSet = new Set(
    found?.zone.zone === "hand" && found.zone.playerId === targetHandPlayerId ? dragObjectIds : [],
  );
  const previewCardCount = targetHandObjects.filter(
    (object) => !movedObjectIdSet.has(object.objectId),
  ).length;
  const insertIndex = handInsertIndexFromClientX(
    sourceRect.left + sourceRect.width / 2,
    handRect,
    previewCardCount,
  );

  return { playerId: targetHandPlayerId, primaryObjectId: objectId, dragObjectIds, insertIndex };
}
