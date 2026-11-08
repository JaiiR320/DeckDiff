import { Alert, AlertActions, AlertDescription } from "@jaiir320/design-system/components/alert";
import { Badge } from "@jaiir320/design-system/components/badge";
import { Button } from "@jaiir320/design-system/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@jaiir320/design-system/components/item";
import { Separator } from "@jaiir320/design-system/components/separator";
import { Toggle } from "@jaiir320/design-system/components/toggle";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const loadTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cancelLoadRef = useRef<HTMLButtonElement>(null);

  // The inline confirm takes focus on its safe choice when revealed.
  useEffect(() => {
    if (pendingLoadSaveId) cancelLoadRef.current?.focus();
  }, [pendingLoadSaveId]);

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

  function closeLoadConfirm() {
    setPendingLoadSaveId(null);
    loadTriggerRef.current?.focus();
  }

  if (saves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">No saves yet. Save your deck to create a snapshot.</p>
        <Button onClick={onBackToEditor}>
          <ArrowLeft />
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
          <h2 className="text-lg font-semibold text-foreground">Snapshot History</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {saves.length} snapshot{saves.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasAutoSaves && (
            <Button size="sm" onClick={() => setCollapseUnnamedSaves((current) => !current)}>
              {collapseUnnamedSaves ? "Show unnamed saves" : "Collapse unnamed saves"}
            </Button>
          )}
          {saves.length >= 2 && (
            <Button
              size="sm"
              variant={compareMode ? "default" : "outline"}
              aria-pressed={compareMode}
              onClick={toggleCompareMode}
            >
              {compareMode ? "Cancel Compare" : "Compare"}
            </Button>
          )}
          <Button size="sm" onClick={onBackToEditor}>
            <ArrowLeft />
            Back
          </Button>
        </div>
      </div>

      {/* Compare instructions */}
      {compareMode && (
        <Alert tone="info">
          <AlertDescription>
            Select 2 snapshots to compare. Shows diff between older (left) and newer (right).
          </AlertDescription>
          {selectedSaves.length === 2 && (
            <AlertActions>
              <Button variant="default" size="sm" onClick={handleCompare}>
                Compare Selected
              </Button>
            </AlertActions>
          )}
        </Alert>
      )}

      {/* Saves list */}
      <ItemGroup {...(compareMode && { role: "group", "aria-label": "Snapshots to compare" })}>
        {historyItems.map((item) => {
          if (item.kind === "collapsed") {
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2 text-sm text-muted-foreground"
              >
                <Separator className="flex-1" />
                <span>
                  {item.count} unnamed save{item.count === 1 ? "" : "s"} collapsed
                </span>
                <Separator className="flex-1" />
              </div>
            );
          }

          const { save } = item;
          const title = (
            <ItemContent>
              <ItemTitle>{save.label}</ItemTitle>
              <ItemDescription className="mt-0">{formatDate(save.savedAt)}</ItemDescription>
            </ItemContent>
          );

          if (compareMode) {
            const selectionOrder = selectedSaves.indexOf(save.id) + 1;
            const isSelected = selectionOrder > 0;
            return (
              <Item
                key={save.id}
                className="not-data-pressed:hover:bg-background data-pressed:border-ring data-pressed:bg-info-surface/20 data-pressed:hover:border-ring"
                render={
                  <Toggle
                    pressed={isSelected}
                    onPressedChange={() => toggleSaveSelection(save.id)}
                  />
                }
              >
                <div className="flex items-center gap-3">
                  <ItemMedia>
                    <Badge
                      variant={null}
                      className="flex size-6 items-center justify-center rounded-full bg-secondary p-0 text-xs font-semibold text-muted-foreground data-selected:bg-primary data-selected:text-primary-foreground"
                      data-selected={isSelected ? "" : undefined}
                    >
                      {isSelected ? selectionOrder : ""}
                    </Badge>
                  </ItemMedia>
                  {title}
                </div>
              </Item>
            );
          }

          const isPendingLoad = pendingLoadSaveId === save.id;
          return (
            // No column gap: the old title and Load sat flush, so long titles wrap only where they did before.
            <Item key={save.id} className="flex-wrap gap-x-0 gap-y-3">
              {title}
              <ItemActions>
                <Button
                  size="sm"
                  aria-expanded={isPendingLoad}
                  onClick={(event) => {
                    loadTriggerRef.current = event.currentTarget;
                    setPendingLoadSaveId(save.id);
                  }}
                >
                  Load
                </Button>
              </ItemActions>
              {isPendingLoad ? (
                <Alert
                  role="alert"
                  tone="warning"
                  className="basis-full"
                  aria-label={`Confirm load ${save.label}`}
                >
                  <AlertDescription>
                    Loading this snapshot will overwrite your current live deck.
                  </AlertDescription>
                  <AlertActions>
                    <Button ref={cancelLoadRef} size="sm" onClick={closeLoadConfirm}>
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        closeLoadConfirm();
                        onSaveSnapshotBeforeLoad(save);
                      }}
                    >
                      Save Snapshot
                    </Button>
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => {
                        closeLoadConfirm();
                        onLoadSave(save);
                      }}
                    >
                      Load Anyways
                    </Button>
                  </AlertActions>
                </Alert>
              ) : null}
            </Item>
          );
        })}
      </ItemGroup>
    </div>
  );
}
