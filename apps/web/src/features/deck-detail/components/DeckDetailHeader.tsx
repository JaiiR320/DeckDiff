import { Badge } from "@jaiir320/design-system/components/badge";
import { Button } from "@jaiir320/design-system/components/button";
import { Save, Settings } from "lucide-react";
import type { DeckItem } from "#/lib/deck";

type DeckDetailHeaderProps = {
  deck: DeckItem;
  deckName: string;
  canSave: boolean;
  onOpenActions: () => void;
  onOpenSave: () => void;
};

export function DeckDetailHeader({
  deck,
  deckName,
  canSave,
  onOpenActions,
  onOpenSave,
}: DeckDetailHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{deckName}</h1>
        {deck.saves.length > 0 && (
          <Badge>
            {deck.saves.length} snapshot{deck.saves.length === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={onOpenActions}>
          <Settings className="size-4" strokeWidth={1.75} />
          Settings
        </Button>
        <Button onClick={onOpenSave} disabled={!canSave} variant="default">
          <Save className="size-4" strokeWidth={1.75} />
          Save
        </Button>
      </div>
    </div>
  );
}
