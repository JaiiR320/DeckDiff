import { Card } from "@jaiir320/design-system/components/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jaiir320/design-system/components/tabs";
import { useMemo, useState } from "react";
import { EditorHeader } from "./components/EditorHeader";
import { SaveHistoryPanel } from "./components/SaveHistoryPanel";
import { DeckStatsPanel } from "./stats/DeckStatsPanel";
import {
  useDeckDetailModel,
  useDeckDetailServices,
  useDeckUiActions,
  useDeckUiView,
  useDeckWorkspaceActions,
  useDeckWorkspaceView,
} from "./deckDetailContext";
import type { DeckDetailTab } from "./deckDetailContext";
import type { CardGroupView } from "./stack/cardGroupView";
import { StackEditor } from "./StackEditor";

export function DeckEditorSurface() {
  const { baselineDeck, compareMode, deck, redoStack, stackLayout, undoStack } =
    useDeckWorkspaceView();
  const { activeTab, isHydrated } = useDeckUiView();
  const { mergedWorkingCardsLength } = useDeckDetailModel();
  const workspaceActions = useDeckWorkspaceActions();
  const deckUiActions = useDeckUiActions();
  const { deckActions, deckImport, preview } = useDeckDetailServices();
  const [cardGroupView, setCardGroupView] = useState<CardGroupView>("categories");
  const canRedo = !compareMode && redoStack.length > 0;
  const canUndo = !compareMode && undoStack.length > 0;
  const cardSort = stackLayout.cardSort ?? "manaValue";
  const cardSortDirection = stackLayout.cardSortDirection ?? "desc";
  const searchToolbar = useMemo(
    () => (
      <EditorHeader
        canRedo={canRedo}
        canUndo={canUndo}
        onImport={deckImport.openImportModal}
        onExport={() => mergedWorkingCardsLength > 0 && deckImport.openExportModal()}
        exportDisabled={
          isHydrated && (mergedWorkingCardsLength === 0 || baselineDeck.status === "loading")
        }
        onRedo={workspaceActions.onRedo}
        onUndo={workspaceActions.onUndo}
        cardSort={cardSort}
        cardSortDirection={cardSortDirection}
        cardGroupView={cardGroupView}
        onCardSortChange={workspaceActions.onSetCardSort}
        onCardGroupViewChange={setCardGroupView}
        onReverseCardSortDirection={workspaceActions.onReverseCardSortDirection}
        onPreviewCard={(card) =>
          preview.updatePreviewCard({
            name: card.name,
            setCode: card.setCode,
            collectorNumber: card.collectorNumber,
          })
        }
      />
    ),
    [
      baselineDeck.status,
      canRedo,
      canUndo,
      cardGroupView,
      cardSort,
      cardSortDirection,
      deckImport,
      isHydrated,
      mergedWorkingCardsLength,
      preview,
      workspaceActions,
    ],
  );

  return (
    <Card variant="panel" render={<section />}>
      <Tabs
        value={activeTab}
        onValueChange={(value: DeckDetailTab) => deckUiActions.onSetActiveTab(value)}
      >
        <div className="flex border-b border-border">
          <TabsList aria-label="Deck views">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>
          {compareMode ? (
            <div className="ml-auto flex items-center gap-2 px-4">
              <span className="text-sm text-primary">Comparing snapshots</span>
              <button
                type="button"
                onClick={deckActions.exitCompareMode}
                className="text-muted-foreground hover:text-secondary-foreground"
              >
                Exit
              </button>
            </div>
          ) : null}
        </div>

        <TabsContent value="editor">
          <StackEditor cardGroupView={cardGroupView} searchToolbar={searchToolbar} />
        </TabsContent>
        <TabsContent value="history">
          <SaveHistoryPanel
            deck={deck}
            onLoadSave={(save) => void deckActions.loadSave(save)}
            onSaveSnapshotBeforeLoad={deckActions.saveSnapshotBeforeLoad}
            onCompareSaves={deckActions.compareSaves}
            onBackToEditor={() => deckUiActions.onSetActiveTab("editor")}
          />
        </TabsContent>
        <TabsContent value="stats">
          <DeckStatsPanel />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
