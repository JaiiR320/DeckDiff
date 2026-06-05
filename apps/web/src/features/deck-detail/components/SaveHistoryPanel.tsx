import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Alert } from "#/components/ui/Alert";
import { Button } from "#/components/ui/Button";
import type { DeckItem, DeckSave } from "#/lib/deck";
import { groupSaveHistoryItems, isAutoSaveLabel } from "./saveHistoryItems";

type SaveHistoryPanelProps = {
  deck: DeckItem;
  onLoadSave: (save: DeckSave) => void;
  onSaveSnapshotBeforeLoad: (save: DeckSave) => void;
  onCompareSaves: (saveA: DeckSave, saveB: DeckSave) => void;
  onBackToEditor: () => void;
};

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

export function SaveHistoryPanel({
  deck,
  onLoadSave,
  onSaveSnapshotBeforeLoad,
  onCompareSaves,
  onBackToEditor,
}: SaveHistoryPanelProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [collapseUnnamedSaves, setCollapseUnnamedSaves] = useState(true);
  const [pendingLoadSaveId, setPendingLoadSaveId] = useState<string | null>(null);
  const [selectedSaves, setSelectedSaves] = useState<string[]>([]);

  // Newest first
  const saves = [...deck.saves].reverse();
  const hasAutoSaves = saves.some((save) => isAutoSaveLabel(save.label));
  const historyItems = groupSaveHistoryItems(saves, collapseUnnamedSaves);

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

  if (saves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-zinc-500">No saves yet. Save your deck to create a snapshot.</p>
        <Button onClick={onBackToEditor}>
          <ArrowLeft className="size-4" />
          Back to Editor
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Snapshot History</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {saves.length} snapshot{saves.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasAutoSaves && (
            <Button
              onClick={() => setCollapseUnnamedSaves((current) => !current)}
              size="sm"
              variant="secondary"
            >
              {collapseUnnamedSaves ? "Show unnamed saves" : "Collapse unnamed saves"}
            </Button>
          )}
          {saves.length >= 2 && (
            <Button
              onClick={toggleCompareMode}
              size="sm"
              variant={compareMode ? "primary" : "secondary"}
            >
              {compareMode ? "Cancel Compare" : "Compare"}
            </Button>
          )}
          <Button onClick={onBackToEditor} size="sm">
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>
      </div>

      {/* Compare instructions */}
      {compareMode && (
        <Alert tone="info" className="p-4">
          <p>Select 2 snapshots to compare. Shows diff between older (left) and newer (right).</p>
          {selectedSaves.length === 2 && (
            <Button
              onClick={handleCompare}
              variant="primary"
              size="sm"
              className="mt-3 rounded-lg py-1.5"
            >
              Compare Selected
            </Button>
          )}
        </Alert>
      )}

      {/* Saves list */}
      <div className="space-y-2">
        {historyItems.map((item) => {
          if (item.kind === "collapsed") {
            return (
              <div key={item.id} className="flex items-center gap-3 py-2 text-sm text-zinc-500">
                <div className="h-px flex-1 bg-zinc-800" />
                <span>
                  {item.count} unnamed save{item.count === 1 ? "" : "s"} collapsed
                </span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
            );
          }

          const { save } = item;
          const isSelected = selectedSaves.includes(save.id);
          const isPendingLoad = pendingLoadSaveId === save.id;
          const selectionOrder = selectedSaves.indexOf(save.id) + 1;
          const saveContent = (
            <>
              <div className="flex items-center gap-3">
                {compareMode && (
                  <div
                    className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                      isSelected ? "bg-cyan-400 text-cyan-950" : "bg-zinc-800 text-zinc-500"
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
                <Button
                  onClick={() => setPendingLoadSaveId(save.id)}
                  size="sm"
                  className="rounded-lg py-1.5"
                >
                  Load
                </Button>
              )}
            </>
          );

          if (compareMode) {
            return (
              <button
                key={save.id}
                type="button"
                onClick={() => toggleSaveSelection(save.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? "border-cyan-500 bg-cyan-950/20 cursor-pointer"
                    : "border-zinc-800 bg-zinc-950 cursor-pointer hover:border-zinc-700"
                }`}
              >
                {saveContent}
              </button>
            );
          }

          return (
            <div
              key={save.id}
              className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 transition"
            >
              <div className="flex items-center justify-between">{saveContent}</div>
              {isPendingLoad ? (
                <Alert tone="warning" className="p-4">
                  <p>Loading this snapshot will overwrite your current live deck.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => setPendingLoadSaveId(null)}
                      size="sm"
                      className="rounded-lg py-1.5"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setPendingLoadSaveId(null);
                        onSaveSnapshotBeforeLoad(save);
                      }}
                      className="rounded-lg py-1.5"
                    >
                      Save Snapshot
                    </Button>
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => {
                        setPendingLoadSaveId(null);
                        onLoadSave(save);
                      }}
                      className="rounded-lg py-1.5"
                    >
                      Load Anyways
                    </Button>
                  </div>
                </Alert>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
