import { Button, buttonVariants } from "@jaiir320/design-system/components/button";
import { Link, useLocation } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { authClient } from "#/lib/auth-client";

// Links are not controls, so their own type classes apply.
const navLinkClass = buttonVariants({
  className:
    "text-sm font-medium aria-[current=page]:border-selected-border aria-[current=page]:bg-selected aria-[current=page]:text-selected-foreground",
});

async function handleSignOut() {
  await authClient.signOut();
  window.location.assign("/auth");
}

export function AppHeader() {
  const location = useLocation();
  const { data: session, isPending } = authClient.useSession();

  const isAuthPage = location.pathname === "/auth";
  const username = session?.user.email.split("@")[0] ?? "";

  return (
    <header className="sticky top-0 z-(--z-sticky) border-b border-border-subtle bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-center gap-6">
          <p className="text-sm font-medium uppercase tracking-brand text-highlight">DeckDiff</p>

          {!isAuthPage && session ? (
            <nav className="flex items-center gap-3">
              <Link
                to="/decks"
                search={{ folder: undefined }}
                activeOptions={{ exact: true, includeSearch: false }}
                className={navLinkClass}
              >
                Decks
              </Link>
              <Link to="/judge" activeOptions={{ exact: true }} className={navLinkClass}>
                Judge
              </Link>
            </nav>
          ) : null}
        </div>

        {!isAuthPage && session ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-subtle-foreground">{username}</span>
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
