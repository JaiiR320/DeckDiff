import { useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@jaiir320/design-system/components/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@jaiir320/design-system/components/dialog";
import { SwitchChip } from "@jaiir320/design-system/components/switch";
import { Textarea } from "@jaiir320/design-system/components/textarea";
import type { ExportModalState } from "../editor/types";
import { buttonLooks } from "#/components/buttonLooks";

type ExportDeckModalProps = {
  exportOptions: ExportModalState;
  exportPreview: string;
  onClose: () => void;
  onCopy: () => void;
  onToggleAddedOnly: () => void;
  onToggleGroupByCategory: () => void;
  onToggleIncludeOutOfDeckCategories: () => void;
  onToggleIncludeQuantity: () => void;
  onToggleSeparateSideboard: () => void;
};

export function ExportDeckModal({
  exportOptions,
  exportPreview,
  onClose,
  onCopy,
  onToggleAddedOnly,
  onToggleGroupByCategory,
  onToggleIncludeOutOfDeckCategories,
  onToggleIncludeQuantity,
  onToggleSeparateSideboard,
}: ExportDeckModalProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent ref={popupRef} tabIndex={-1} initialFocus={popupRef} size="2xl" padding="none">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>Export Deck</DialogTitle>
          <DialogClose
            render={
              <Button
                variant={null}
                size="icon"
                className={buttonLooks.iconGhost}
                aria-label="Close export modal"
              />
            }
          >
            <X className="size-5" />
          </DialogClose>
        </DialogHeader>

        <DialogBody className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap gap-3">
            <SwitchChip
              checked={exportOptions.includeQuantity}
              onCheckedChange={onToggleIncludeQuantity}
            >
              Quantity
            </SwitchChip>
            <SwitchChip checked={exportOptions.addedOnly} onCheckedChange={onToggleAddedOnly}>
              Added only
            </SwitchChip>
            <SwitchChip
              checked={exportOptions.groupByCategory}
              onCheckedChange={onToggleGroupByCategory}
            >
              Group by category
            </SwitchChip>
            <SwitchChip
              checked={exportOptions.includeOutOfDeckCategories}
              disabled={!exportOptions.groupByCategory}
              onCheckedChange={onToggleIncludeOutOfDeckCategories}
            >
              Include out-of-deck
            </SwitchChip>
            <SwitchChip
              checked={exportOptions.separateSideboard}
              disabled={exportOptions.groupByCategory}
              onCheckedChange={onToggleSeparateSideboard}
            >
              Separate sideboard
            </SwitchChip>
          </div>

          <Textarea
            readOnly
            aria-label="Export preview"
            value={exportPreview}
            className="min-h-80 resize-y bg-background text-strong-foreground"
          />
        </DialogBody>

        <DialogFooter layout="between" className="mt-0 border-t border-border px-6 py-5">
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button
            variant="default"
            onClick={onCopy}
            className="bg-ring px-5 py-2.5 hover:bg-primary"
          >
            Copy to Clipboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
