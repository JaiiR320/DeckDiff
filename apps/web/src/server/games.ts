import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "#/lib/auth";

type GameMetadata = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type GameResponse = {
  game: GameMetadata;
  view: {
    revision: number;
    players: Array<{
      id: string;
      name: string;
      life: number;
    }>;
    zones: Record<string, { objects: Array<Record<string, string | number | boolean | null>> }>;
  };
};

type CreateGameInput = {
  name: string;
};

type GetGameInput = {
  gameId: string;
};

const createGameInputSchema = z.object({
  name: z.string().trim().min(1, "Game name is required."),
});

const getGameInputSchema = z.object({
  gameId: z.string().trim().min(1, "Game ID is required."),
});

const gameApiUrl = (process.env.GAME_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

async function requireUser() {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  return session.user;
}

function getPlayerName(user: { name?: string | null; email: string }) {
  return user.name?.trim() || user.email.split("@")[0] || "Player";
}

async function requestGameApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${gameApiUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Game API error: ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // Ignore invalid error bodies.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export const listGames = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  return requestGameApi<{ games: GameResponse[] }>("/games");
});

export const getGame = createServerFn({ method: "GET" })
  .inputValidator((data: GetGameInput) => getGameInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireUser();
    return requestGameApi<GameResponse>(`/games/${encodeURIComponent(data.gameId)}`);
  });

export const createGameForCurrentUser = createServerFn({ method: "POST" })
  .inputValidator((data: CreateGameInput) => createGameInputSchema.parse(data))
  .handler(async ({ data }) => {
    const user = await requireUser();
    return requestGameApi<GameResponse>("/games", {
      method: "POST",
      body: JSON.stringify({
        name: data.name.trim(),
        player: {
          id: user.id,
          name: getPlayerName(user),
        },
      }),
    });
  });
