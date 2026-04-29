import { X } from "lucide-react";
import type { DeckState } from "./types";

type DeckAlertsProps = {
  deck: DeckState;
  onDismissWarnings: () => void;
};

export function DeckAlerts({ deck, onDismissWarnings }: DeckAlertsProps) {
  const hasError = deck.errorMessage !== null;
  const hasWarnings = deck.invalidCards.length > 0;

  if (!hasError && !hasWarnings) {
    return null;
  }

  return (
    <div className="space-y-4 px-5 pb-2 pt-5">
      {hasError ? (
        <div className="rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-300">
          {deck.errorMessage}
        </div>
      ) : null}

      {hasWarnings ? (
        <section className="rounded-xl border border-amber-900/60 bg-amber-950/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-sm font-semibold text-amber-200">Warnings</h3>
            <button
              type="button"
              onClick={onDismissWarnings}
              className="rounded-lg p-1.5 text-amber-300 transition hover:bg-amber-900/30 hover:text-amber-100"
              aria-label="Dismiss warnings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-amber-100/90">
            {deck.invalidCards.map((card) => (
              <li key={`${card.lineNumber}-${card.name}`}>
                <span className="font-medium">Line {card.lineNumber}:</span> {card.name}{" "}
                <span className="text-amber-300">{card.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
