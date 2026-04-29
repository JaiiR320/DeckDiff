import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentSession } from "#/server/session";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }

    throw redirect({ to: "/decks" });
  },
  component: RootRedirectPage,
});

function RootRedirectPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-8 py-8">
      <p className="text-sm text-zinc-500">Redirecting...</p>
    </main>
  );
}
