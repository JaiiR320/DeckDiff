import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import type { DeckItem, DeckSave } from "../../lib/deck";

type SaveHistoryPanelProps = {
  deck: DeckItem;
  onLoadSave: (save: DeckSave) => void;
  onCompareSaves: (saveA: DeckSave, saveB: DeckSave) => void;
  onBackToEditor: () => void;
};

export function SaveHistoryPanel({
  deck,
  onLoadSave,
  onCompareSaves,
  onBackToEditor,
}: SaveHistoryPanelProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedSaves, setSelectedSaves] = useState<string[]>([]);

  // Newest first
  const saves = [...deck.saves].reverse();

  function toggleCompareMode() {
    setCompareMode(!compareMode);
    setSelectedSaves([]);
  }

  function toggleSaveSelection(saveId: string) {
    setSelectedSaves((current) => {
      if (current.includes(saveId)) {
        return current.filter((id) => id !== saveId);
      }
      if (current.length >= 2) {
        // Replace the oldest selection
        return [current[1], saveId];
      }
      return [...current, saveId];
    });
  }

  function handleCompare() {
    if (selectedSaves.length !== 2) return;
    const saveA = deck.saves.find((s) => s.id === selectedSaves[0]);
    const saveB = deck.saves.find((s) => s.id === selectedSaves[1]);
    if (saveA && saveB) {
      onCompareSaves(saveA, saveB);
    }
  }

  function formatDate(isoString: string) {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (saves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-zinc-500">No saves yet. Save your deck to create a snapshot.</p>
        <button
          type="button"
          onClick={onBackToEditor}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Editor
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Save History</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {saves.length} snapshot{saves.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saves.length >= 2 && (
            <button
              type="button"
              onClick={toggleCompareMode}
              className={`rounded-xl px-3 py-2 text-sm transition ${
                compareMode
                  ? "bg-cyan-400 text-zinc-950"
                  : "border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              {compareMode ? "Cancel Compare" : "Compare"}
            </button>
          )}
          <button
            type="button"
            onClick={onBackToEditor}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </div>

      {/* Compare instructions */}
      {compareMode && (
        <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-4">
          <p className="text-sm text-cyan-300">
            Select 2 saves to compare. Shows diff between older (left) and newer (right).
          </p>
          {selectedSaves.length === 2 && (
            <button
              type="button"
              onClick={handleCompare}
              className="mt-3 rounded-lg bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
            >
              Compare Selected
            </button>
          )}
        </div>
      )}

      {/* Saves list */}
      <div className="space-y-2">
        {saves.map((save) => {
          const isSelected = selectedSaves.includes(save.id);
          const selectionOrder = selectedSaves.indexOf(save.id) + 1;

          return (
            <div
              key={save.id}
              onClick={() => compareMode && toggleSaveSelection(save.id)}
              className={`flex items-center justify-between rounded-xl border p-4 transition ${
                compareMode
                  ? isSelected
                    ? "border-cyan-500 bg-cyan-950/20 cursor-pointer"
                    : "border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700"
                  : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <div className="flex items-center gap-3">
                {compareMode && (
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isSelected ? "bg-cyan-400 text-zinc-950" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {isSelected ? selectionOrder : ""}
                  </div>
                )}
                <div>
                  <p className="font-medium text-zinc-100">{save.label}</p>
                  <p className="text-sm text-zinc-500">{formatDate(save.savedAt)}</p>
                </div>
              </div>

              {!compareMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadSave(save);
                  }}
                  className="rounded-lg border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
                >
                  Load
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
