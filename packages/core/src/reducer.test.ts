import { describe, expect, it } from "vitest";
import { gameCommandSchema } from "@deckdiff/schemas";
import { applyCommand, createGame, toGameView } from "./index.js";

describe("virtual table engine", () => {
  it("creates a game with up to four players and named cards", () => {
    const game = createGame({
      players: [
        { name: "Jair", library: ["Lightning Bolt"] },
        { name: "Skyler" },
        { name: "Alex" },
        { name: "Bianca" },
      ],
    });

    expect(game.players).toHaveLength(4);
    expect(game.players[0]?.zones.library.objects[0]?.name).toBe("Lightning Bolt");
    expect(game.players[0]?.zones.library.objects[0]?.cardId).toBeDefined();
    expect(game.players[0]?.zones.library.objects[0]?.objectId).toBeDefined();
    expect(game.activePlayerId).toBe(game.players[0]?.id);
    expect(toGameView(game).viewMode).toBe("debug");
  });

  it("creates an empty game and adds players by command", () => {
    let game = createGame({ players: [] });

    expect(game.players).toEqual([]);
    expect(game.activePlayerId).toBeUndefined();
    expect(game.priorityPlayerId).toBeUndefined();

    const result = applyCommand(game, {
      type: "player.add",
      player: { id: "p1", name: "Jair" },
    });
    game = result.state;

    expect(game.players).toHaveLength(1);
    expect(game.players[0]).toMatchObject({
      id: "p1",
      name: "Jair",
      life: 0,
      counters: [],
      zones: {
        library: { objects: [] },
        hand: { objects: [] },
        graveyard: { objects: [] },
      },
    });
    expect(game.activePlayerId).toBeUndefined();
    expect(game.priorityPlayerId).toBeUndefined();
    expect(game.revision).toBe(1);
    expect(result.event.type).toBe("player.add");
    expect(result.event.message).toBe("Added player Jair");
  });

  it("rejects duplicate added player IDs", () => {
    const game = createGame({ players: [{ id: "p1", name: "Jair" }] });

    expect(() =>
      applyCommand(game, {
        type: "player.add",
        player: { id: "p1", name: "Duplicate" },
      }),
    ).toThrow("duplicate player id: p1");
  });

  it("validates player add command shape", () => {
    expect(
      gameCommandSchema.safeParse({
        type: "player.add",
        player: { id: "p1", name: "Jair" },
      }).success,
    ).toBe(true);
    expect(
      gameCommandSchema.safeParse({
        type: "player.add",
        player: { name: "Jair" },
      }).success,
    ).toBe(false);
  });

  it("renames players without changing their stable id or references", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Old Name", battlefield: ["Llanowar Elves"] }],
    });
    const permanent = game.zones.battlefield.objects[0]!;

    const result = applyCommand(game, {
      type: "player.rename",
      playerId: "p1",
      name: "New Name",
    });
    game = result.state;

    expect(game.players[0]).toMatchObject({ id: "p1", name: "New Name" });
    expect(game.zones.battlefield.objects[0]).toMatchObject({
      objectId: permanent.objectId,
      ownerPlayerId: "p1",
      controllerPlayerId: "p1",
    });
    expect(result.event.actorPlayerId).toBe("p1");
    expect(result.event.message).toBe("Renamed Old Name to New Name");
  });

  it("rejects invalid player rename commands", () => {
    const game = createGame({ players: [{ id: "p1", name: "Jair" }] });

    expect(
      gameCommandSchema.safeParse({
        type: "player.rename",
        playerId: "p1",
        name: "J",
      }).success,
    ).toBe(true);
    expect(
      gameCommandSchema.safeParse({
        type: "player.rename",
        playerId: "p1",
        name: "",
      }).success,
    ).toBe(false);
    expect(() =>
      applyCommand(game, {
        type: "player.rename",
        playerId: "missing",
        name: "New",
      }),
    ).toThrow("player not found: missing");
  });

  it("rejects incoherent initial player IDs", () => {
    expect(() =>
      createGame({
        players: [
          { id: "p1", name: "Jair" },
          { id: "p1", name: "Skyler" },
        ],
      }),
    ).toThrow("duplicate player id");
    expect(() =>
      createGame({
        players: [{ id: "p1", name: "Jair" }],
        activePlayerId: "missing",
      }),
    ).toThrow("active player not found");
    expect(() =>
      createGame({
        players: [{ id: "p1", name: "Jair" }],
        priorityPlayerId: "missing",
      }),
    ).toThrow("priority player not found");
  });

  it("moves cards from library to hand and records an event", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", library: ["Opt", "Island"] }],
    });
    const objectIds = game.players[0]!.zones.library.objects.map((object) => object.objectId);

    const result = applyCommand(game, {
      type: "zone.moveMany",
      objectIds,
      to: { zone: "hand", playerId: "p1" },
    });
    game = result.state;

    expect(game.players[0]?.zones.library.objects).toHaveLength(0);
    expect(game.players[0]?.zones.hand.objects.map((card) => card.name)).toEqual(["Opt", "Island"]);
    expect(game.revision).toBe(1);
    expect(game.eventLog).toHaveLength(1);
    expect(result.event.type).toBe("zone.moveMany");
  });

  it("moves objects between zones and changes status", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", hand: ["Mountain"] }],
    });
    const original = game.players[0]!.zones.hand.objects[0]!;

    game = applyCommand(game, {
      type: "object.move",
      objectId: original.objectId,
      to: { zone: "battlefield" },
      controllerPlayerId: "p1",
    }).state;
    const moved = game.zones.battlefield.objects[0]!;
    game = applyCommand(game, {
      type: "object.setStatus",
      objectId: moved.objectId,
      status: { tapped: true, faceDown: true, flipped: true },
    }).state;

    const permanent = game.zones.battlefield.objects[0];
    expect(permanent?.name).toBe("Mountain");
    expect(permanent?.cardId).toBe(original.cardId);
    expect(permanent?.objectId).not.toBe(original.objectId);
    expect(permanent?.status).toMatchObject({
      tapped: true,
      faceDown: true,
      flipped: true,
    });
  });

  it("validates visibility overrides when moving objects", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", hand: ["Island"] }],
    });
    const objectId = game.players[0]!.zones.hand.objects[0]!.objectId;

    expect(() =>
      applyCommand(game, {
        type: "object.move",
        objectId,
        to: { zone: "battlefield" },
        visibility: { revealedTo: ["missing"] },
      }),
    ).toThrow("player not found");

    game = applyCommand(game, {
      type: "object.move",
      objectId,
      to: { zone: "battlefield" },
      visibility: { revealedTo: ["p1"] },
    }).state;

    expect(game.zones.battlefield.objects[0]?.visibility).toEqual({
      revealedTo: ["p1"],
    });
  });

  it("sets object and player counters", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", battlefield: ["Goblin Guide"] }],
    });
    const objectId = game.zones.battlefield.objects[0]!.objectId;

    game = applyCommand(game, {
      type: "object.setCounters",
      objectId,
      counters: [{ type: "+1/+1", amount: 2 }],
    }).state;
    game = applyCommand(game, {
      type: "player.setCounters",
      playerId: "p1",
      counters: [{ type: "poison", amount: 1 }],
    }).state;

    expect(game.zones.battlefield.objects[0]?.counters).toEqual([{ type: "+1/+1", amount: 2 }]);
    expect(game.players[0]?.counters).toEqual([{ type: "poison", amount: 1 }]);
  });

  it("clears counters and transient status on zone changes", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", battlefield: ["Bear Cub"] }],
    });
    const battlefieldObjectId = game.zones.battlefield.objects[0]!.objectId;

    game = applyCommand(game, {
      type: "object.setStatus",
      objectId: battlefieldObjectId,
      status: { tapped: true, faceDown: true, flipped: true },
    }).state;
    game = applyCommand(game, {
      type: "object.setCounters",
      objectId: battlefieldObjectId,
      counters: [{ type: "+1/+1", amount: 1 }],
    }).state;
    game = applyCommand(game, {
      type: "object.move",
      objectId: battlefieldObjectId,
      to: { zone: "graveyard", playerId: "p1" },
    }).state;

    const graveyardObject = game.players[0]!.zones.graveyard.objects[0]!;
    expect(graveyardObject.objectId).not.toBe(battlefieldObjectId);
    expect(graveyardObject.counters).toEqual([]);
    expect(graveyardObject.status.tapped).toBe(false);
    expect(graveyardObject.status.faceDown).toBe(true);
    expect(graveyardObject.status.flipped).toBe(true);
  });

  it("adjusts life and updates turn and priority state", () => {
    let game = createGame({
      players: [
        { id: "p1", name: "Jair" },
        { id: "p2", name: "Skyler" },
      ],
    });

    game = applyCommand(game, {
      type: "player.adjustLife",
      playerId: "p1",
      delta: -3,
    }).state;
    game = applyCommand(game, {
      type: "player.setLife",
      playerId: "p1",
      life: 33,
    }).state;
    game = applyCommand(game, { type: "priority.pass", playerId: "p1" }).state;
    game = applyCommand(game, {
      type: "turn.set",
      activePlayerId: "p2",
      turnNumber: 3,
      phase: "combat",
      step: "declareAttackers",
    }).state;

    expect(game.players[0]?.life).toBe(33);
    expect(game.priorityPlayerId).toBe("p2");
    expect(game.activePlayerId).toBe("p2");
    expect(game.turnNumber).toBe(3);
    expect(game.phase).toBe("combat");
  });

  it("uses stack as an ordinary ordered zone with index 0 as top", () => {
    let game = createGame({ players: [{ id: "p1", name: "Jair" }] });

    game = applyCommand(game, {
      type: "object.create",
      object: { kind: "spell", controllerPlayerId: "p1", name: "Bottom" },
      to: { zone: "stack" },
    }).state;
    game = applyCommand(game, {
      type: "object.create",
      object: { kind: "spell", controllerPlayerId: "p1", name: "Top" },
      to: { zone: "stack" },
      insertIndex: 0,
    }).state;

    expect(game.zones.stack.objects.map((item) => item.name)).toEqual(["Top", "Bottom"]);

    const topObjectId = game.zones.stack.objects[0]!.objectId;
    game = applyCommand(game, {
      type: "object.delete",
      objectId: topObjectId,
    }).state;
    expect(game.zones.stack.objects.map((item) => item.name)).toEqual(["Bottom"]);
  });

  it("reorders any zone by exact object IDs", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", library: ["One", "Two", "Three"] }],
    });
    const ids = game.players[0]!.zones.library.objects.map((object) => object.objectId);

    game = applyCommand(game, {
      type: "zone.reorder",
      zone: { zone: "library", playerId: "p1" },
      objectIds: [ids[2]!, ids[0]!, ids[1]!],
    }).state;

    expect(game.players[0]!.zones.library.objects.map((object) => object.name)).toEqual([
      "Three",
      "One",
      "Two",
    ]);
  });

  it("clears visibility only for library order changes", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", library: ["One"], hand: ["Two"] }],
    });
    const libraryObjectId = game.players[0]!.zones.library.objects[0]!.objectId;
    const handObjectId = game.players[0]!.zones.hand.objects[0]!.objectId;

    game = applyCommand(game, {
      type: "object.setVisibility",
      objectId: libraryObjectId,
      visibility: { revealedTo: "all" },
    }).state;
    game = applyCommand(game, {
      type: "object.setVisibility",
      objectId: handObjectId,
      visibility: { revealedTo: "all" },
    }).state;
    game = applyCommand(game, {
      type: "zone.reorder",
      zone: { zone: "library", playerId: "p1" },
      objectIds: [libraryObjectId],
    }).state;
    game = applyCommand(game, {
      type: "zone.reorder",
      zone: { zone: "hand", playerId: "p1" },
      objectIds: [handObjectId],
    }).state;

    expect(game.players[0]!.zones.library.objects[0]?.visibility).toBeUndefined();
    expect(game.players[0]!.zones.hand.objects[0]?.visibility).toEqual({
      revealedTo: "all",
    });
  });

  it("clears visibility only for library shuffles", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", library: ["One"], hand: ["Two"] }],
    });
    const libraryObjectId = game.players[0]!.zones.library.objects[0]!.objectId;
    const handObjectId = game.players[0]!.zones.hand.objects[0]!.objectId;

    game = applyCommand(game, {
      type: "object.setVisibility",
      objectId: libraryObjectId,
      visibility: { revealedTo: "all" },
    }).state;
    game = applyCommand(game, {
      type: "object.setVisibility",
      objectId: handObjectId,
      visibility: { revealedTo: "all" },
    }).state;
    game = applyCommand(game, {
      type: "zone.shuffle",
      zone: { zone: "library", playerId: "p1" },
    }).state;
    game = applyCommand(game, {
      type: "zone.shuffle",
      zone: { zone: "hand", playerId: "p1" },
    }).state;

    expect(game.players[0]!.zones.library.objects[0]?.visibility).toBeUndefined();
    expect(game.players[0]!.zones.hand.objects[0]?.visibility).toEqual({
      revealedTo: "all",
    });
  });

  it("moves many objects within the same zone without resetting object metadata", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", library: ["One", "Two"] }],
    });
    const first = game.players[0]!.zones.library.objects[0]!;
    const second = game.players[0]!.zones.library.objects[1]!;

    game = applyCommand(game, {
      type: "object.setCounters",
      objectId: first.objectId,
      counters: [{ type: "test", amount: 1 }],
    }).state;
    game = applyCommand(game, {
      type: "object.setStatus",
      objectId: first.objectId,
      status: { faceDown: true },
    }).state;
    game = applyCommand(game, {
      type: "object.setVisibility",
      objectId: first.objectId,
      visibility: { revealedTo: "all" },
    }).state;

    game = applyCommand(game, {
      type: "zone.moveMany",
      objectIds: [second.objectId, first.objectId],
      to: { zone: "library", playerId: "p1" },
      insertIndex: 0,
    }).state;

    const movedFirst = game.players[0]!.zones.library.objects[1]!;
    expect(game.players[0]!.zones.library.objects.map((object) => object.name)).toEqual([
      "Two",
      "One",
    ]);
    expect(movedFirst.objectId).toBe(first.objectId);
    expect(movedFirst.counters).toEqual([{ type: "test", amount: 1 }]);
    expect(movedFirst.status.faceDown).toBe(true);
    expect(movedFirst.visibility).toEqual({ revealedTo: "all" });
  });

  it("moves many objects across zones with zone-change resets", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", library: ["One"] }],
    });
    const original = game.players[0]!.zones.library.objects[0]!;

    game = applyCommand(game, {
      type: "object.setCounters",
      objectId: original.objectId,
      counters: [{ type: "test", amount: 1 }],
    }).state;
    game = applyCommand(game, {
      type: "object.setStatus",
      objectId: original.objectId,
      status: { tapped: true, faceDown: true, flipped: true },
    }).state;
    game = applyCommand(game, {
      type: "object.setVisibility",
      objectId: original.objectId,
      visibility: { revealedTo: "all" },
    }).state;

    game = applyCommand(game, {
      type: "zone.moveMany",
      objectIds: [original.objectId],
      to: { zone: "hand", playerId: "p1" },
    }).state;

    const moved = game.players[0]!.zones.hand.objects[0]!;
    expect(moved.objectId).not.toBe(original.objectId);
    expect(moved.cardId).toBe(original.cardId);
    expect(moved.counters).toEqual([]);
    expect(moved.status.tapped).toBe(false);
    expect(moved.status.faceDown).toBe(true);
    expect(moved.status.flipped).toBe(true);
    expect(moved.visibility).toBeUndefined();
  });

  it("moves represented cards onto and off the shared stack zone", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", hand: ["Lightning Bolt"] }],
    });
    const handObject = game.players[0]!.zones.hand.objects[0]!;

    game = applyCommand(game, {
      type: "object.move",
      objectId: handObject.objectId,
      to: { zone: "stack" },
      kind: "spell",
      controllerPlayerId: "p1",
      insertIndex: 0,
    }).state;

    const stackObject = game.zones.stack.objects[0]!;
    expect(game.players[0]!.zones.hand.objects).toHaveLength(0);
    expect(stackObject).toMatchObject({
      kind: "spell",
      name: "Lightning Bolt",
      ownerPlayerId: "p1",
      controllerPlayerId: "p1",
      cardId: handObject.cardId,
    });
    expect(stackObject.objectId).not.toBe(handObject.objectId);

    game = applyCommand(game, {
      type: "object.move",
      objectId: stackObject.objectId,
      to: { zone: "graveyard", playerId: "p1" },
      kind: "card",
      insertIndex: 0,
    }).state;
    expect(game.players[0]!.zones.graveyard.objects[0]?.name).toBe("Lightning Bolt");
  });

  it("creates tokens, copies objects, and sets metadata", () => {
    let game = createGame({
      players: [
        { id: "p1", name: "Jair", battlefield: ["Grizzly Bears"] },
        { id: "p2", name: "Skyler" },
      ],
    });
    const sourceObjectId = game.zones.battlefield.objects[0]!.objectId;

    game = applyCommand(game, {
      type: "object.create",
      object: {
        kind: "token",
        ownerPlayerId: "p1",
        controllerPlayerId: "p1",
        name: "Food",
      },
      to: { zone: "battlefield" },
    }).state;
    game = applyCommand(game, {
      type: "object.copy",
      sourceObjectId,
      to: { zone: "battlefield" },
      ownerPlayerId: "p2",
      controllerPlayerId: "p1",
    }).state;
    game = applyCommand(game, {
      type: "object.copy",
      sourceObjectId,
      to: { zone: "stack" },
      controllerPlayerId: "p1",
      insertIndex: 0,
    }).state;

    expect(game.zones.battlefield.objects.at(-2)?.kind).toBe("token");
    expect(game.zones.battlefield.objects.at(-2)?.cardId).toBeUndefined();
    expect(game.zones.battlefield.objects.at(-1)?.copySourceObjectId).toBe(sourceObjectId);
    expect(game.zones.battlefield.objects.at(-1)?.ownerPlayerId).toBe("p2");
    expect(game.zones.battlefield.objects.at(-1)?.controllerPlayerId).toBe("p1");
    expect(game.zones.stack.objects[0]?.kind).toBe("copy");
    expect(game.zones.stack.objects[0]?.ownerPlayerId).toBe("p1");
    expect(game.zones.stack.objects[0]?.controllerPlayerId).toBe("p1");
  });

  it("sets and clears visibility, controller, owner, and annotations", () => {
    let game = createGame({
      players: [{ id: "p1", name: "Jair", hand: ["Island"] }],
    });
    const objectId = game.players[0]!.zones.hand.objects[0]!.objectId;

    game = applyCommand(game, {
      type: "object.setVisibility",
      objectId,
      visibility: { revealedTo: "all" },
    }).state;
    game = applyCommand(game, {
      type: "object.setAnnotations",
      objectId,
      annotations: ["chosen"],
    }).state;
    game = applyCommand(game, {
      type: "object.setOwner",
      objectId,
      ownerPlayerId: "p1",
    }).state;
    game = applyCommand(game, {
      type: "object.setController",
      objectId,
      controllerPlayerId: "p1",
    }).state;
    game = applyCommand(game, {
      type: "object.setController",
      objectId,
      controllerPlayerId: null,
    }).state;
    game = applyCommand(game, {
      type: "object.setOwner",
      objectId,
      ownerPlayerId: null,
    }).state;
    game = applyCommand(game, {
      type: "object.setVisibility",
      objectId,
      visibility: null,
    }).state;

    expect(game.players[0]!.zones.hand.objects[0]?.visibility).toBeUndefined();
    expect(game.players[0]!.zones.hand.objects[0]?.annotations).toEqual(["chosen"]);
    expect(game.players[0]!.zones.hand.objects[0]?.ownerPlayerId).toBeUndefined();
    expect(game.players[0]!.zones.hand.objects[0]?.controllerPlayerId).toBeUndefined();
  });

  it("requires explicit null to clear optional object fields", () => {
    expect(
      gameCommandSchema.safeParse({
        type: "object.setController",
        objectId: "obj",
      }).success,
    ).toBe(false);
    expect(gameCommandSchema.safeParse({ type: "object.setOwner", objectId: "obj" }).success).toBe(
      false,
    );
    expect(
      gameCommandSchema.safeParse({
        type: "object.setVisibility",
        objectId: "obj",
      }).success,
    ).toBe(false);
  });

  it("replaces the entire game state", () => {
    const game = createGame({ players: [{ id: "p1", name: "Jair" }] });
    const replacement = createGame({
      players: [{ id: "p2", name: "Skyler", hand: ["Island"] }],
    });

    const result = applyCommand(game, {
      type: "state.replace",
      state: replacement,
    });

    expect(result.state.players[0]?.id).toBe("p2");
    expect(result.state.players[0]?.zones.hand.objects[0]?.name).toBe("Island");
    expect(result.state.eventLog.at(-1)?.type).toBe("state.replace");
  });

  it("rejects replacement states with invalid live player references", () => {
    const game = createGame({ players: [{ id: "p1", name: "Jair" }] });

    const withDuplicatePlayer = structuredClone(game);
    withDuplicatePlayer.players.push(structuredClone(withDuplicatePlayer.players[0]!));
    expect(() => applyCommand(game, { type: "state.replace", state: withDuplicatePlayer })).toThrow(
      "duplicate player id",
    );

    const withMissingActivePlayer = structuredClone(game);
    withMissingActivePlayer.activePlayerId = "missing";
    expect(() =>
      applyCommand(game, {
        type: "state.replace",
        state: withMissingActivePlayer,
      }),
    ).toThrow("active player not found");

    const withMissingPriorityPlayer = structuredClone(game);
    withMissingPriorityPlayer.priorityPlayerId = "missing";
    expect(() =>
      applyCommand(game, {
        type: "state.replace",
        state: withMissingPriorityPlayer,
      }),
    ).toThrow("priority player not found");

    const withMissingOwner = createGame({
      players: [{ id: "p1", name: "Jair", hand: ["Island"] }],
    });
    withMissingOwner.players[0]!.zones.hand.objects[0]!.ownerPlayerId = "missing";
    expect(() => applyCommand(game, { type: "state.replace", state: withMissingOwner })).toThrow(
      "owner player not found",
    );

    const withMissingController = createGame({
      players: [{ id: "p1", name: "Jair", hand: ["Island"] }],
    });
    withMissingController.players[0]!.zones.hand.objects[0]!.controllerPlayerId = "missing";
    expect(() =>
      applyCommand(game, {
        type: "state.replace",
        state: withMissingController,
      }),
    ).toThrow("controller player not found");

    const withMissingVisibilityPlayer = createGame({
      players: [{ id: "p1", name: "Jair", hand: ["Island"] }],
    });
    withMissingVisibilityPlayer.players[0]!.zones.hand.objects[0]!.visibility = {
      revealedTo: ["missing"],
    };
    expect(() =>
      applyCommand(game, {
        type: "state.replace",
        state: withMissingVisibilityPlayer,
      }),
    ).toThrow("visibility player not found");
  });

  it("does not reject replacement states for historical event actors", () => {
    const game = createGame({ players: [{ id: "p1", name: "Jair" }] });
    const replacement = structuredClone(game);
    replacement.eventLog.push({
      id: "event_1",
      revision: 1,
      timestamp: new Date().toISOString(),
      type: "note.add",
      actorPlayerId: "missing",
      message: "from old history",
      commandType: "note.add",
    });

    expect(() => applyCommand(game, { type: "state.replace", state: replacement })).not.toThrow();
  });

  it("rejects structurally valid commands that reference missing IDs", () => {
    const game = createGame({ players: [{ id: "p1", name: "Jair" }] });

    expect(() =>
      applyCommand(game, {
        type: "object.setStatus",
        objectId: "missing",
        status: { tapped: true },
      }),
    ).toThrow("object not found");
  });
});
