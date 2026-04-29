import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";
import { createGameForCurrentUser, listGames, type GameResponse } from "#/server/games";
import { getCurrentSession } from "#/server/session";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/play")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
  loader: async () => listGames(),
  component: PlayPage,
});

function PlayPage() {
  const initialData = Route.useLoaderData();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [games, setGames] = useState<GameResponse[]>(initialData.games);
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userId = session?.user.id;
  const yourGames = userId ? games.filter((entry) => hasPlayer(entry, userId)) : [];
  const publicGames = userId ? games.filter((entry) => !hasPlayer(entry, userId)) : games;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const gameName = name.trim();
    if (!gameName || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const created = (await createGameForCurrentUser({
        data: { name: gameName },
      })) as GameResponse;
      setGames((currentGames) => [created, ...currentGames]);
      setName("");
      await navigate({ to: "/game/$gameId", params: { gameId: created.game.id } });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not create match.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-8">
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-100">Play</h1>
          <p className="mt-2 text-sm text-zinc-400">Create a match or join an available one.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:max-w-xl sm:flex-row"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Game name"
            className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {isSubmitting ? "Creating" : "Create Match"}
          </button>
        </form>
      </div>

      {errorMessage ? (
        <p className="mb-6 rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          {errorMessage}
        </p>
      ) : null}

      <GameSection
        title="Your Matches"
        emptyText="You are not in any matches yet."
        games={yourGames}
      />
      <GameSection
        title="Public Matches"
        emptyText="No public matches available."
        games={publicGames}
      />
    </main>
  );
}

function GameSection({
  title,
  emptyText,
  games,
}: {
  title: string;
  emptyText: string;
  games: GameResponse[];
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-zinc-200">{title}</h2>
      {games.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((entry) => (
            <GameCard key={entry.game.id} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-zinc-900 bg-zinc-950/50 px-4 py-6 text-sm text-zinc-500">
          {emptyText}
        </p>
      )}
    </section>
  );
}

function GameCard({ entry }: { entry: GameResponse }) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 shadow-2xl shadow-black/10">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Match</p>
      <h3 className="mt-2 text-xl font-semibold text-zinc-100">{entry.game.name}</h3>
      <div className="mt-4 space-y-2 text-sm text-zinc-400">
        <p>
          {entry.view.players.length} player{entry.view.players.length === 1 ? "" : "s"}
        </p>
        <p>Updated {new Date(entry.game.updatedAt).toLocaleString()}</p>
      </div>
      <Link
        to="/game/$gameId"
        params={{ gameId: entry.game.id }}
        className="mt-5 inline-flex rounded-xl border border-cyan-800 bg-cyan-950/40 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:border-cyan-600 hover:bg-cyan-950"
      >
        Open Game
      </Link>
    </article>
  );
}

function hasPlayer(entry: GameResponse, userId: string) {
  return entry.view.players.some((player) => player.id === userId);
}
