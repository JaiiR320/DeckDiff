import { useRef, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@jaiir320/design-system/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@jaiir320/design-system/components/dialog";
import { Textarea } from "@jaiir320/design-system/components/textarea";
import { buttonLooks } from "#/components/buttonLooks";

type ImportDeckModalProps = {
  hasCards: boolean;
  draftDeck: string;
  onDraftDeckChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onOverride?: () => void;
};

export function ImportDeckModal({
  hasCards,
  draftDeck,
  onDraftDeckChange,
  onClose,
  onSubmit,
  onOverride,
}: ImportDeckModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="2xl" initialFocus={textareaRef}>
        <DialogHeader>
          <div>
            <DialogTitle>Import Deck</DialogTitle>
            <DialogDescription className="mt-1">
              {hasCards
                ? "Bulk add to your deck, or override it with the pasted list."
                : "Paste the baseline deck list."}
            </DialogDescription>
          </div>
          <DialogClose
            render={
              <Button
                variant={null}
                size="icon"
                className={buttonLooks.iconGhost}
                aria-label="Close import modal"
              />
            }
          >
            <X className="size-5" />
          </DialogClose>
        </DialogHeader>

        <form className="mt-5" onSubmit={onSubmit}>
          <Textarea
            ref={textareaRef}
            aria-label="Deck list"
            spellCheck={false}
            value={draftDeck}
            onChange={(event) => onDraftDeckChange(event.target.value)}
            placeholder="Paste a deck list here"
            className="min-h-80 resize-y"
          />

          <DialogFooter>
            <DialogClose render={<Button />}>Cancel</DialogClose>
            {hasCards ? (
              <>
                <Button onClick={onOverride} disabled={!draftDeck.trim()}>
                  Override
                </Button>
                <Button type="submit" variant="default" disabled={!draftDeck.trim()}>
                  Bulk Add
                </Button>
              </>
            ) : (
              <Button type="submit" variant="default" disabled={!draftDeck.trim()}>
                Validate Import
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
