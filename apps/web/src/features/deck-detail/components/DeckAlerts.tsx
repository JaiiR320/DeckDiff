import { Alert, AlertDescription } from "@jaiir320/design-system/components/alert";
import { Button } from "@jaiir320/design-system/components/button";
import { X } from "lucide-react";
import type { DeckState } from "../editor/types";
import { buttonLooks } from "#/components/buttonLooks";

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
        <Alert tone="destructive" role="alert" className="bg-destructive-surface/40">
          {deck.errorMessage}
        </Alert>
      ) : null}

      {hasWarnings ? (
        <Alert tone="warning" render={<section aria-labelledby="deck-warnings-title" />}>
          <div className="flex items-start justify-between gap-4">
            <h3
              id="deck-warnings-title"
              className="text-sm font-semibold text-warning-muted-foreground"
            >
              Warnings
            </h3>
            <Button
              onClick={onDismissWarnings}
              variant={null}
              size="icon-sm"
              className={buttonLooks.warningGhost}
              aria-label="Dismiss warnings"
            >
              <X className="size-4" />
            </Button>
          </div>
          <AlertDescription className="mt-3">
            <ul className="space-y-2 text-sm text-amber-100/90">
              {deck.invalidCards.map((card) => (
                <li key={`${card.lineNumber}-${card.name}`}>
                  <span className="font-medium">Line {card.lineNumber}:</span> {card.name}{" "}
                  <span className="text-warning-text">{card.reason}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
