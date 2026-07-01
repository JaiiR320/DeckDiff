import { X } from "lucide-react";
import { Button } from "#/components/ui/Button";
import { IconButton } from "#/components/ui/IconButton";
import { Modal } from "#/components/ui/Modal";
import { Textarea } from "#/components/ui/Textarea";
import { ToggleChip } from "#/components/ui/ToggleChip";
import type { ExportModalState } from "../editor/types";

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
  return (
    <Modal ariaLabel="Close export modal" maxWidth="2xl" onClose={onClose} panelClassName="p-0">
      <div className="border-b border-zinc-800 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Export Deck</h2>
          </div>
          <IconButton variant="ghost" onClick={onClose} className="p-2 text-zinc-500">
            <X className="size-5" />
          </IconButton>
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div className="flex flex-wrap gap-3">
          <ToggleChip
            label="Quantity"
            checked={exportOptions.includeQuantity}
            onToggle={onToggleIncludeQuantity}
          />
          <ToggleChip
            label="Added only"
            checked={exportOptions.addedOnly}
            onToggle={onToggleAddedOnly}
          />
          <ToggleChip
            label="Group by category"
            checked={exportOptions.groupByCategory}
            onToggle={onToggleGroupByCategory}
          />
          <ToggleChip
            label="Include out-of-deck"
            checked={exportOptions.includeOutOfDeckCategories}
            disabled={!exportOptions.groupByCategory}
            onToggle={onToggleIncludeOutOfDeckCategories}
          />
          <ToggleChip
            label="Separate sideboard"
            checked={exportOptions.separateSideboard}
            disabled={exportOptions.groupByCategory}
            onToggle={onToggleSeparateSideboard}
          />
        </div>

        <Textarea
          readOnly
          value={exportPreview}
          className="min-h-80 w-full resize-y bg-zinc-950 font-mono text-zinc-200"
        />
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-5">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onCopy}
          className="bg-cyan-500 px-5 py-2.5 hover:bg-cyan-400"
        >
          Copy to Clipboard
        </Button>
      </div>
    </Modal>
  );
}
