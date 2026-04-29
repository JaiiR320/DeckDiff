import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Pencil, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { CardPreviewPanel } from "../components/cards/CardPreviewPanel";
import { DeckActionsModal } from "../components/decks/DeckActionsModal";
import { DeckAlerts } from "../components/deck-editor/DeckAlerts";
import { EditorDeckList } from "../components/deck-editor/EditorDeckList";
import { EditorHeader } from "../components/deck-editor/EditorHeader";
import { ExportDeckModal } from "../components/deck-editor/modals/ExportDeckModal";
import { ImportDeckModal } from "../components/deck-editor/modals/ImportDeckModal";
import { SaveDeckModal } from "../components/deck-editor/modals/SaveDeckModal";
import { SaveHistoryPanel } from "../components/deck-editor/SaveHistoryPanel";
import {
  buildEditorRows,
  groupEditorRows,
} from "../components/deck-editor/editorRows";
import type { DeckSave } from "../lib/deck";
import type {
  DeckState,
  ExportModalState,
  EditorRow,
} from "../components/deck-editor/types";
import {
  formatDecklist,
  formatDeckExport,
  mergeValidatedCards,
  parseDecklist,
  type ValidatedDeckCard,
} from "../lib/decklist";
import { getLatestSave, type DeckItem } from "../lib/deck";
import {
  getCardPreview,
  type CardPreviewLookup,
  type CardPreviewResult,
  type SearchCardResult,
  validateDeckEntries,
} from "../lib/scryfall";
import {
  deleteDeckForUser,
  getDeck,
  renameDeckForUser,
  saveDeckForUser,
} from "#/server/decks";
import { getCurrentSession } from "#/server/session";

export const Route = createFileRoute("/decks_/$deckId")({
  beforeLoad: async () => {
    const session = await getCurrentSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
  },
  loader: async ({ params }) => {
    try {
      return {
        deck: await getDeck({
          data: { deckId: params.deckId },
        }),
        errorMessage: null,
      };
    } catch (error) {
      return {
        deck: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Could not load this deck right now.",
      };
    }
  },
  component: DeckDetailPage,
});

const emptyDeckState: DeckState = {
  rawText: "",
  cards: [],
  invalidCards: [],
  status: "idle",
  errorMessage: null,
};

type ImportMode = "replace-empty" | "bulk-add" | "override";

function DeckDetailPage() {
  const { deckId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const navigate = useNavigate();
  const [deck, setDeck] = useState<DeckItem | undefined>(
    loaderData.deck ?? undefined,
  );
  const [deckErrorMessage, setDeckErrorMessage] = useState<string | null>(
    loaderData.errorMessage,
  );
  const [baselineDeck, setBaselineDeck] = useState<DeckState>(emptyDeckState);
  const [workingCards, setWorkingCards] = useState<ValidatedDeckCard[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [isDeckActionsOpen, setIsDeckActionsOpen] = useState(false);
  const [draftDeck, setDraftDeck] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportModalState>({
    includeQuantity: true,
  });
  const [activeTab, setActiveTab] = useState<"editor" | "history">("editor");
  const [compareMode, setCompareMode] = useState(false);
  const [compareSaves, setCompareSaves] = useState<{
    saveA: DeckSave;
    saveB: DeckSave;
  } | null>(null);
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [previewLookup, setPreviewLookup] = useState<CardPreviewLookup | null>(
    null,
  );
  const [previewCard, setPreviewCard] = useState<CardPreviewResult | null>(
    null,
  );
  const [previewStatus, setPreviewStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [isPreviewPinned, setIsPreviewPinned] = useState(false);
  const previewRequestIdRef = useRef(0);

  const deckName = deck?.name ?? deckId;

  useEffect(() => {
    setDeck(loaderData.deck ?? undefined);
    setDeckErrorMessage(loaderData.errorMessage);
  }, [loaderData.deck, loaderData.errorMessage]);

  // In compare mode, use the two saves being compared
  const compareBaselineCards = compareSaves?.saveA.cards ?? baselineDeck.cards;
  const compareWorkingCards = compareSaves?.saveB.cards ?? workingCards;

  const mergedWorkingCards = mergeValidatedCards(compareWorkingCards);
  const editorRows = buildEditorRows(compareBaselineCards, compareWorkingCards);
  const groupedRows = groupEditorRows(editorRows);
  const resultCardTotal = editorRows.reduce(
    (total, row) => total + row.currentQuantity,
    0,
  );
  const emptyMessage =
    baselineDeck.status === "loading"
      ? "Validating the imported deck with Scryfall."
      : compareMode
        ? `Comparing "${compareSaves?.saveA.label}" → "${compareSaves?.saveB.label}"`
        : "Import a deck or add cards to start building.";

  useEffect(() => {
    setIsHydrated(true);
    if (!deck || deck.saves.length === 0) {
      setBaselineDeck(emptyDeckState);
      setWorkingCards([]);
      return;
    }

    const latestSave = getLatestSave(deck);
    if (latestSave) {
      setBaselineDeck({
        rawText: "",
        cards: latestSave.cards,
        invalidCards: [],
        status: "ready",
        errorMessage: null,
      });
      setWorkingCards(latestSave.cards);
    }
  }, [deck]);

  useEffect(() => {
    if (!previewLookup) {
      return;
    }

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;
    setPreviewStatus("loading");
    setPreviewCard(null);

    getCardPreview(previewLookup)
      .then((nextPreview) => {
        if (previewRequestIdRef.current !== requestId) {
          return;
        }

        setPreviewCard(nextPreview);
        setPreviewStatus(nextPreview ? "ready" : "error");
      })
      .catch(() => {
        if (previewRequestIdRef.current !== requestId) {
          return;
        }

        setPreviewCard(null);
        setPreviewStatus("error");
      });
  }, [previewLookup]);

  function openImportModal() {
    setDraftDeck(hasCards ? "" : baselineDeck.rawText);
    setIsImportOpen(true);
  }

  function closeImportModal() {
    setDraftDeck("");
    setIsImportOpen(false);
  }

  function openExportModal() {
    setIsExportOpen(true);
  }

  function closeExportModal() {
    setIsExportOpen(false);
  }

  function openSaveModal() {
    setIsSaveOpen(true);
  }

  function closeSaveModal() {
    setIsSaveOpen(false);
  }

  function openDeckActionsModal() {
    setIsDeckActionsOpen(true);
  }

  function closeDeckActionsModal() {
    setIsDeckActionsOpen(false);
  }

  function toggleExportQuantity() {
    setExportOptions((current) => ({
      ...current,
      includeQuantity: !current.includeQuantity,
    }));
  }

  async function validateDraftDeck(rawText: string) {
    const { entries, errors } = parseDecklist(rawText);
    const { validCards, invalidCards } = await validateDeckEntries(entries);

    return {
      validCards,
      warnings: [
        ...errors.map((error) => ({
          lineNumber: error.lineNumber,
          quantity: 0,
          name: error.text,
          reason: error.reason,
        })),
        ...invalidCards,
      ],
    };
  }

  async function importDraftDeck(mode: ImportMode) {
    const snapshotCards = workingCards;
    const rawText = draftDeck.trim();

    setBaselineDeck((currentDeck) => ({
      ...currentDeck,
      ...(mode === "replace-empty" ? { rawText } : {}),
      status: "loading",
      invalidCards: [],
      errorMessage: null,
    }));
    closeImportModal();

    try {
      const { validCards, warnings } = await validateDraftDeck(rawText);

      if (mode === "bulk-add") {
        setWorkingCards((currentCards) =>
          mergeValidatedCards([...currentCards, ...validCards]),
        );
        setBaselineDeck((currentDeck) => ({
          ...currentDeck,
          invalidCards: warnings,
          status: "ready",
          errorMessage: null,
        }));
        return;
      }

      if (mode === "override") {
        setBaselineDeck({
          rawText: "",
          cards: snapshotCards,
          invalidCards: warnings,
          status: "ready",
          errorMessage: null,
        });
        setWorkingCards(validCards);
        return;
      }

      setBaselineDeck({
        rawText,
        cards: validCards,
        invalidCards: warnings,
        status: "ready",
        errorMessage: null,
      });
      setWorkingCards(validCards);
    } catch (error) {
      if (mode === "replace-empty") {
        setBaselineDeck({
          rawText,
          cards: [],
          invalidCards: [],
          status: "error",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Could not import this deck right now.",
        });
        setWorkingCards([]);
        return;
      }

      setBaselineDeck((currentDeck) => ({
        ...currentDeck,
        status: "ready",
        errorMessage:
          error instanceof Error
            ? error.message
            : mode === "bulk-add"
              ? "Could not add cards right now."
              : "Could not import this deck right now.",
      }));
    }
  }

  async function handleSaveDeck(label: string) {
    if (!deck) return;

    try {
      const updatedDeck = await saveDeckForUser({
        data: {
          deckId: deck.id,
          label,
          cards: workingCards,
        },
      });

      if (!updatedDeck) {
        throw new Error("Could not save deck.");
      }

      setDeck(updatedDeck);
      setDeckErrorMessage(null);
      setBaselineDeck({
        rawText: "",
        cards: workingCards,
        invalidCards: [],
        status: "ready",
        errorMessage: null,
      });
      closeSaveModal();
    } catch (error) {
      setDeckErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save deck right now.",
      );
    }
  }

  async function handleRenameDeck(deckId: string, newName: string) {
    if (!deck || deck.id !== deckId) return;

    try {
      const updatedDeck = await renameDeckForUser({
        data: { deckId, newName },
      });

      if (!updatedDeck) {
        throw new Error("Could not rename deck.");
      }

      setDeck(updatedDeck);
      setDeckErrorMessage(null);

      if (updatedDeck.id !== deckId) {
        await navigate({
          to: "/decks/$deckId",
          params: { deckId: updatedDeck.id },
          replace: true,
        });
      }

      closeDeckActionsModal();
    } catch (error) {
      setDeckErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not rename deck right now.",
      );
    }
  }

  async function handleDeleteDeck(deckId: string) {
    try {
      await deleteDeckForUser({
        data: { deckId },
      });

      await navigate({ to: "/decks" });
    } catch (error) {
      setDeckErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not delete deck right now.",
      );
    }
  }

  function handleExportDeck(deckToExport: DeckItem) {
    const latestSave = getLatestSave(deckToExport);
    if (!latestSave) {
      alert("No cards to export. Import or add cards first.");
      return;
    }

    const exportText = formatDeckExport(latestSave.cards);
    const blob = new Blob([exportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${deckToExport.name.replace(/\s+/g, "-").toLowerCase()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    closeDeckActionsModal();
  }

  function handleLoadSave(save: DeckSave) {
    setWorkingCards(save.cards);
    setBaselineDeck({
      rawText: "",
      cards: save.cards,
      invalidCards: [],
      status: "ready",
      errorMessage: null,
    });
    setCompareMode(false);
    setCompareSaves(null);
    setActiveTab("editor");
  }

  function handleCompareSaves(saveA: DeckSave, saveB: DeckSave) {
    // Ensure saveA is the older one
    const olderSave =
      new Date(saveA.savedAt) <= new Date(saveB.savedAt) ? saveA : saveB;
    const newerSave =
      new Date(saveA.savedAt) <= new Date(saveB.savedAt) ? saveB : saveA;
    setCompareSaves({ saveA: olderSave, saveB: newerSave });
    setCompareMode(true);
    setActiveTab("editor");
  }

  function exitCompareMode() {
    setCompareMode(false);
    setCompareSaves(null);
    // Reset to latest save if available
    if (deck && deck.saves.length > 0) {
      const latestSave = getLatestSave(deck);
      if (latestSave) {
        setWorkingCards(latestSave.cards);
        setBaselineDeck({
          rawText: "",
          cards: latestSave.cards,
          invalidCards: [],
          status: "ready",
          errorMessage: null,
        });
      }
    }
  }

  async function handleImportDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await importDraftDeck(
      workingCards.length > 0 ? "bulk-add" : "replace-empty",
    );
  }

  async function handleOverrideDeck() {
    await importDraftDeck("override");
  }

  function dismissWarnings() {
    setBaselineDeck((currentDeck) => ({
      ...currentDeck,
      invalidCards: [],
    }));
  }

  function updatePreviewCard(
    nextPreview: CardPreviewLookup,
    source: "hover" | "manual" = "hover",
  ) {
    if (isPreviewPinned && source === "hover") {
      return;
    }

    setPreviewLookup((currentPreview) => {
      if (
        currentPreview?.name === nextPreview.name &&
        currentPreview?.setCode === nextPreview.setCode &&
        currentPreview?.collectorNumber === nextPreview.collectorNumber
      ) {
        return currentPreview;
      }

      return nextPreview;
    });
  }

  function togglePreviewPinned() {
    setIsPreviewPinned((current) => !current);
  }

  function toggleShowDiffOnly() {
    setShowDiffOnly((current) => !current);
  }

  function addCard(card: SearchCardResult) {
    setWorkingCards((currentCards) => [
      ...currentCards,
      {
        oracleId: card.oracleId,
        name: card.name,
        quantity: 1,
        typeLine: card.typeLine,
        category: card.category,
        setCode: card.setCode,
        collectorNumber: card.collectorNumber,
      },
    ]);
  }

  function adjustQuantity(row: EditorRow, delta: number) {
    setWorkingCards((currentCards) => {
      const currentIndex = currentCards.findIndex(
        (card) => card.oracleId === row.oracleId,
      );

      if (currentIndex === -1) {
        if (delta <= 0) {
          return currentCards;
        }

        return [
          ...currentCards,
          {
            oracleId: row.oracleId,
            name: row.name,
            quantity: 1,
            typeLine: row.typeLine,
            category: row.category,
            setCode: row.setCode,
            collectorNumber: row.collectorNumber,
          },
        ];
      }

      return currentCards
        .map((card, index) =>
          index === currentIndex
            ? {
                ...card,
                quantity: card.quantity + delta,
              }
            : card,
        )
        .filter((card) => card.quantity > 0);
    });
  }

  function restoreCard(row: EditorRow) {
    setWorkingCards((currentCards) => {
      const nextCards = currentCards.filter(
        (card) => card.oracleId !== row.oracleId,
      );

      if (row.baselineQuantity <= 0) {
        return nextCards;
      }

      return [
        ...nextCards,
        {
          oracleId: row.oracleId,
          name: row.name,
          quantity: row.baselineQuantity,
          typeLine: row.typeLine,
          category: row.category,
          setCode: row.setCode,
          collectorNumber: row.collectorNumber,
        },
      ];
    });
  }

  function exportResult() {
    if (mergedWorkingCards.length === 0) {
      return;
    }

    openExportModal();
  }

  async function copyExportToClipboard() {
    await navigator.clipboard.writeText(exportPreview);
    closeExportModal();
  }

  const exportPreview = formatDecklist(mergedWorkingCards, {
    includeQuantity: exportOptions.includeQuantity,
    includeSet: false,
    includeCollectorNumber: false,
    setStyle: "brackets",
  });

  const defaultSaveLabel = deck ? `Save #${deck.saves.length + 1}` : "Save #1";
  const hasCards = workingCards.length > 0;
  const cardsDifferFromBaseline =
    JSON.stringify(workingCards) !== JSON.stringify(baselineDeck.cards);
  const hasNoSavesYet = !deck || deck.saves.length === 0;
  // Allow save if: has cards AND (differs from baseline OR no saves yet)
  const canSave = hasCards && (cardsDifferFromBaseline || hasNoSavesYet);

  if (loaderData.errorMessage) {
    return (
      <main className="mx-auto w-full max-w-6xl px-8 py-8">
        <p className="rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
          {loaderData.errorMessage}
        </p>
      </main>
    );
  }

  if (!deck) {
    return (
      <main className="mx-auto w-full max-w-6xl px-8 py-8">
        <div className="flex items-center gap-4">
          <Link
            to="/decks"
            className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
          >
            Back
          </Link>
          <p className="text-sm text-zinc-500">Deck not found.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-8 py-8">
        {deckErrorMessage ? (
          <p className="mb-6 rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {deckErrorMessage}
          </p>
        ) : null}

        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/decks"
              className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
            >
              Back
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
              {deckName}
            </h1>
            {deck && deck.saves.length > 0 && (
              <span className="rounded-lg bg-zinc-900 px-2 py-1 text-sm text-zinc-500">
                {deck.saves.length} save{deck.saves.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openDeckActionsModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
              Edit
            </button>
            <button
              type="button"
              onClick={openSaveModal}
              disabled={!canSave}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" strokeWidth={1.75} />
              Save
            </button>
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
          {/* Tab switcher */}
          <div className="flex border-b border-zinc-800">
            <button
              type="button"
              onClick={() => setActiveTab("editor")}
              className={`px-5 py-3 text-sm font-medium transition ${
                activeTab === "editor"
                  ? "border-b-2 border-cyan-400 text-cyan-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`px-5 py-3 text-sm font-medium transition ${
                activeTab === "history"
                  ? "border-b-2 border-cyan-400 text-cyan-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              History
            </button>
            {compareMode && (
              <div className="ml-auto flex items-center gap-2 px-4">
                <span className="text-sm text-cyan-400">Comparing saves</span>
                <button
                  type="button"
                  onClick={exitCompareMode}
                  className="text-sm text-zinc-500 hover:text-zinc-300"
                >
                  Exit
                </button>
              </div>
            )}
          </div>

          {activeTab === "editor" ? (
            <>
              <EditorHeader
                onImport={openImportModal}
                onExport={exportResult}
                exportDisabled={
                  isHydrated &&
                  (mergedWorkingCards.length === 0 ||
                    baselineDeck.status === "loading")
                }
                onAddCard={addCard}
                onPreviewCard={(card) =>
                  updatePreviewCard({
                    name: card.name,
                    setCode: card.setCode,
                    collectorNumber: card.collectorNumber,
                  })
                }
              />

              <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="p-5 lg:pr-0">
                  <CardPreviewPanel
                    preview={previewCard}
                    status={previewStatus}
                    requestedName={previewLookup?.name ?? null}
                    isPinned={isPreviewPinned}
                    onTogglePinned={togglePreviewPinned}
                  />
                </div>

                <div className="min-w-0">
                  <DeckAlerts
                    deck={baselineDeck}
                    onDismissWarnings={dismissWarnings}
                  />

                  <EditorDeckList
                    groupedRows={groupedRows}
                    emptyMessage={emptyMessage}
                    resultCardTotal={resultCardTotal}
                    showDiffOnly={showDiffOnly}
                    onToggleShowDiffOnly={toggleShowDiffOnly}
                    onAdjustQuantity={compareMode ? undefined : adjustQuantity}
                    onRestoreCard={compareMode ? undefined : restoreCard}
                    onPreviewCard={(row) =>
                      updatePreviewCard({
                        name: row.name,
                        setCode: row.setCode,
                        collectorNumber: row.collectorNumber,
                      })
                    }
                    readOnly={compareMode}
                  />
                </div>
              </div>
            </>
          ) : deck ? (
            <SaveHistoryPanel
              deck={deck}
              onLoadSave={handleLoadSave}
              onCompareSaves={handleCompareSaves}
              onBackToEditor={() => setActiveTab("editor")}
            />
          ) : null}
        </section>
      </main>

      {isImportOpen ? (
        <ImportDeckModal
          hasCards={hasCards}
          draftDeck={draftDeck}
          onDraftDeckChange={setDraftDeck}
          onClose={closeImportModal}
          onSubmit={handleImportDeck}
          onOverride={handleOverrideDeck}
        />
      ) : null}

      {isExportOpen ? (
        <ExportDeckModal
          exportOptions={exportOptions}
          exportPreview={exportPreview}
          onClose={closeExportModal}
          onCopy={() => void copyExportToClipboard()}
          onToggleIncludeQuantity={toggleExportQuantity}
        />
      ) : null}

      {isSaveOpen && deck ? (
        <SaveDeckModal
          defaultLabel={defaultSaveLabel}
          isOpen={isSaveOpen}
          onClose={closeSaveModal}
          onSave={handleSaveDeck}
        />
      ) : null}

      {isDeckActionsOpen && deck ? (
        <DeckActionsModal
          deck={deck}
          isOpen={isDeckActionsOpen}
          onClose={closeDeckActionsModal}
          onRename={handleRenameDeck}
          onDelete={handleDeleteDeck}
          onExport={handleExportDeck}
        />
      ) : null}
    </>
  );
}
