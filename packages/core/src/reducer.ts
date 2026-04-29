import type {
  GameCommand,
  GameEvent,
  GameObject,
  GameState,
  ObjectStatus,
  PlayerState,
  ZoneRef,
  ZoneState,
} from "@deckdiff/schemas";
import { gameStateSchema } from "@deckdiff/schemas";
import { createEvent } from "./events.js";
import { createId } from "./ids.js";
import { allPlayerZones, allSharedZones } from "./state.js";

export class GameCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameCommandError";
  }
}

export type ApplyCommandResult = {
  state: GameState;
  event: GameEvent;
};

type ObjectCreateInput = Extract<
  GameCommand,
  { type: "object.create" }
>["object"];

const defaultStatus: ObjectStatus = {
  tapped: false,
  faceDown: false,
  flipped: false,
  phasedOut: false,
};

export function applyCommand(
  current: GameState,
  command: GameCommand,
): ApplyCommandResult {
  if (command.type === "state.replace") {
    const nextState = gameStateSchema.parse(structuredClone(command.state));
    validateLiveStatePlayerReferences(nextState);
    const event = createEvent(
      nextState.revision + 1,
      command,
      "Replaced the full game state",
    );
    nextState.revision = event.revision;
    nextState.eventLog = [...nextState.eventLog, event];
    return { state: nextState, event };
  }

  const state = structuredClone(current);
  const message = mutate(state, command);
  const actorPlayerId = actorFor(command);
  const event = createEvent(
    state.revision + 1,
    command,
    message,
    actorPlayerId,
  );
  state.revision = event.revision;
  state.eventLog.push(event);
  return { state, event };
}

function mutate(
  state: GameState,
  command: Exclude<GameCommand, { type: "state.replace" }>,
): string {
  switch (command.type) {
    case "player.add": {
      if (state.players.some((player) => player.id === command.player.id)) {
        throw new GameCommandError(`duplicate player id: ${command.player.id}`);
      }
      state.players.push({
        id: command.player.id,
        name: command.player.name,
        life: 0,
        counters: [],
        zones: {
          library: { objects: [] },
          hand: { objects: [] },
          graveyard: { objects: [] },
        },
      });
      return `Added player ${command.player.name}`;
    }
    case "player.rename": {
      const player = requirePlayer(state, command.playerId);
      const previousName = player.name;
      player.name = command.name;
      return `Renamed ${previousName} to ${player.name}`;
    }
    case "player.adjustLife": {
      const player = requirePlayer(state, command.playerId);
      player.life += command.delta;
      return `${player.name} life ${formatDelta(command.delta)} to ${player.life}`;
    }
    case "player.setLife": {
      const player = requirePlayer(state, command.playerId);
      player.life = command.life;
      return `${player.name} life set to ${player.life}`;
    }
    case "player.setCounters": {
      const player = requirePlayer(state, command.playerId);
      player.counters = structuredClone(command.counters);
      return `Set counters on ${player.name}`;
    }
    case "object.create": {
      const zone = getZone(state, command.to);
      const object = buildGameObject(state, command.object);
      insertObject(zone, object, command.insertIndex);
      return `Created ${object.name} in ${zoneLabel(state, command.to)}`;
    }
    case "object.move": {
      const found = removeObject(state, command.objectId);
      const destination = getZone(state, command.to);
      const changedZone = !sameZone(found.zone, command.to);
      const moved = changedZone
        ? resetForZoneChange(found.object, command)
        : applyObjectOverrides(found.object, command);
      validateObjectPlayers(state, moved);
      validateVisibility(state, moved.visibility);
      insertObject(destination, moved, command.insertIndex);
      return `Moved ${moved.name} to ${zoneLabel(state, command.to)}`;
    }
    case "object.delete": {
      const found = removeObject(state, command.objectId);
      return `Deleted ${found.object.name}`;
    }
    case "object.copy": {
      const source = findObject(state, command.sourceObjectId).object;
      const destination = getZone(state, command.to);
      const controllerPlayerId =
        command.controllerPlayerId ?? source.controllerPlayerId;
      if (controllerPlayerId !== undefined)
        requirePlayer(state, controllerPlayerId);
      const copy: GameObject = {
        objectId: createId("obj"),
        kind: command.kind ?? (command.to.zone === "stack" ? "copy" : "token"),
        name: command.name ?? source.name,
        description: command.description ?? source.description,
        ownerPlayerId: command.ownerPlayerId ?? source.ownerPlayerId,
        controllerPlayerId,
        counters: [],
        status: structuredClone(source.status),
        annotations: [],
        copySourceObjectId: source.objectId,
      };
      validateObjectPlayers(state, copy);
      insertObject(destination, copy, command.insertIndex);
      return `Copied ${source.name} to ${zoneLabel(state, command.to)}`;
    }
    case "object.setStatus": {
      const { object } = findObject(state, command.objectId);
      object.status = { ...object.status, ...command.status };
      return `Set status on ${object.name}`;
    }
    case "object.setCounters": {
      const { object } = findObject(state, command.objectId);
      object.counters = structuredClone(command.counters);
      return `Set counters on ${object.name}`;
    }
    case "object.setController": {
      const { object } = findObject(state, command.objectId);
      if (command.controllerPlayerId !== null)
        requirePlayer(state, command.controllerPlayerId);
      object.controllerPlayerId = command.controllerPlayerId ?? undefined;
      return `Set controller on ${object.name}`;
    }
    case "object.setOwner": {
      const { object } = findObject(state, command.objectId);
      if (command.ownerPlayerId !== null)
        requirePlayer(state, command.ownerPlayerId);
      object.ownerPlayerId = command.ownerPlayerId ?? undefined;
      return `Set owner on ${object.name}`;
    }
    case "object.setVisibility": {
      const { object } = findObject(state, command.objectId);
      validateVisibility(state, command.visibility ?? undefined);
      object.visibility = command.visibility ?? undefined;
      return `Set visibility on ${object.name}`;
    }
    case "object.setAnnotations": {
      const { object } = findObject(state, command.objectId);
      object.annotations = structuredClone(command.annotations);
      return `Set annotations on ${object.name}`;
    }
    case "zone.reorder": {
      const zone = getZone(state, command.zone);
      if (command.objectIds.length !== zone.objects.length) {
        throw new GameCommandError(
          "zone reorder must include every object exactly once",
        );
      }
      if (new Set(command.objectIds).size !== command.objectIds.length) {
        throw new GameCommandError(
          "zone reorder cannot contain duplicate object IDs",
        );
      }
      zone.objects = command.objectIds.map((objectId) => {
        const object = zone.objects.find(
          (candidate) => candidate.objectId === objectId,
        );
        if (!object)
          throw new GameCommandError(`object not found in zone: ${objectId}`);
        return object;
      });
      if (shouldClearVisibilityForZoneOrderChange(command.zone))
        clearZoneVisibility(zone);
      return `Reordered ${zoneLabel(state, command.zone)}`;
    }
    case "zone.shuffle": {
      const zone = getZone(state, command.zone);
      shuffle(zone.objects);
      if (shouldClearVisibilityForZoneOrderChange(command.zone))
        clearZoneVisibility(zone);
      return `Shuffled ${zoneLabel(state, command.zone)}`;
    }
    case "zone.moveMany": {
      const removed = command.objectIds.map((objectId) =>
        removeObject(state, objectId),
      );
      const destination = getZone(state, command.to);
      const moved = removed.map((found) => {
        if (sameZone(found.zone, command.to)) {
          return applyObjectOverrides(found.object, { kind: command.kind });
        }
        return resetForZoneChange(found.object, {
          kind: command.kind,
          visibility: undefined,
        });
      });
      moved.forEach((object, offset) =>
        insertObject(destination, object, command.insertIndex, offset),
      );
      return `Moved ${moved.length} object${moved.length === 1 ? "" : "s"} to ${zoneLabel(state, command.to)}`;
    }
    case "priority.set": {
      if (command.playerId !== undefined)
        requirePlayer(state, command.playerId);
      state.priorityPlayerId = command.playerId;
      return command.playerId
        ? `Priority set to ${requirePlayer(state, command.playerId).name}`
        : "Priority cleared";
    }
    case "priority.pass": {
      const from = command.playerId ?? state.priorityPlayerId;
      if (from !== undefined) requirePlayer(state, from);
      state.priorityPlayerId = nextPlayerId(state, from);
      return state.priorityPlayerId
        ? `Priority passed to ${requirePlayer(state, state.priorityPlayerId).name}`
        : "Priority pass had no next player";
    }
    case "turn.set": {
      if (command.activePlayerId !== undefined)
        requirePlayer(state, command.activePlayerId);
      state.activePlayerId = command.activePlayerId ?? state.activePlayerId;
      state.turnNumber = command.turnNumber ?? state.turnNumber;
      state.phase = command.phase ?? state.phase;
      state.step = command.step ?? state.step;
      return "Updated turn state";
    }
    case "note.add":
      return command.message;
  }
}

type ObjectLocation = {
  object: GameObject;
  zone: ZoneRef;
  zoneState: ZoneState;
  index: number;
};

function requirePlayer(state: GameState, playerId: string): PlayerState {
  validatePlayerReference(playerIdsFor(state), playerId);
  const player = state.players.find((candidate) => candidate.id === playerId);
  return player!;
}

function playerIdsFor(state: GameState): Set<string> {
  return new Set(state.players.map((player) => player.id));
}

function validatePlayerReference(
  playerIds: ReadonlySet<string>,
  playerId: string | undefined,
  label = "player",
): void {
  if (playerId !== undefined && !playerIds.has(playerId)) {
    throw new GameCommandError(`${label} not found: ${playerId}`);
  }
}

function validateLiveStatePlayerReferences(state: GameState): void {
  const playerIds = new Set<string>();
  for (const player of state.players) {
    if (playerIds.has(player.id))
      throw new GameCommandError(`duplicate player id: ${player.id}`);
    playerIds.add(player.id);
  }

  validatePlayerReference(playerIds, state.activePlayerId, "active player");
  validatePlayerReference(playerIds, state.priorityPlayerId, "priority player");

  for (const player of state.players) {
    for (const zone of allPlayerZones()) {
      validateZonePlayerReferences(playerIds, player.zones[zone]);
    }
  }

  for (const zone of allSharedZones()) {
    validateZonePlayerReferences(playerIds, state.zones[zone]);
  }
}

function validateZonePlayerReferences(
  playerIds: ReadonlySet<string>,
  zone: ZoneState,
): void {
  for (const object of zone.objects) {
    validateObjectPlayerReferences(playerIds, object);
  }
}

function validateObjectPlayerReferences(
  playerIds: ReadonlySet<string>,
  object: GameObject,
): void {
  validatePlayerReference(playerIds, object.ownerPlayerId, "owner player");
  validatePlayerReference(
    playerIds,
    object.controllerPlayerId,
    "controller player",
  );
  if (!object.visibility || object.visibility.revealedTo === "all") return;
  object.visibility.revealedTo.forEach((playerId) =>
    validatePlayerReference(playerIds, playerId, "visibility player"),
  );
}

function getZone(state: GameState, zoneRef: ZoneRef): ZoneState {
  if (
    zoneRef.zone === "library" ||
    zoneRef.zone === "hand" ||
    zoneRef.zone === "graveyard"
  ) {
    if (!zoneRef.playerId)
      throw new GameCommandError(`${zoneRef.zone} requires playerId`);
    return requirePlayer(state, zoneRef.playerId).zones[zoneRef.zone];
  }

  if (zoneRef.playerId)
    throw new GameCommandError(`${zoneRef.zone} is a shared zone`);
  if (
    zoneRef.zone === "battlefield" ||
    zoneRef.zone === "stack" ||
    zoneRef.zone === "exile" ||
    zoneRef.zone === "command"
  ) {
    return state.zones[zoneRef.zone];
  }

  throw new GameCommandError(`unsupported zone: ${zoneRef.zone}`);
}

function findObject(state: GameState, objectId: string): ObjectLocation {
  for (const player of state.players) {
    for (const zone of allPlayerZones()) {
      const zoneState = player.zones[zone];
      const index = zoneState.objects.findIndex(
        (object) => object.objectId === objectId,
      );
      if (index >= 0) {
        return {
          object: zoneState.objects[index]!,
          zone: { zone, playerId: player.id },
          zoneState,
          index,
        };
      }
    }
  }

  for (const zone of allSharedZones()) {
    const zoneState = state.zones[zone];
    const index = zoneState.objects.findIndex(
      (object) => object.objectId === objectId,
    );
    if (index >= 0)
      return {
        object: zoneState.objects[index]!,
        zone: { zone },
        zoneState,
        index,
      };
  }

  throw new GameCommandError(`object not found: ${objectId}`);
}

function removeObject(state: GameState, objectId: string): ObjectLocation {
  const found = findObject(state, objectId);
  const [object] = found.zoneState.objects.splice(found.index, 1);
  return { ...found, object: object! };
}

function insertObject(
  zone: ZoneState,
  object: GameObject,
  insertIndex?: number,
  offset = 0,
): void {
  const index =
    insertIndex === undefined ? zone.objects.length : insertIndex + offset;
  if (index > zone.objects.length)
    throw new GameCommandError(`insertIndex out of range: ${insertIndex}`);
  zone.objects.splice(index, 0, object);
}

function buildGameObject(
  state: GameState,
  object: ObjectCreateInput,
): GameObject {
  const created: GameObject = {
    objectId: createId("obj"),
    ...object,
    counters: structuredClone(object.counters ?? []),
    status: { ...defaultStatus, ...object.status },
    annotations: structuredClone(object.annotations ?? []),
  };
  validateObjectPlayers(state, created);
  validateVisibility(state, created.visibility);
  return created;
}

function resetForZoneChange(
  object: GameObject,
  overrides: {
    kind?: GameObject["kind"];
    ownerPlayerId?: string;
    controllerPlayerId?: string;
    status?: Partial<ObjectStatus>;
    counters?: GameObject["counters"];
    visibility?: GameObject["visibility"];
  },
): GameObject {
  return {
    ...object,
    objectId: createId("obj"),
    kind: overrides.kind ?? object.kind,
    ownerPlayerId: overrides.ownerPlayerId ?? object.ownerPlayerId,
    controllerPlayerId:
      overrides.controllerPlayerId ?? object.controllerPlayerId,
    counters: structuredClone(overrides.counters ?? []),
    status: { ...defaultStatus, ...overrides.status },
    visibility: overrides.visibility,
  };
}

function applyObjectOverrides(
  object: GameObject,
  overrides: {
    kind?: GameObject["kind"];
    ownerPlayerId?: string;
    controllerPlayerId?: string;
    status?: Partial<ObjectStatus>;
    counters?: GameObject["counters"];
    visibility?: GameObject["visibility"];
  },
): GameObject {
  return {
    ...object,
    kind: overrides.kind ?? object.kind,
    ownerPlayerId: overrides.ownerPlayerId ?? object.ownerPlayerId,
    controllerPlayerId:
      overrides.controllerPlayerId ?? object.controllerPlayerId,
    counters: overrides.counters
      ? structuredClone(overrides.counters)
      : object.counters,
    status: overrides.status
      ? { ...object.status, ...overrides.status }
      : object.status,
    visibility: overrides.visibility ?? object.visibility,
  };
}

function validateObjectPlayers(state: GameState, object: GameObject): void {
  if (object.ownerPlayerId !== undefined)
    requirePlayer(state, object.ownerPlayerId);
  if (object.controllerPlayerId !== undefined)
    requirePlayer(state, object.controllerPlayerId);
}

function validateVisibility(
  state: GameState,
  visibility: GameObject["visibility"],
): void {
  if (!visibility || visibility.revealedTo === "all") return;
  visibility.revealedTo.forEach((playerId) => requirePlayer(state, playerId));
}

function sameZone(left: ZoneRef, right: ZoneRef): boolean {
  return left.zone === right.zone && left.playerId === right.playerId;
}

function shouldClearVisibilityForZoneOrderChange(zoneRef: ZoneRef): boolean {
  return zoneRef.zone === "library";
}

function clearZoneVisibility(zone: ZoneState): void {
  zone.objects.forEach((object) => {
    object.visibility = undefined;
  });
}

function shuffle<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!];
  }
}

function nextPlayerId(state: GameState, from?: string): string | undefined {
  if (state.players.length === 0) return undefined;
  const index = from
    ? state.players.findIndex((player) => player.id === from)
    : -1;
  return state.players[(index + 1) % state.players.length]?.id;
}

function actorFor(
  command: Exclude<GameCommand, { type: "state.replace" }>,
): string | undefined {
  if ("actorPlayerId" in command) return command.actorPlayerId;
  if ("playerId" in command) return command.playerId;
  if ("controllerPlayerId" in command)
    return command.controllerPlayerId ?? undefined;
  if ("ownerPlayerId" in command) return command.ownerPlayerId ?? undefined;
  if ("object" in command)
    return command.object.controllerPlayerId ?? command.object.ownerPlayerId;
  return undefined;
}

function zoneLabel(state: GameState, zoneRef: ZoneRef): string {
  if (zoneRef.playerId)
    return `${requirePlayer(state, zoneRef.playerId).name}'s ${zoneRef.zone}`;
  return zoneRef.zone;
}

function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}
