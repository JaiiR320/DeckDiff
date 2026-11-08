import { useRef, type FormEvent } from "react";
import { Button } from "@jaiir320/design-system/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@jaiir320/design-system/components/dialog";
import { Field, FieldLabel } from "@jaiir320/design-system/components/field";
import { Input } from "@jaiir320/design-system/components/input";

type SaveDeckModalProps = {
  defaultLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (label: string) => void;
};

export function SaveDeckModal({ defaultLabel, isOpen, onClose, onSave }: SaveDeckModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const label = String(formData.get("label") ?? "");
    const trimmed = label.trim();
    onSave(trimmed || defaultLabel);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent initialFocus={inputRef}>
        <DialogTitle>Save Deck</DialogTitle>
        <DialogDescription className="mt-2 text-subtle-foreground">
          Create a snapshot of your current deck state.
        </DialogDescription>

        <form className="mt-5" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel>Save label (optional)</FieldLabel>
            <Input
              inputSize="lg"
              ref={inputRef}
              id="save-label"
              name="label"
              defaultValue={defaultLabel}
              placeholder={defaultLabel}
            />
          </Field>

          <DialogFooter>
            <DialogClose render={<Button />}>Cancel</DialogClose>
            <Button type="submit" variant="default">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
