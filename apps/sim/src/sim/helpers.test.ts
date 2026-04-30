import { describe, expect, it } from "vitest";
import { createGame } from "@deckdiff/core";
import {
  moveObjects,
  moveIdsBefore,
  toggleFaceDown,
  toggleFlipped,
  toggleRevealedToAll,
  toggleTapped,
} from "./actions.js";
import {
  canPreviewObject,
  findObjectLocation,
  isLibraryTopObject,
  isObjectRevealed,
  toZoneRef,
  zoneObjects,
} from "./gameQueries.js";
import { intersects, isWithinBattlefield, snapPosition } from "./geometry.js";
import { parseDropTarget, zoneTargetId } from "./targets.js";

describe("sim helpers", () => {
  it("moves ids before a target while preserving moved order", () => {
    expect(moveIdsBefore(["a", "b", "c"], ["c"], "a")).toEqual(["c", "a", "b"]);
    expect(moveIdsBefore(["a", "b", "c", "d"], ["b", "d"], "a")).toEqual(["b", "d", "a", "c"]);
  });

  it("does not move ids before themselves or missing targets", () => {
    const ids = ["a", "b", "c"];
    expect(moveIdsBefore(ids, ["b"], "b")).toBe(ids);
    expect(moveIdsBefore(ids, ["b"], "missing")).toBe(ids);
  });

  it("round-trips drop target ids", () => {
    expect(parseDropTarget(zoneTargetId({ zone: "battlefield" }), "fallback")).toEqual({
      zone: "battlefield",
    });
    expect(parseDropTarget(zoneTargetId({ zone: "hand", playerId: "p1" }), "fallback")).toEqual({
      zone: "hand",
      playerId: "p1",
    });
    expect(parseDropTarget("zone:hand", "fallback")).toEqual({
      zone: "hand",
      playerId: "fallback",
    });
    expect(parseDropTarget("zone::hand", "fallback")).toBeNull();
    expect(parseDropTarget("card:abc", "fallback")).toBeNull();
  });

  it("finds objects and returns zone objects", () => {
    const game = createGame({
      players: [{ id: "p1", name: "Player", hand: ["Opt"], battlefield: ["Island"] }],
    });
    const handObject = game.players[0]!.zones.hand.objects[0]!;
    const battlefieldObject = game.zones.battlefield.objects[0]!;

    expect(findObjectLocation(game, handObject.objectId)?.zone).toEqual({
      zone: "hand",
      playerId: "p1",
    });
    expect(findObjectLocation(game, battlefieldObject.objectId)?.zone).toEqual({
      zone: "battlefield",
    });
    expect(zoneObjects(game, { zone: "hand", playerId: "p1" })).toEqual([handObject]);
    expect(toZoneRef({ zone: "hand", playerId: "p1" })).toEqual({ zone: "hand", playerId: "p1" });
  });

  it("handles geometry helpers", () => {
    expect(snapPosition({ x: 13, y: 35 })).toEqual({ x: 24, y: 24 });
    expect(
      intersects(
        { left: 0, top: 0, right: 10, bottom: 10 },
        { left: 10, top: 10, right: 20, bottom: 20 },
      ),
    ).toBe(true);
    expect(isWithinBattlefield({ x: 8, y: 72 }, { width: 500, height: 500 })).toBe(true);
    expect(isWithinBattlefield({ x: 8, y: 73 }, { width: 500, height: 500 })).toBe(false);
  });

  it("toggles only battlefield objects", () => {
    const game = createGame({
      players: [{ id: "p1", name: "Player", hand: ["Opt"], battlefield: ["Island"] }],
    });
    const handObject = game.players[0]!.zones.hand.objects[0]!;
    const battlefieldObject = game.zones.battlefield.objects[0]!;
    const nextGame = toggleTapped(game, [handObject.objectId, battlefieldObject.objectId]);

    expect(nextGame.players[0]!.zones.hand.objects[0]!.status.tapped).toBe(false);
    expect(nextGame.zones.battlefield.objects[0]!.status.tapped).toBe(true);
  });

  it("toggles face-down status for objects", () => {
    const game = createGame({
      players: [{ id: "p1", name: "Player", hand: ["Opt"], battlefield: ["Island"] }],
    });
    const handObject = game.players[0]!.zones.hand.objects[0]!;
    const battlefieldObject = game.zones.battlefield.objects[0]!;

    const faceDown = toggleFaceDown(game, [handObject.objectId, battlefieldObject.objectId]);
    expect(faceDown.players[0]!.zones.hand.objects[0]!.status.faceDown).toBe(true);
    expect(faceDown.zones.battlefield.objects[0]!.status.faceDown).toBe(true);

    const faceUp = toggleFaceDown(faceDown, [handObject.objectId]);
    expect(faceUp.players[0]!.zones.hand.objects[0]!.status.faceDown).toBe(false);
    expect(faceUp.zones.battlefield.objects[0]!.status.faceDown).toBe(true);
  });

  it("toggles flipped status for objects", () => {
    const game = createGame({
      players: [{ id: "p1", name: "Player", battlefield: ["Delver of Secrets"] }],
    });
    const object = game.zones.battlefield.objects[0]!;

    const flipped = toggleFlipped(game, [object.objectId]);
    expect(flipped.zones.battlefield.objects[0]!.status.flipped).toBe(true);

    const unflipped = toggleFlipped(flipped, [object.objectId]);
    expect(unflipped.zones.battlefield.objects[0]!.status.flipped).toBe(false);
  });

  it("toggles public reveal on objects", () => {
    const game = createGame({ players: [{ id: "p1", name: "Player", library: ["Opt"] }] });
    const object = game.players[0]!.zones.library.objects[0]!;

    const revealed = toggleRevealedToAll(game, object.objectId);
    expect(revealed.players[0]!.zones.library.objects[0]!.visibility).toEqual({
      revealedTo: "all",
    });
    expect(isObjectRevealed(revealed.players[0]!.zones.library.objects[0]!, "p1")).toBe(true);

    const hidden = toggleRevealedToAll(revealed, object.objectId);
    expect(hidden.players[0]!.zones.library.objects[0]!.visibility).toBeUndefined();
  });

  it("checks preview visibility for library and face-down cards", () => {
    let game = createGame({
      players: [
        { id: "p1", name: "One", library: ["Opt", "Island"], battlefield: ["Island"] },
        { id: "p2", name: "Two", battlefield: ["Swamp"] },
      ],
    });
    const libraryObject = game.players[0]!.zones.library.objects[0]!;
    const secondLibraryObject = game.players[0]!.zones.library.objects[1]!;
    const controlledObject = game.zones.battlefield.objects[0]!;
    const opponentObject = game.zones.battlefield.objects[1]!;

    expect(isLibraryTopObject(game, libraryObject.objectId)).toBe(true);
    expect(isLibraryTopObject(game, secondLibraryObject.objectId)).toBe(false);
    expect(canPreviewObject(findObjectLocation(game, libraryObject.objectId)!, "p1")).toBe(false);

    game = toggleRevealedToAll(game, libraryObject.objectId);
    expect(canPreviewObject(findObjectLocation(game, libraryObject.objectId)!, "p1")).toBe(true);

    game = toggleFaceDown(game, [controlledObject.objectId, opponentObject.objectId]);
    expect(canPreviewObject(findObjectLocation(game, controlledObject.objectId)!, "p1")).toBe(true);
    expect(canPreviewObject(findObjectLocation(game, opponentObject.objectId)!, "p1")).toBe(false);
  });

  it("moves only objects that can legally enter a target", () => {
    const game = createGame({
      players: [
        { id: "p1", name: "One", hand: ["Opt"] },
        { id: "p2", name: "Two" },
      ],
    });
    const object = game.players[0]!.zones.hand.objects[0]!;

    const blocked = moveObjects(game, [object.objectId], { zone: "hand", playerId: "p2" }, "p1");
    expect(blocked.players[0]!.zones.hand.objects).toHaveLength(1);
    expect(blocked.players[1]!.zones.hand.objects).toHaveLength(0);

    const moved = moveObjects(game, [object.objectId], { zone: "battlefield" }, "p1");
    expect(moved.players[0]!.zones.hand.objects).toHaveLength(0);
    expect(moved.zones.battlefield.objects).toHaveLength(1);
  });

  it("only lets the actor move controlled cards", () => {
    const game = createGame({
      players: [
        { id: "p1", name: "One", battlefield: ["Control Magic"] },
        { id: "p2", name: "Two" },
      ],
    });
    const object = game.zones.battlefield.objects[0]!;

    const blocked = moveObjects(game, [object.objectId], { zone: "exile" }, "p2");
    expect(blocked.zones.battlefield.objects).toHaveLength(1);
    expect(blocked.zones.exile.objects).toHaveLength(0);
  });

  it("can transfer control when moving to a player's battlefield", () => {
    const game = createGame({
      players: [
        { id: "p1", name: "One", hand: ["Threaten Target"] },
        { id: "p2", name: "Two" },
      ],
    });
    const object = game.players[0]!.zones.hand.objects[0]!;

    const moved = moveObjects(
      game,
      [object.objectId],
      { zone: "battlefield", playerId: "p2" },
      "p1",
    );
    expect(moved.players[0]!.zones.hand.objects).toHaveLength(0);
    expect(moved.zones.battlefield.objects[0]?.ownerPlayerId).toBe("p1");
    expect(moved.zones.battlefield.objects[0]?.controllerPlayerId).toBe("p2");
  });
});
