import { Link, useLocation } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Button } from "#/components/ui/Button";
import { authClient } from "#/lib/auth-client";

const navLinkClass =
  "inline-flex items-center rounded-xl border px-4 py-2 text-sm font-medium transition";

async function handleSignOut() {
  await authClient.signOut();
  window.location.assign("/auth");
}

export function AppHeader() {
  const location = useLocation();
  const { data: session, isPending } = authClient.useSession();

  const isAuthPage = location.pathname === "/auth";
  const isDecksPage = location.pathname === "/decks";
  const isJudgePage = location.pathname === "/judge";
  const username = session?.user.email.split("@")[0] ?? "";

  return (
    <header className="sticky top-0 z-[1000] border-b border-zinc-900 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex w-full items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-center gap-6">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">DeckDiff</p>

          {!isAuthPage && session ? (
            <nav className="flex items-center gap-3">
              <Link
                to="/decks"
                search={{ folder: undefined }}
                className={`${navLinkClass} ${
                  isDecksPage
                    ? "border-cyan-800 bg-cyan-950/40 text-cyan-200"
                    : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                Decks
              </Link>
              <Link
                to="/judge"
                className={`${navLinkClass} ${
                  isJudgePage
                    ? "border-cyan-800 bg-cyan-950/40 text-cyan-200"
                    : "border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                Judge
              </Link>
            </nav>
          ) : null}
        </div>

        {!isAuthPage && session ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">{username}</span>
            <Button onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        ) : isPending ? (
          <div className="h-10 w-24" />
        ) : null}
      </div>
    </header>
  );
}
