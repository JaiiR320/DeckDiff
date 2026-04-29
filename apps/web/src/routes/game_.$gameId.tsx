import { createFileRoute, redirect } from "@tanstack/react-router";
import { getGame, type GameResponse } from "#/server/games";
import { getCurrentSession } from "#/server/session";

export const Route = createFileRoute("/game_/$gameId")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
  loader: async ({ params }) => getGame({ data: { gameId: params.gameId } }),
  component: GamePage,
});

function GamePage() {
  const { game, view } = Route.useLoaderData() as GameResponse;
  const sharedObjectCount = Object.values(view.zones).reduce(
    (count, zone) => count + zone.objects.length,
    0,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-8">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 shadow-2xl shadow-black/20">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Game</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-100">{game.name}</h1>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          <Info label="ID" value={game.id} />
          <Info label="Revision" value={String(view.revision)} />
          <Info label="Objects" value={String(sharedObjectCount)} />
        </dl>

        <div className="mt-8 border-t border-zinc-800 pt-6">
          <h2 className="text-lg font-semibold text-zinc-200">Players</h2>
          {view.players.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {view.players.map((player) => (
                <article
                  key={player.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <p className="font-medium text-zinc-100">{player.name}</p>
                  <p className="mt-1 text-sm text-zinc-500">{player.id}</p>
                  <p className="mt-3 text-sm text-zinc-400">Life: {player.life}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">No players yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <dt className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</dt>
      <dd className="mt-2 break-all text-zinc-200">{value}</dd>
    </div>
  );
}
