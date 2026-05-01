import type { GameObject, GameState, ZoneRef } from "@deckdiff/schemas";
import type { DropTarget, SimZone } from "./types.js";

export const playerZones = ["library", "hand", "graveyard"] as const;
export const sharedZones = ["battlefield", "exile", "command", "stack"] as const;

export type ObjectLocation = {
  object: GameObject;
  zone: DropTarget;
};

export function isPlayerZone(zone: SimZone): zone is (typeof playerZones)[number] {
  return zone === "library" || zone === "hand" || zone === "graveyard";
}

export function toZoneRef(target: DropTarget): ZoneRef {
  if (isPlayerZone(target.zone)) return { zone: target.zone, playerId: target.playerId };
  return { zone: target.zone };
}

export function sameTarget(a: DropTarget, b: DropTarget): boolean {
  return a.zone === b.zone && a.playerId === b.playerId;
}

export function zoneObjects(state: GameState, target: DropTarget): GameObject[] {
  if (!isPlayerZone(target.zone)) return state.zones[target.zone].objects;
  if (!target.playerId) return [];
  return (
    state.players.find((player) => player.id === target.playerId)?.zones[target.zone].objects ?? []
  );
}

export function findObjectLocation(state: GameState, objectId: string): ObjectLocation | null {
  for (const player of state.players) {
    for (const zone of playerZones) {
      const object = player.zones[zone].objects.find(
        (candidate) => candidate.objectId === objectId,
      );
      if (object) return { object, zone: { zone, playerId: player.id } };
    }
  }

  for (const zone of sharedZones) {
    const object = state.zones[zone].objects.find((candidate) => candidate.objectId === objectId);
    if (object) return { object, zone: { zone } };
  }

  return null;
}

export function isObjectRevealed(object: GameObject, playerId: string): boolean {
  if (!object.visibility) return false;
  if (object.visibility.revealedTo === "all") return true;
  return object.visibility.revealedTo.includes(playerId);
}

export function isLibraryTopObject(state: GameState, objectId: string): boolean {
  const found = findObjectLocation(state, objectId);
  if (found?.zone.zone !== "library" || !found.zone.playerId) return false;
  return topCard(zoneObjects(state, found.zone))?.objectId === objectId;
}

export function canPreviewObject(location: ObjectLocation, actorPlayerId: string): boolean {
  const revealed = isObjectRevealed(location.object, actorPlayerId);
  if (location.zone.zone === "library") return revealed;
  if (location.object.status.faceDown) {
    return revealed || location.object.controllerPlayerId === actorPlayerId;
  }
  return true;
}

export function topCard(objects: GameObject[]): GameObject | undefined {
  return objects[0];
}
