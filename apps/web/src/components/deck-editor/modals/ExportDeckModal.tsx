import { X } from "lucide-react";
import { ToggleChip } from "../../ToggleChip";
import type { ExportModalState } from "../types";

type ExportDeckModalProps = {
  exportOptions: ExportModalState;
  exportPreview: string;
  onClose: () => void;
  onCopy: () => void;
  onToggleIncludeQuantity: () => void;
};

export function ExportDeckModal({
  exportOptions,
  exportPreview,
  onClose,
  onCopy,
  onToggleIncludeQuantity,
}: ExportDeckModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <button
        type="button"
        aria-label="Close export modal"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-0 shadow-2xl shadow-black/40">
        <div className="border-b border-zinc-800 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">Export Deck</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="flex flex-wrap gap-3">
            <ToggleChip
              label="Quantity"
              checked={exportOptions.includeQuantity}
              onToggle={onToggleIncludeQuantity}
            />
          </div>

          <textarea
            readOnly
            value={exportPreview}
            className="min-h-80 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-200 outline-none"
          />
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-400"
          >
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  );
}
