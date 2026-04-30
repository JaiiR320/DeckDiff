import type { GameObject, GameState, ZoneRef } from "@deckdiff/schemas";
import type { DropTarget, SimZone } from "./types.js";

export type ObjectLocation = {
  object: GameObject;
  zone: DropTarget;
};

const playerZones = ["library", "hand", "graveyard"] as const;
const sharedZones = ["battlefield", "exile", "command", "stack"] as const;

/** Returns true for zones owned by a specific player. */
export function isPlayerZone(zone: SimZone): zone is (typeof playerZones)[number] {
  return zone === "library" || zone === "hand" || zone === "graveyard";
}

/** Returns true for zones shared by all players. */
export function isSharedZone(zone: SimZone): zone is (typeof sharedZones)[number] {
  return zone === "battlefield" || zone === "exile" || zone === "command" || zone === "stack";
}

/** Converts a UI drop target into a core zone ref. */
export function toZoneRef(target: DropTarget): ZoneRef {
  if (isPlayerZone(target.zone)) return { zone: target.zone, playerId: target.playerId };
  return { zone: target.zone };
}

/** Checks whether two targets refer to the same zone. */
export function sameTarget(a: DropTarget, b: DropTarget): boolean {
  return a.zone === b.zone && a.playerId === b.playerId;
}

/** Finds an object and its current zone. */
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

/** Returns the objects in a target zone. */
export function zoneObjects(state: GameState, target: DropTarget): GameObject[] {
  if (isPlayerZone(target.zone)) {
    if (!target.playerId) return [];
    return (
      state.players.find((player) => player.id === target.playerId)?.zones[target.zone].objects ??
      []
    );
  }

  return state.zones[target.zone].objects;
}

/** Returns whether an object has been revealed to a player. */
export function isObjectRevealed(object: GameObject, playerId: string): boolean {
  if (!object.visibility) return false;
  if (object.visibility.revealedTo === "all") return true;
  return object.visibility.revealedTo.includes(playerId);
}

/** Returns whether an object is currently the top card of a library. */
export function isLibraryTopObject(state: GameState, objectId: string): boolean {
  const found = findObjectLocation(state, objectId);
  if (found?.zone.zone !== "library" || !found.zone.playerId) return false;
  return topCard(zoneObjects(state, found.zone))?.objectId === objectId;
}

/** Checks whether the local actor may see a card preview. */
export function canPreviewObject(location: ObjectLocation, actorPlayerId: string): boolean {
  const revealed = isObjectRevealed(location.object, actorPlayerId);
  if (location.zone.zone === "library") return revealed;
  if (location.object.status.faceDown) {
    return revealed || location.object.controllerPlayerId === actorPlayerId;
  }
  return true;
}

/** Returns the visible/top object for a pile zone. */
export function topCard(objects: GameObject[]): GameObject | undefined {
  return objects[0];
}
