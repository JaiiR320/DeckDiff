import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useReducer, useRef } from "react";
import type { SetStateAction } from "react";
import { buildDeckEditorModel } from "./editor/deckEditorModel";
import { type EditorSnapshot } from "./editor/editorUndo";
import { useDeckActions } from "./editor/useDeckActions";
import { useDeckImport } from "./editor/useDeckImport";
import { useDeckPreview } from "./editor/useDeckPreview";
import { type DeckCardSort, type DeckItem, type DeckStackLayout } from "#/lib/deck";
import { createDeckExport } from "#/lib/deckExport";
import { defaultStackLayout } from "#/lib/deckLayout";
import { defaultDeckCategories, type DeckCategory, type ValidatedDeckCard } from "#/lib/decklist";
import type { CardCategory } from "#/lib/decklist";
import type { CardPrintingOption, SearchCardResult } from "#/lib/scryfall";
import { getCardPreview } from "#/lib/scryfall";
import { getDeck, updateDeckCurrentForUser } from "#/server/decks";
import type { EditorRow } from "./editor/types";
import type { DeckState } from "./editor/types";
import {
  type DeckUiActions,
  type DeckUiView,
  type DeckDetailTab,
  type DeckDetailModel,
  type DeckDetailServices,
  type DeckWorkspaceActions,
  type DeckWorkspaceView,
  pageStateReducer,
  resolveStateAction,
  type PageState,
} from "./deckDetailContext";
import { useDeckEditorShortcuts } from "./useDeckEditorShortcuts";
import {
  applyDeckWorkspaceTransition,
  deckWorkspaceTransitions,
  getDeckWorkspaceDisplay,
  type DeckWorkspaceState,
  type DeckWorkspaceTransitionResult,
} from "./workspace/deckWorkspace";

const routeApi = getRouteApi("/decks_/$deckId");

const emptyDeckState: DeckState = {
  rawText: "",
  cards: [],
  invalidCards: [],
  status: "idle",
  errorMessage: null,
};
const resolvedPersistQueue = Promise.resolve();

function getDeckEditorState(deck: DeckItem, errorMessage: string | null): Partial<PageState> {
  return {
    workspace: deckWorkspaceTransitions.hydrateDeckWorkspace(deck),
    deckErrorMessage: errorMessage,
    isHydrated: true,
  };
}

export function useDeckDetailController() {
  const loaderData = routeApi.useLoaderData();
  const attemptedCardDataBackfillsRef = useRef<Set<string> | null>(null);
  const persistQueueRef = useRef<Promise<unknown> | null>(null);
  if (attemptedCardDataBackfillsRef.current === null) {
    attemptedCardDataBackfillsRef.current = new Set<string>();
  }
  if (persistQueueRef.current === null) {
    persistQueueRef.current = resolvedPersistQueue;
  }
  const persistVersionRef = useRef(0);
  const [pageState, dispatchPageState] = useReducer(pageStateReducer, {
    activeTab: "editor",
    deckErrorMessage: loaderData.errorMessage,
    isHydrated: false,
    showDiffOnly: false,
    workspace: loaderData.deck
      ? deckWorkspaceTransitions.hydrateDeckWorkspace(loaderData.deck)
      : null,
  });
  const pageStateRef = useRef(pageState);
  useEffect(() => {
    pageStateRef.current = pageState;
  }, [pageState]);

  const setPageState = (action: Parameters<typeof pageStateReducer>[1]) => {
    const patch = typeof action === "function" ? action(pageStateRef.current) : action;
    pageStateRef.current = { ...pageStateRef.current, ...patch };
    dispatchPageState(patch);
  };
  const workspace = pageState.workspace;
  const display = workspace ? getDeckWorkspaceDisplay(workspace) : null;
  const deck = workspace?.deck;
  const baselineDeck = workspace?.importStatus ?? emptyDeckState;
  const baselineCategories = workspace?.baseline.categories ?? defaultDeckCategories();
  const baselineStackLayout = workspace?.baseline.stackLayout ?? defaultStackLayout();
  const compareMode = workspace ? workspace.compare !== null : false;
  const compareSaves = workspace?.compare
    ? { saveA: workspace.compare.saveA, saveB: workspace.compare.saveB }
    : null;
  const stackLayout = display?.stackLayout ?? defaultStackLayout();
  const categories = display?.categories ?? defaultDeckCategories();
  const workingCards = display?.workingCards ?? [];
  const preview = useDeckPreview();
  const setActiveTab = (activeTab: SetStateAction<DeckDetailTab>) =>
    setPageState((current) => ({ activeTab: resolveStateAction(current.activeTab, activeTab) }));
  const setDeck = (deck: SetStateAction<DeckItem | undefined>) =>
    setPageState((current) => {
      const currentDeck = current.workspace?.deck;
      const nextDeck = resolveStateAction(currentDeck, deck);

      if (!nextDeck) return { workspace: null };
      if (!current.workspace) {
        return { workspace: deckWorkspaceTransitions.hydrateDeckWorkspace(nextDeck) };
      }

      return { workspace: { ...current.workspace, deck: nextDeck } };
    });
  const setDeckErrorMessage = (deckErrorMessage: SetStateAction<string | null>) =>
    setPageState((current) => ({
      deckErrorMessage: resolveStateAction(current.deckErrorMessage, deckErrorMessage),
    }));
  const setShowDiffOnly = (showDiffOnly: SetStateAction<boolean>) =>
    setPageState((current) => ({
      showDiffOnly: resolveStateAction(current.showDiffOnly, showDiffOnly),
    }));
  const clearUndoHistory = () =>
    setPageState((current) =>
      current.workspace
        ? { workspace: { ...current.workspace, undoStack: [], redoStack: [] } }
        : {},
    );
  const dismissImportWarnings = () =>
    setPageState((current) =>
      current.workspace
        ? {
            workspace: {
              ...current.workspace,
              importStatus: { ...current.workspace.importStatus, invalidCards: [] },
            },
          }
        : {},
    );
  const persistEditorSnapshot = async (snapshot: EditorSnapshot) => {
    const currentDeck = pageStateRef.current.workspace?.deck;
    if (!currentDeck) return false;

    const version = ++persistVersionRef.current;
    const data = {
      deckId: currentDeck.id,
      categories: snapshot.categories,
      cards: snapshot.workingCards,
      layout: snapshot.stackLayout,
    };

    const persist = async () => {
      try {
        const updatedDeck = await updateDeckCurrentForUser({ data }).catch(() =>
          updateDeckCurrentForUser({ data }),
        );
        if (updatedDeck && version === persistVersionRef.current) {
          setDeck(updatedDeck);
          setDeckErrorMessage(null);
        }
        return true;
      } catch (error) {
        if (version !== persistVersionRef.current) return false;

        const reloadedDeck = await getDeck({ data: { deckId: currentDeck.id } }).catch(() => null);
        if (reloadedDeck && version === persistVersionRef.current) {
          setPageState({
            ...getDeckEditorState(
              reloadedDeck,
              "Could not save live changes. Reloaded latest live version.",
            ),
          });
        } else {
          setDeckErrorMessage(
            error instanceof Error ? error.message : "Could not save live changes right now.",
          );
        }
        return false;
      }
    };

    const queuedPersist = persistQueueRef.current!.then(persist, persist);
    persistQueueRef.current = queuedPersist.catch(() => null);
    return queuedPersist;
  };
  const requestDeckWorkspaceTransition = (
    transition: (workspace: DeckWorkspaceState) => DeckWorkspaceTransitionResult,
    options: { allowDuringCompare?: boolean } = {},
  ) => {
    let snapshotToPersist: EditorSnapshot | null = null;
    setPageState((current) => {
      const workspace = current.workspace;
      if (!workspace) return {};

      const result = applyDeckWorkspaceTransition(workspace, transition, options);
      snapshotToPersist = result.intent.kind === "persist-current" ? result.intent.snapshot : null;
      return { workspace: result.workspace };
    });

    if (snapshotToPersist) {
      void persistEditorSnapshot(snapshotToPersist);
    }
  };
  const undoEditorChange = () => {
    requestDeckWorkspaceTransition(deckWorkspaceTransitions.undoCurrentDecklistEdit);
  };
  const redoEditorChange = () => {
    requestDeckWorkspaceTransition(deckWorkspaceTransitions.redoCurrentDecklistEdit);
  };
  const deckImport = useDeckImport({
    deckState: { baselineDeck, workingCards },
    editorActions: {
      beginImport: (options) =>
        requestDeckWorkspaceTransition((workspace) =>
          deckWorkspaceTransitions.beginImport(workspace, options),
        ),
      failImport: (options) =>
        requestDeckWorkspaceTransition((workspace) =>
          deckWorkspaceTransitions.failImport(workspace, options),
        ),
      applyValidatedImport: (options) =>
        requestDeckWorkspaceTransition((workspace) =>
          deckWorkspaceTransitions.applyValidatedImport(workspace, options),
        ),
    },
  });
  const deckActions = useDeckActions({
    deckState: { deck, setDeck, setDeckErrorMessage },
    editorState: {
      stackLayout: workspace?.current.stackLayout ?? stackLayout,
      categories: workspace?.current.categories ?? categories,
      workingCards: workspace?.current.workingCards ?? workingCards,
      requestDeckWorkspaceTransition,
    },
    navigationState: { setActiveTab },
  });

  useEffect(() => {
    const nextDeck = loaderData.deck ?? undefined;

    if (!nextDeck) {
      setPageState({
        deckErrorMessage: loaderData.errorMessage,
        isHydrated: true,
        workspace: null,
      });
      return;
    }

    setPageState(getDeckEditorState(nextDeck, loaderData.errorMessage));
  }, [loaderData.deck, loaderData.errorMessage]);

  useEffect(() => {
    if (!pageState.isHydrated) return;
    const workspace = pageState.workspace;
    if (!workspace) return;
    const display = getDeckWorkspaceDisplay(workspace);

    const cardsNeedingBackfill = display.workingCards.filter((card) => {
      const key = getCardDataBackfillKey(card);
      return (
        key &&
        !attemptedCardDataBackfillsRef.current!.has(key) &&
        (stackLayout.cardSort === "edhrecRank" ||
          card.edhrecRank === undefined ||
          card.priceUsd === undefined ||
          card.manaValue === undefined ||
          card.manaCost === undefined ||
          card.producedMana === undefined)
      );
    });

    if (cardsNeedingBackfill.length === 0) return;

    const uniqueCards = [
      ...new Map(cardsNeedingBackfill.map((card) => [getCardDataBackfillKey(card), card])).values(),
    ];
    for (const card of uniqueCards) {
      const key = getCardDataBackfillKey(card);
      if (key) attemptedCardDataBackfillsRef.current!.add(key);
    }

    let isCurrent = true;
    Promise.all(
      uniqueCards.map(async (card) => {
        const preview = await getCardPreview({
          name: card.name,
          setCode: card.setCode,
          collectorNumber: card.collectorNumber,
        }).catch(() => null);
        return {
          key: getCardDataBackfillKey(card),
          hasPreview: preview !== null,
          manaCost: preview?.manaCost,
          manaValue: preview?.manaValue,
          producedMana: preview?.producedMana,
          priceUsd: preview?.priceUsd,
          edhrecRank: preview?.edhrecRank,
        };
      }),
    ).then((cardData) => {
      if (!isCurrent) return;
      const cardDataByKey = new Map(
        cardData.flatMap(
          ({ key, hasPreview, manaCost, manaValue, producedMana, priceUsd, edhrecRank }) =>
            key &&
            hasPreview &&
            (manaCost !== undefined ||
              manaValue !== undefined ||
              producedMana !== undefined ||
              priceUsd !== undefined ||
              edhrecRank !== undefined)
              ? [[key, { manaCost, manaValue, producedMana, priceUsd, edhrecRank }] as const]
              : [],
        ),
      );

      if (cardDataByKey.size === 0) return;

      let snapshotToPersist: EditorSnapshot | null = null;
      setPageState((current) => {
        if (!current.workspace) return {};
        const nextCurrentCards = backfillCardData(
          current.workspace.current.workingCards,
          cardDataByKey,
        );
        const shouldPersistCurrent = nextCurrentCards.some(
          (card, index) =>
            card.edhrecRank !==
            (current.workspace?.current.workingCards[index]?.edhrecRank ?? null),
        );

        if (shouldPersistCurrent) {
          snapshotToPersist = {
            ...current.workspace.current,
            workingCards: nextCurrentCards,
          };
        }

        return {
          workspace: {
            ...current.workspace,
            baseline: {
              ...current.workspace.baseline,
              workingCards: backfillCardData(
                current.workspace.baseline.workingCards,
                cardDataByKey,
              ),
            },
            current: {
              ...current.workspace.current,
              workingCards: nextCurrentCards,
            },
            compare: current.workspace.compare
              ? {
                  ...current.workspace.compare,
                  display: {
                    ...current.workspace.compare.display,
                    workingCards: backfillCardData(
                      current.workspace.compare.display.workingCards,
                      cardDataByKey,
                    ),
                  },
                }
              : null,
            importStatus: {
              ...current.workspace.importStatus,
              cards: backfillCardData(current.workspace.importStatus.cards, cardDataByKey),
            },
          },
        };
      });

      if (snapshotToPersist) {
        void persistEditorSnapshot(snapshotToPersist);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [pageState.isHydrated, pageState.workspace, stackLayout.cardSort]);

  const editorModel = buildDeckEditorModel({
    baselineDeck,
    baselineCategories,
    categories,
    compareMode,
    compareSaves,
    workingCards,
  });
  const previewExport = deck
    ? createDeckExport(deck, {
        cards: deckImport.exportOptions.addedOnly
          ? editorModel.addedDeltaCards
          : editorModel.mergedWorkingCards,
        categories: editorModel.exportCategories,
        includeQuantity: deckImport.exportOptions.includeQuantity,
        groupByCategory: deckImport.exportOptions.groupByCategory,
        includeOutOfDeckCategories: deckImport.exportOptions.includeOutOfDeckCategories,
        separateSideboard: deckImport.exportOptions.separateSideboard,
      })
    : null;
  const exportPreview = previewExport && previewExport.ok ? previewExport.text : "";
  const currentSnapshot = workspace?.current;
  const hasCards = workingCards.length > 0;
  const hasEditorChanges =
    JSON.stringify(currentSnapshot?.workingCards ?? []) !== JSON.stringify(baselineDeck.cards) ||
    JSON.stringify(currentSnapshot?.categories ?? []) !== JSON.stringify(baselineCategories) ||
    JSON.stringify(currentSnapshot?.stackLayout ?? defaultStackLayout()) !==
      JSON.stringify(baselineStackLayout) ||
    !deck ||
    deck.saves.length === 0;

  function addStackLane() {
    requestDeckWorkspaceTransition(deckWorkspaceTransitions.addStackLane);
  }

  useDeckEditorShortcuts(compareMode, undoEditorChange, redoEditorChange);

  if (!deck) {
    return { workspaceView: null, errorMessage: loaderData.errorMessage };
  }

  const workspaceView: DeckWorkspaceView = {
    baselineDeck,
    baselineCategories,
    baselineStackLayout,
    compareMode,
    compareSaves,
    deck,
    redoStack: workspace?.redoStack ?? [],
    stackLayout,
    undoStack: workspace?.undoStack ?? [],
    categories,
    workingCards,
  };
  const deckUiView: DeckUiView = {
    activeTab: pageState.activeTab,
    deckErrorMessage: pageState.deckErrorMessage,
    isHydrated: pageState.isHydrated,
    showDiffOnly: pageState.showDiffOnly,
  };
  const model: DeckDetailModel = {
    canSave: hasEditorChanges && (hasCards || categories.length > 0),
    categoryDiffs: editorModel.categoryDiffs,
    deckName: deck.name,
    defaultSaveLabel: `Save #${deck.saves.length + 1}`,
    exportPreview,
    groupedRows: editorModel.groupedRows,
    hasCards,
    mergedWorkingCardsLength: editorModel.mergedWorkingCards.length,
    resultCardTotal: editorModel.resultCardTotal,
  };
  const workspaceActions: DeckWorkspaceActions = {
    onClearUndoHistory: clearUndoHistory,
    onDismissImportWarnings: dismissImportWarnings,
    onAddStackLane: addStackLane,
    onRedo: redoEditorChange,
    onUndo: undoEditorChange,
    onAddSearchCard: (card: SearchCardResult, category: CardCategory) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.appendSearchCard(workspace, card, category),
      ),
    onAdjustQuantity: (row: EditorRow, delta: number) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.adjustCardQuantity(workspace, row, delta),
      ),
    onChangePrinting: (row: EditorRow, printing: CardPrintingOption) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.changeCardPrinting(workspace, row, printing),
      ),
    onCreateCategoryInLane: (laneIndex: number, category: DeckCategory) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.createCategoryInLane(workspace, laneIndex, category),
      ),
    onMoveAllCardsBetweenCategories: (fromCategory: CardCategory, toCategory: CardCategory) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.moveAllCardsBetweenCategories(workspace, fromCategory, toCategory),
      ),
    onMoveCardToCategory: (row: EditorRow, category: CardCategory) => {
      if (row.category === category || row.currentQuantity <= 0) return;
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.moveCardToCategory(workspace, row, category),
      );
    },
    onRemoveCategory: (category: CardCategory) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.removeEmptyCategory(workspace, category),
      ),
    onRemoveStackLane: (laneIndex: number) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.removeStackLane(workspace, laneIndex),
      ),
    onRenameCategory: (category: CardCategory, name: string) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.renameCategory(workspace, category, name),
      ),
    onReplaceCategories: (nextCategories: DeckCategory[]) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.replaceCategories(workspace, nextCategories),
      ),
    onSetCardSort: (cardSort: DeckCardSort) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.setCardSort(workspace, cardSort),
      ),
    onSetShowRemovedCardGhosts: (showRemovedCardGhosts: boolean) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.setShowRemovedCardGhosts(workspace, showRemovedCardGhosts),
      ),
    onSetStackLayout: (layout: DeckStackLayout) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.setStackLayout(workspace, layout),
      ),
    onReverseCardSortDirection: () =>
      requestDeckWorkspaceTransition(deckWorkspaceTransitions.reverseCardSortDirection),
    onUpdateCategory: (category: CardCategory, patch: Partial<DeckCategory>) =>
      requestDeckWorkspaceTransition((workspace) =>
        deckWorkspaceTransitions.updateCategory(workspace, category, patch),
      ),
  };
  const deckUiActions: DeckUiActions = {
    onSetActiveTab: setActiveTab,
    onToggleShowDiffOnly: () => setShowDiffOnly((current) => !current),
  };
  const services: DeckDetailServices = { deckActions, deckImport, preview };

  return {
    deckUiActions,
    deckUiView,
    errorMessage: loaderData.errorMessage,
    model,
    services,
    workspaceActions,
    workspaceView,
  };
}

function getCardDataBackfillKey(card: ValidatedDeckCard) {
  return [card.oracleId, card.setCode ?? "", card.collectorNumber ?? ""].join("\0");
}

type CardBackfillData = {
  manaCost?: string;
  manaValue?: number;
  producedMana?: string[];
  priceUsd?: number;
  edhrecRank?: number | null;
};

function backfillCardData(
  cards: ValidatedDeckCard[],
  cardDataByKey: Map<string, CardBackfillData>,
) {
  return cards.map((card) => {
    const cardData = cardDataByKey.get(getCardDataBackfillKey(card));
    if (!cardData) return card;

    const nextCard = {
      ...card,
      manaCost: card.manaCost ?? cardData.manaCost,
      manaValue: card.manaValue ?? cardData.manaValue,
      producedMana: card.producedMana ?? cardData.producedMana,
      priceUsd: card.priceUsd ?? cardData.priceUsd,
      edhrecRank: cardData.edhrecRank ?? null,
    };

    if (
      nextCard.manaCost === card.manaCost &&
      nextCard.manaValue === card.manaValue &&
      nextCard.producedMana === card.producedMana &&
      nextCard.priceUsd === card.priceUsd &&
      nextCard.edhrecRank === (card.edhrecRank ?? null)
    ) {
      return card;
    }

    return nextCard;
  });
}
