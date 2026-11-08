import { buttonVariants } from "@jaiir320/design-system/components/button";
import { Link } from "@tanstack/react-router";

export function DeckNotFound() {
  return (
    <main className="mx-auto w-full p-8">
      <div className="flex items-center gap-4">
        <Link
          to="/decks"
          search={{ folder: undefined }}
          className={buttonVariants({
            size: "sm",
            className:
              "text-sm text-subtle-foreground hover:bg-transparent hover:text-strong-foreground",
          })}
        >
          Back
        </Link>
        <p className="text-sm text-muted-foreground">Deck not found.</p>
      </div>
    </main>
  );
}
