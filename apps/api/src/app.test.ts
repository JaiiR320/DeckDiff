import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

async function createGame(app: ReturnType<typeof createApp>, name = "Test Game") {
  const response = await app.request("/games", {
    method: "POST",
    body: JSON.stringify({ name, player: { id: "user_1", name: "Jair" } }),
    headers: { "content-type": "application/json" },
  });
  return response;
}

describe("api", () => {
  it("returns health", async () => {
    const app = createApp();

    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("creates named games with the creator as a player", async () => {
    const app = createApp();

    const created = await createGame(app, "Friday Commander");

    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.game.id).toMatch(/^game_/);
    expect(body.game.name).toBe("Friday Commander");
    expect(body.game.createdAt).toEqual(expect.any(String));
    expect(body.game.updatedAt).toEqual(expect.any(String));
    expect(body.view.viewMode).toBe("debug");
    expect(body.view.players).toHaveLength(1);
    expect(body.view.players[0]).toMatchObject({
      id: "user_1",
      name: "Jair",
      life: 40,
    });
    expect(body.view.players[0].zones.library.objects).toEqual([]);
    expect(body.view.players[0].zones.hand.objects).toEqual([]);
    expect(body.view.players[0].zones.graveyard.objects).toEqual([]);
    expect(body.view.zones.battlefield.objects).toEqual([]);
  });

  it("lists games", async () => {
    const app = createApp();
    await createGame(app, "First");
    await createGame(app, "Second");

    const response = await app.request("/games");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.games).toHaveLength(2);
    expect(body.games.map((entry: { game: { name: string } }) => entry.game.name)).toContain(
      "First",
    );
    expect(body.games[0].view.players[0]).toMatchObject({ id: "user_1", name: "Jair" });
  });

  it("returns created games by id", async () => {
    const app = createApp();
    const created = await (await createGame(app)).json();

    const response = await app.request(`/games/${created.game.id}`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.game.id).toBe(created.game.id);
    expect(body.game.name).toBe("Test Game");
  });

  it("returns 404 for missing games", async () => {
    const app = createApp();

    const response = await app.request("/games/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
  });

  it("validates and applies per-game commands", async () => {
    const app = createApp();
    const created = await (await createGame(app)).json();

    const response = await app.request(`/games/${created.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify({
        type: "player.add",
        player: { id: "player_austin", name: "Austin" },
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.game.id).toBe(created.game.id);
    expect(
      body.view.players.find((player: { id: string }) => player.id === "player_austin"),
    ).toMatchObject({
      id: "player_austin",
      name: "Austin",
      life: 0,
    });
    expect(body.event.type).toBe("player.add");
  });

  it("returns 400 for malformed commands", async () => {
    const app = createApp();
    const created = await (await createGame(app)).json();

    const response = await app.request(`/games/${created.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify({ type: "card.draw" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("returns 404 when applying commands to missing games", async () => {
    const app = createApp();

    const response = await app.request("/games/missing/commands", {
      method: "POST",
      body: JSON.stringify({ type: "note.add", message: "hello" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(404);
  });

  it("returns command errors for duplicate players", async () => {
    const app = createApp();
    const created = await (await createGame(app)).json();
    const command = { type: "player.add", player: { id: "player_austin", name: "Austin" } };

    await app.request(`/games/${created.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify(command),
      headers: { "content-type": "application/json" },
    });
    const response = await app.request(`/games/${created.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify(command),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "command_error" });
  });

  it("keeps event logs isolated per game", async () => {
    const app = createApp();
    const first = await (await createGame(app, "First")).json();
    const second = await (await createGame(app, "Second")).json();

    await app.request(`/games/${first.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify({ type: "note.add", message: "first note" }),
      headers: { "content-type": "application/json" },
    });
    await app.request(`/games/${second.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify({ type: "note.add", message: "second note" }),
      headers: { "content-type": "application/json" },
    });

    const firstEvents = await (await app.request(`/games/${first.game.id}/events`)).json();
    const secondEvents = await (await app.request(`/games/${second.game.id}/events`)).json();

    expect(firstEvents.events).toHaveLength(1);
    expect(firstEvents.events[0].message).toBe("first note");
    expect(secondEvents.events).toHaveLength(1);
    expect(secondEvents.events[0].message).toBe("second note");
  });

  it("validates commands against the current server state", async () => {
    const app = createApp();
    const created = await (await createGame(app)).json();

    const createdObjectResponse = await app.request(`/games/${created.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify({
        type: "object.create",
        object: { kind: "token", name: "Food" },
        to: { zone: "battlefield" },
      }),
      headers: { "content-type": "application/json" },
    });
    const createdObject = await createdObjectResponse.json();
    const objectId = createdObject.view.zones.battlefield.objects[0].objectId;

    await app.request(`/games/${created.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify({ type: "object.delete", objectId }),
      headers: { "content-type": "application/json" },
    });

    const staleResponse = await app.request(`/games/${created.game.id}/commands`, {
      method: "POST",
      body: JSON.stringify({ type: "object.move", objectId, to: { zone: "exile" } }),
      headers: { "content-type": "application/json" },
    });

    expect(staleResponse.status).toBe(400);
    expect(await staleResponse.json()).toMatchObject({
      error: "command_error",
      message: `object not found: ${objectId}`,
    });
  });
});
