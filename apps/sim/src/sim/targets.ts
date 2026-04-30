import type { DropTarget, SimZone } from "./types.js";

export const battlefieldTargetId = "zone:battlefield";
export const cardTargetPrefix = "card:";

const playerZones = new Set<SimZone>(["library", "hand", "graveyard"]);
const sharedZones = new Set<SimZone>(["battlefield", "stack", "exile", "command"]);

/** Builds the droppable id for a zone. */
export function zoneTargetId(target: DropTarget): string {
  if (playerZones.has(target.zone)) return `zone:${target.playerId ?? ""}:${target.zone}`;
  return `zone:${target.zone}`;
}

/** Builds the droppable id for a card. */
export function cardTargetId(objectId: string): string {
  return `${cardTargetPrefix}${objectId}`;
}

/** Extracts an object id from a card target id. */
export function parseCardTargetId(targetId: unknown): string | null {
  if (typeof targetId !== "string" || !targetId.startsWith(cardTargetPrefix)) return null;
  return targetId.slice(cardTargetPrefix.length);
}

/** Parses a droppable id back into a zone target. */
export function parseDropTarget(targetId: unknown, fallbackPlayerId: string): DropTarget | null {
  if (typeof targetId !== "string" || !targetId.startsWith("zone:")) return null;

  const parts = targetId.split(":");
  if (parts.length === 2) {
    const zone = parts[1] as SimZone;
    if (sharedZones.has(zone)) return { zone };
    if (playerZones.has(zone)) return { zone, playerId: fallbackPlayerId };
    return null;
  }

  if (parts.length === 3) {
    const [, playerId, zone] = parts as [string, string, SimZone];
    if (!playerId || !playerZones.has(zone)) return null;
    return { zone, playerId };
  }

  return null;
}
