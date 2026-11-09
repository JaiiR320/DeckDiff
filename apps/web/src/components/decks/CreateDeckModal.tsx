import type { FormEvent } from "react";
import { Button } from "@jaiir320/design-system/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@jaiir320/design-system/components/dialog";
import { Field, FieldLabel } from "@jaiir320/design-system/components/field";
import { Input } from "@jaiir320/design-system/components/input";

type CreateDeckModalProps = {
  deckName: string;
  title?: string;
  label?: string;
  placeholder?: string;
  onDeckNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CreateDeckModal({
  deckName,
  title = "New Deck",
  label = "Deck name",
  placeholder = "Enter a deck name",
  onDeckNameChange,
  onClose,
  onSubmit,
}: CreateDeckModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <form className="mt-5" onSubmit={onSubmit}>
          <Field>
            <FieldLabel>{label}</FieldLabel>
            <Input
              value={deckName}
              onChange={(event) => onDeckNameChange(event.target.value)}
              placeholder={placeholder}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button />}>Cancel</DialogClose>
            <Button type="submit" variant="default">
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
