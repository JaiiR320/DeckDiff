import { applyCommand } from "@deckdiff/core";
import type { GameState } from "@deckdiff/schemas";
import type { DropTarget } from "./types.js";
import { findObjectLocation, isPlayerZone, toZoneRef, zoneObjects } from "./gameQueries.js";

/** Chooses which object ids an action applies to. */
export function actionObjectIds({
  selectedObjectIds,
  hoveredObjectId,
  fallbackObjectId,
}: {
  selectedObjectIds: string[];
  hoveredObjectId: string | null;
  fallbackObjectId?: string;
}): string[] {
  if (selectedObjectIds.length > 0) return selectedObjectIds;
  if (fallbackObjectId) return [fallbackObjectId];
  if (hoveredObjectId) return [hoveredObjectId];
  return [];
}

/** Moves ids before a target while preserving moved order. */
export function moveIdsBefore(ids: string[], movedIds: string[], targetId: string): string[] {
  const movedIdSet = new Set(movedIds);
  if (movedIdSet.has(targetId)) return ids;

  const remainingIds = ids.filter((id) => !movedIdSet.has(id));
  const targetIndex = remainingIds.indexOf(targetId);
  if (targetIndex < 0) return ids;

  return [
    ...remainingIds.slice(0, targetIndex),
    ...ids.filter((id) => movedIdSet.has(id)),
    ...remainingIds.slice(targetIndex),
  ];
}

/** Preflights whether the UI should allow a move. */
export function canMoveObjectToTarget(
  game: GameState,
  objectId: string,
  target: DropTarget,
  actorPlayerId: string,
): boolean {
  const found = findObjectLocation(game, objectId);
  if (!found) return false;
  if (isPlayerZone(target.zone) && !target.playerId) return false;
  if (!isPlayerZone(target.zone) && target.zone !== "battlefield" && target.playerId) return false;
  if (found.object.controllerPlayerId !== actorPlayerId) return false;

  if (isPlayerZone(target.zone) && found.object.ownerPlayerId !== undefined) {
    return found.object.ownerPlayerId === target.playerId;
  }

  return true;
}

/** Toggles tapped status for battlefield objects. */
export function toggleTapped(game: GameState, objectIds: string[]): GameState {
  let nextGame = game;

  for (const objectId of objectIds) {
    const found = findObjectLocation(nextGame, objectId);
    if (!found || found.zone.zone !== "battlefield") continue;

    nextGame = applyCommand(nextGame, {
      type: "object.setStatus",
      objectId,
      status: { tapped: !found.object.status.tapped },
    }).state;
  }

  return nextGame;
}

/** Toggles face-down status for objects. */
export function toggleFaceDown(game: GameState, objectIds: string[]): GameState {
  let nextGame = game;

  for (const objectId of objectIds) {
    const found = findObjectLocation(nextGame, objectId);
    if (!found) continue;

    nextGame = applyCommand(nextGame, {
      type: "object.setStatus",
      objectId,
      status: { faceDown: !found.object.status.faceDown },
    }).state;
  }

  return nextGame;
}

/** Toggles alternate-face status for objects. */
export function toggleFlipped(game: GameState, objectIds: string[]): GameState {
  let nextGame = game;

  for (const objectId of objectIds) {
    const found = findObjectLocation(nextGame, objectId);
    if (!found) continue;

    nextGame = applyCommand(nextGame, {
      type: "object.setStatus",
      objectId,
      status: { flipped: !found.object.status.flipped },
    }).state;
  }

  return nextGame;
}

/** Toggles whether an object is publicly revealed. */
export function toggleRevealedToAll(game: GameState, objectId: string): GameState {
  const found = findObjectLocation(game, objectId);
  if (!found) return game;

  return applyCommand(game, {
    type: "object.setVisibility",
    objectId,
    visibility: found.object.visibility?.revealedTo === "all" ? null : { revealedTo: "all" },
  }).state;
}

/** Applies primitive move commands for legal objects. */
export function moveObjects(
  game: GameState,
  objectIds: string[],
  target: DropTarget,
  actorPlayerId: string,
  insertIndex?: number,
): GameState {
  let nextGame = game;

  for (const [index, objectId] of objectIds.entries()) {
    const found = findObjectLocation(nextGame, objectId);
    if (!found || !canMoveObjectToTarget(nextGame, objectId, target, actorPlayerId)) continue;
    nextGame = applyCommand(nextGame, {
      type: "object.move",
      objectId,
      to: toZoneRef(target),
      controllerPlayerId:
        target.zone === "battlefield"
          ? (target.playerId ?? found.object.controllerPlayerId)
          : undefined,
      insertIndex: insertIndex === undefined ? undefined : insertIndex + index,
    }).state;
  }

  return nextGame;
}

/** Reorders a zone by moving objects before another object. */
export function reorderZoneBefore(
  game: GameState,
  target: DropTarget,
  movedObjectIds: string[],
  targetObjectId: string,
): GameState {
  const objectIds = zoneObjects(game, target).map((object) => object.objectId);
  const nextObjectIds = moveIdsBefore(objectIds, movedObjectIds, targetObjectId);
  if (nextObjectIds === objectIds) return game;

  return applyCommand(game, {
    type: "zone.reorder",
    zone: toZoneRef(target),
    objectIds: nextObjectIds,
  }).state;
}

/** Reorders a zone by moving objects to an index among the remaining objects. */
export function reorderZoneToIndex(
  game: GameState,
  target: DropTarget,
  movedObjectIds: string[],
  insertIndex: number,
): GameState {
  const objectIds = zoneObjects(game, target).map((object) => object.objectId);
  const movedIdSet = new Set(movedObjectIds);
  const remainingIds = objectIds.filter((id) => !movedIdSet.has(id));
  const clampedInsertIndex = Math.min(Math.max(insertIndex, 0), remainingIds.length);
  const nextObjectIds = [
    ...remainingIds.slice(0, clampedInsertIndex),
    ...objectIds.filter((id) => movedIdSet.has(id)),
    ...remainingIds.slice(clampedInsertIndex),
  ];

  if (nextObjectIds.every((id, index) => id === objectIds[index])) return game;

  return applyCommand(game, {
    type: "zone.reorder",
    zone: toZoneRef(target),
    objectIds: nextObjectIds,
  }).state;
}
