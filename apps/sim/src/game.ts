import { applyCommand } from "@deckdiff/core";
import type { GameState } from "@deckdiff/schemas";
import type { DropTarget } from "./types.js";
import { findObjectLocation, isPlayerZone, toZoneRef, zoneObjects } from "./zones.js";

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

function toggleStatus(
  game: GameState,
  objectIds: string[],
  status: "faceDown" | "flipped" | "tapped",
  isAllowed = (_target: DropTarget) => true,
): GameState {
  let nextGame = game;

  for (const objectId of objectIds) {
    const found = findObjectLocation(nextGame, objectId);
    if (!found || !isAllowed(found.zone)) continue;

    nextGame = applyCommand(nextGame, {
      type: "object.setStatus",
      objectId,
      status: { [status]: !found.object.status[status] },
    }).state;
  }

  return nextGame;
}

export function toggleTapped(game: GameState, objectIds: string[]): GameState {
  return toggleStatus(game, objectIds, "tapped", (target) => target.zone === "battlefield");
}

export function toggleFaceDown(game: GameState, objectIds: string[]): GameState {
  return toggleStatus(game, objectIds, "faceDown");
}

export function toggleFlipped(game: GameState, objectIds: string[]): GameState {
  return toggleStatus(game, objectIds, "flipped");
}

export function toggleRevealedToAll(game: GameState, objectId: string): GameState {
  const found = findObjectLocation(game, objectId);
  if (!found) return game;

  return applyCommand(game, {
    type: "object.setVisibility",
    objectId,
    visibility: found.object.visibility?.revealedTo === "all" ? null : { revealedTo: "all" },
  }).state;
}

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

  return !isPlayerZone(target.zone) || found.object.ownerPlayerId === target.playerId;
}

function isTopInsertZone(zone: DropTarget["zone"]): boolean {
  return zone === "library" || zone === "graveyard" || zone === "exile" || zone === "command";
}

export function moveObjects(
  game: GameState,
  objectIds: string[],
  target: DropTarget,
  actorPlayerId: string,
  insertIndex?: number,
): GameState {
  let nextGame = game;
  const targetInsertIndex = insertIndex ?? (isTopInsertZone(target.zone) ? 0 : undefined);

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
      insertIndex: targetInsertIndex === undefined ? undefined : targetInsertIndex + index,
    }).state;
  }

  return nextGame;
}

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

export function reorderZoneBefore(
  game: GameState,
  target: DropTarget,
  movedObjectIds: string[],
  targetObjectId: string,
): GameState {
  const objectIds = zoneObjects(game, target).map((object) => object.objectId);
  const nextObjectIds = moveIdsBefore(objectIds, movedObjectIds, targetObjectId);
  return nextObjectIds === objectIds ? game : reorderZone(game, target, nextObjectIds);
}

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

  return nextObjectIds.every((id, index) => id === objectIds[index])
    ? game
    : reorderZone(game, target, nextObjectIds);
}

function reorderZone(game: GameState, target: DropTarget, objectIds: string[]): GameState {
  return applyCommand(game, {
    type: "zone.reorder",
    zone: toZoneRef(target),
    objectIds,
  }).state;
}
