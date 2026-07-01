import { useState } from "react";
import type { FormEvent } from "react";
import { parseDecklist, type InvalidDeckCard, type ValidatedDeckCard } from "#/lib/decklist";
import { validateDeckEntries } from "#/lib/scryfall";
import { type ImportMode } from "./deckImport";
import type { DeckState, ExportModalState } from "./types";

type UseDeckImportOptions = {
  deckState: {
    baselineDeck: DeckState;
    workingCards: ValidatedDeckCard[];
  };
  editorActions: {
    beginImport: (options: { mode: ImportMode; rawText: string }) => void;
    failImport: (options: { mode: ImportMode; rawText: string; errorMessage: string }) => void;
    applyValidatedImport: (options: {
      mode: ImportMode;
      validCards: ValidatedDeckCard[];
      warnings: InvalidDeckCard[];
      rawText: string;
    }) => void;
  };
};

export function useDeckImport({ deckState, editorActions }: UseDeckImportOptions) {
  const [draftDeck, setDraftDeck] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportModalState>({
    includeQuantity: true,
    groupByCategory: false,
    includeOutOfDeckCategories: false,
    separateSideboard: false,
    addedOnly: false,
  });
  const { baselineDeck, workingCards } = deckState;
  const { applyValidatedImport, beginImport, failImport } = editorActions;

  function openImportModal() {
    setDraftDeck(workingCards.length > 0 ? "" : baselineDeck.rawText);
    setIsImportOpen(true);
  }

  function closeImportModal() {
    setDraftDeck("");
    setIsImportOpen(false);
  }

  async function importDraftDeck(mode: ImportMode) {
    const rawText = draftDeck.trim();

    beginImport({ mode, rawText });
    closeImportModal();

    try {
      const { validCards, warnings } = await validateDraftDeck(rawText);

      applyValidatedImport({ mode, validCards, warnings, rawText });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : mode === "bulk-add"
            ? "Could not add cards right now."
            : "Could not import this deck right now.";

      if (mode === "replace-empty") {
        failImport({ mode, rawText, errorMessage });
        return;
      }

      failImport({ mode, rawText, errorMessage });
    }
  }

  function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void importDraftDeck(workingCards.length > 0 ? "bulk-add" : "replace-empty");
  }

  return {
    draftDeck,
    exportOptions,
    isExportOpen,
    isImportOpen,
    closeImportModal,
    importDraftDeck,
    openExportModal: () => setIsExportOpen(true),
    openImportModal,
    setDraftDeck,
    setIsExportOpen,
    submitImport,
    toggleExportAddedOnly: () =>
      setExportOptions((current) => ({ ...current, addedOnly: !current.addedOnly })),
    toggleExportGroupByCategory: () =>
      setExportOptions((current) => ({
        ...current,
        groupByCategory: !current.groupByCategory,
        separateSideboard: current.groupByCategory ? current.separateSideboard : false,
      })),
    toggleExportIncludeOutOfDeckCategories: () =>
      setExportOptions((current) => ({
        ...current,
        includeOutOfDeckCategories: !current.includeOutOfDeckCategories,
      })),
    toggleExportQuantity: () =>
      setExportOptions((current) => ({ ...current, includeQuantity: !current.includeQuantity })),
    toggleExportSeparateSideboard: () =>
      setExportOptions((current) => ({
        ...current,
        separateSideboard: !current.groupByCategory && !current.separateSideboard,
      })),
  };
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
