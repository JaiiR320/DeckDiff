import { describe, expect, it } from "vitest";
import type { DeckItem, DeckSave } from "#/lib/deck";
import type { ValidatedDeckCard } from "#/lib/decklist";
import type { EditorSnapshot } from "../editor/editorUndo";
import {
  applyDeckWorkspaceTransition,
  deckWorkspaceTransitions,
  getDeckWorkspaceDisplay,
  type DeckWorkspaceState,
  type DeckWorkspaceTransitionResult,
  type DeckWorkspaceTransitionName,
  type PersistenceIntent,
} from "./deckWorkspace";

const TRANSITION_NAMES: DeckWorkspaceTransitionName[] = [
  "hydrateDeckWorkspace",
  "undoCurrentDecklistEdit",
  "redoCurrentDecklistEdit",
  "markCurrentDecklistSaved",
  "loadSaveAsCurrentDecklist",
  "enterCompareMode",
  "exitCompareMode",
  "setCardSort",
  "reverseCardSortDirection",
  "setStackLayout",
  "addStackLane",
  "removeStackLane",
  "setShowRemovedCardGhosts",
  "replaceCategories",
  "createCategoryInLane",
  "renameCategory",
  "updateCategory",
  "removeEmptyCategory",
  "appendSearchCard",
  "adjustCardQuantity",
  "changeCardPrinting",
  "moveCardToCategory",
  "moveAllCardsBetweenCategories",
  "beginImport",
  "failImport",
  "applyValidatedImport",
];

describe("deckWorkspace", () => {
  it("exports the locked Deck Workspace transition names", () => {
    expect(Object.keys(deckWorkspaceTransitions)).toEqual(TRANSITION_NAMES);
  });

  it("hydrates current decklist from current deck data and baseline from latest save", () => {
    const latestSave = save("save-1", "2026-01-01T00:00:00.000Z", snapshot("save-card", 2));
    const deck = deckItem({ saves: [latestSave], current: snapshot("current-card", 3) });

    const workspace: DeckWorkspaceState = deckWorkspaceTransitions.hydrateDeckWorkspace(deck);

    expect(workspace.deck).toBe(deck);
    expect(workspace.current.workingCards).toEqual([card("current-card", 3)]);
    expect(workspace.baseline.workingCards).toEqual([card("save-card", 2)]);
    expect(workspace.compare).toBeNull();
  });

  it("hydrates current decklist from the latest save when current deck data is missing", () => {
    const latestSave = save("save-1", "2026-01-01T00:00:00.000Z", snapshot("save-card", 2));
    const deck = deckItem({ saves: [latestSave] });

    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(deck);

    expect(workspace.current).toEqual(workspace.baseline);
    expect(workspace.current.workingCards).toEqual([card("save-card", 2)]);
    expect(workspace.importStatus.status).toBe("ready");
  });

  it("keeps baseline status ready when the latest save has no cards", () => {
    const latestSave = save("save-1", "2026-01-01T00:00:00.000Z", {
      ...snapshot("save-card", 1),
      workingCards: [],
    });
    const deck = deckItem({ saves: [latestSave] });

    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(deck);

    expect(workspace.current.workingCards).toEqual([]);
    expect(workspace.importStatus.status).toBe("ready");
  });

  it("normalizes categories while hydrating the current decklist", () => {
    const deck = deckItem({
      current: {
        categories: [
          { id: "creature", name: "Creature" },
          { id: "creature", name: "Duplicate" },
          { id: "", name: "Missing ID" },
        ],
        stackLayout: { lanes: [["creature"]] },
        workingCards: [card("current-card", 1, { category: "Creature", categoryId: undefined })],
      },
    });

    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(deck);

    expect(workspace.current.categories).toEqual([
      {
        id: "creature",
        name: "Creature",
        hidden: false,
        includeInDeck: true,
        kind: undefined,
      },
    ]);
    expect(workspace.current.workingCards[0]?.categoryId).toBe("creature");
  });

  it("normalizes layout while hydrating the current decklist", () => {
    const deck = deckItem({
      current: {
        categories: [
          { id: "creature", name: "Creature", kind: "default" },
          { id: "artifact", name: "Artifact", kind: "default" },
        ],
        stackLayout: {
          lanes: [["Creature", "missing", "creature"]],
          cardSort: "not-a-sort",
          cardSortDirection: "sideways",
          showRemovedCardGhosts: false,
        } as unknown as EditorSnapshot["stackLayout"],
        workingCards: [card("current-card", 1)],
      },
    });

    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(deck);

    expect(workspace.current.stackLayout).toEqual({
      lanes: [["creature"], ["artifact"]],
      cardSort: "manaValue",
      cardSortDirection: "desc",
      showRemovedCardGhosts: false,
    });
  });

  it("returns persistence intents from current decklist edits", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("a", 1) }),
    );

    const result: DeckWorkspaceTransitionResult = deckWorkspaceTransitions.adjustCardQuantity(
      workspace,
      editorRow("a", 1),
      1,
    );

    const expectedIntent: PersistenceIntent = {
      kind: "persist-current",
      snapshot: result.workspace.current,
    };
    expect(result.intent).toEqual(expectedIntent);
    expect(result.workspace.undoStack).toEqual([workspace.current]);
    expect(workspace.current.workingCards).toEqual([card("a", 1)]);
  });

  it("does not request persistence when an edit leaves the current decklist unchanged", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("a", 1) }),
    );

    const result = deckWorkspaceTransitions.moveCardToCategory(
      workspace,
      editorRow("a", 1),
      "creature",
    );

    expect(result.workspace).toBe(workspace);
    expect(result.intent).toEqual({ kind: "none" });
  });

  it("owns undo and returns a persistence intent", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("a", 1) }),
    );
    const edited = deckWorkspaceTransitions.adjustCardQuantity(
      workspace,
      editorRow("a", 1),
      1,
    ).workspace;

    const result = deckWorkspaceTransitions.undoCurrentDecklistEdit(edited);

    expect(result.workspace.current.workingCards).toEqual([card("a", 1)]);
    expect(result.workspace.redoStack).toEqual([edited.current]);
    expect(result.intent).toEqual({ kind: "persist-current", snapshot: result.workspace.current });
  });

  it("owns redo and returns a persistence intent", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("a", 1) }),
    );
    const edited = deckWorkspaceTransitions.adjustCardQuantity(
      workspace,
      editorRow("a", 1),
      1,
    ).workspace;
    const undone = deckWorkspaceTransitions.undoCurrentDecklistEdit(edited).workspace;

    const result = deckWorkspaceTransitions.redoCurrentDecklistEdit(undone);

    expect(result.workspace.current.workingCards).toEqual([card("a", 2)]);
    expect(result.workspace.undoStack).toEqual([workspace.current]);
    expect(result.intent).toEqual({ kind: "persist-current", snapshot: result.workspace.current });
  });

  it("does not request persistence when undo has no history", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("a", 1) }),
    );

    const result = deckWorkspaceTransitions.undoCurrentDecklistEdit(workspace);

    expect(result.workspace).toBe(workspace);
    expect(result.intent).toEqual({ kind: "none" });
  });

  it("loads a Save as the Current Decklist through a persistence intent", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("current", 1) }),
    );
    const targetSave = save("save-2", "2026-01-02T00:00:00.000Z", snapshot("loaded", 4));

    const result = deckWorkspaceTransitions.loadSaveAsCurrentDecklist(workspace, targetSave);

    expect(result.workspace.current.workingCards).toEqual([card("loaded", 4)]);
    expect(result.workspace.baseline).toEqual(result.workspace.current);
    expect(result.intent).toEqual({ kind: "persist-current", snapshot: result.workspace.current });
  });

  it("marks the Current Decklist as saved after save persistence succeeds", () => {
    const workspace = deckWorkspaceTransitions.adjustCardQuantity(
      deckWorkspaceTransitions.hydrateDeckWorkspace(deckItem({ current: snapshot("saved", 1) })),
      editorRow("saved", 1),
      1,
    ).workspace;
    const updatedDeck = deckItem({
      saves: [save("save-2", "2026-01-02T00:00:00.000Z", workspace.current)],
      current: workspace.current,
    });

    const result = deckWorkspaceTransitions.markCurrentDecklistSaved(workspace, updatedDeck);

    expect(result.workspace.deck).toBe(updatedDeck);
    expect(result.workspace.baseline).toEqual(workspace.current);
    expect(result.workspace.importStatus.cards).toEqual(workspace.current.workingCards);
    expect(result.workspace.undoStack).toEqual([]);
    expect(result.intent).toEqual({ kind: "none" });
  });

  it("enters Compare Mode without persistence and displays the newer Save", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("current", 1) }),
    );
    const newerSave = save("newer", "2026-01-03T00:00:00.000Z", snapshot("newer-card", 3));
    const olderSave = save("older", "2026-01-01T00:00:00.000Z", snapshot("older-card", 1));

    const result = deckWorkspaceTransitions.enterCompareMode(workspace, newerSave, olderSave);

    expect(result.intent).toEqual({ kind: "none" });
    expect(result.workspace.compare).toMatchObject({ saveA: olderSave, saveB: newerSave });
    expect(result.workspace.compare?.display.workingCards).toEqual([card("newer-card", 3)]);
    expect(result.workspace.current).toEqual(workspace.current);
  });

  it("exits Compare Mode with the persisted Current Decklist restored", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("current", 1) }),
    );
    const newerSave = save("newer", "2026-01-03T00:00:00.000Z", snapshot("newer-card", 3));
    const olderSave = save("older", "2026-01-01T00:00:00.000Z", snapshot("older-card", 1));
    const comparing = deckWorkspaceTransitions.enterCompareMode(
      workspace,
      newerSave,
      olderSave,
    ).workspace;

    const result = deckWorkspaceTransitions.exitCompareMode(comparing);

    expect(result.intent).toEqual({ kind: "none" });
    expect(result.workspace.compare).toBeNull();
    expect(result.workspace.current.workingCards).toEqual([card("current", 1)]);
  });

  it("keeps unsynced Current Decklist edits while displaying Compare Mode saves", () => {
    const savedDeck = deckItem({ current: snapshot("persisted", 1) });
    const workspace = deckWorkspaceTransitions.adjustCardQuantity(
      deckWorkspaceTransitions.hydrateDeckWorkspace(savedDeck),
      editorRow("persisted", 1),
      2,
    ).workspace;
    const newerSave = save("newer", "2026-01-03T00:00:00.000Z", snapshot("newer-card", 3));
    const olderSave = save("older", "2026-01-01T00:00:00.000Z", snapshot("older-card", 1));

    const comparing = deckWorkspaceTransitions.enterCompareMode(
      workspace,
      newerSave,
      olderSave,
    ).workspace;
    const exited = deckWorkspaceTransitions.exitCompareMode(comparing).workspace;

    expect(getDeckWorkspaceDisplay(comparing).workingCards).toEqual([card("newer-card", 3)]);
    expect(comparing.current.workingCards).toEqual([card("persisted", 3)]);
    expect(exited.current.workingCards).toEqual([card("persisted", 3)]);
  });

  it("blocks Current Decklist edits while Compare Mode is active", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("current", 1) }),
    );
    const comparing = deckWorkspaceTransitions.enterCompareMode(
      workspace,
      save("newer", "2026-01-03T00:00:00.000Z", snapshot("newer-card", 3)),
      save("older", "2026-01-01T00:00:00.000Z", snapshot("older-card", 1)),
    ).workspace;

    const result = applyDeckWorkspaceTransition(comparing, (currentWorkspace) =>
      deckWorkspaceTransitions.adjustCardQuantity(currentWorkspace, editorRow("current", 1), 1),
    );

    expect(result.workspace).toBe(comparing);
    expect(result.intent).toEqual({ kind: "none" });
  });

  it("allows explicit Compare Mode exit while edit transitions are blocked", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("current", 1) }),
    );
    const comparing = deckWorkspaceTransitions.enterCompareMode(
      workspace,
      save("newer", "2026-01-03T00:00:00.000Z", snapshot("newer-card", 3)),
      save("older", "2026-01-01T00:00:00.000Z", snapshot("older-card", 1)),
    ).workspace;

    const result = applyDeckWorkspaceTransition(
      comparing,
      deckWorkspaceTransitions.exitCompareMode,
      { allowDuringCompare: true },
    );

    expect(result.workspace.compare).toBeNull();
    expect(result.workspace.current.workingCards).toEqual([card("current", 1)]);
  });

  it("moves cards by named transition instead of exposing raw card mutation", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("a", 1) }),
    );

    const result = deckWorkspaceTransitions.moveCardToCategory(
      workspace,
      editorRow("a", 1),
      "artifact",
    );

    expect(result.workspace.current.workingCards[0]?.categoryId).toBe("artifact");
    expect(result.intent.kind).toBe("persist-current");
  });

  it("removes empty lanes when removing an empty category", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("a", 1) }),
    );

    const result = deckWorkspaceTransitions.removeEmptyCategory(workspace, "artifact");

    expect(result.workspace.current.categories.map((category) => category.id)).toEqual([
      "creature",
    ]);
    expect(result.workspace.current.stackLayout.lanes).toEqual([["creature"]]);
    expect(result.intent.kind).toBe("persist-current");
  });

  it("updates import status without persistence when import cards do not change", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("a", 1) }),
    );

    const result = deckWorkspaceTransitions.applyValidatedImport(workspace, {
      mode: "bulk-add",
      validCards: [],
      warnings: [{ lineNumber: 1, quantity: 0, name: "Nope", reason: "not found" }],
      rawText: "Nope",
    });

    expect(result.workspace.current).toEqual(workspace.current);
    expect(result.workspace.undoStack).toEqual([]);
    expect(result.workspace.importStatus.invalidCards).toHaveLength(1);
    expect(result.intent).toEqual({ kind: "none" });
  });

  it("applies replace-empty Import through the Deck Workspace without creating a Save", () => {
    const originalSave = save("save-1", "2026-01-01T00:00:00.000Z", snapshot("saved", 1));
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ saves: [originalSave] }),
    );
    const importedCards = [card("imported", 2)];
    const warnings = [{ lineNumber: 2, quantity: 0, name: "Nope", reason: "not found" }];

    const result = deckWorkspaceTransitions.applyValidatedImport(workspace, {
      mode: "replace-empty",
      validCards: importedCards,
      warnings,
      rawText: "2 Imported",
    });

    expect(result.workspace.current.workingCards).toEqual(importedCards);
    expect(result.workspace.importStatus).toEqual({
      rawText: "2 Imported",
      cards: importedCards,
      invalidCards: warnings,
      status: "ready",
      errorMessage: null,
    });
    expect(result.workspace.deck.saves).toEqual([originalSave]);
    expect(result.intent).toEqual({ kind: "persist-current", snapshot: result.workspace.current });
  });

  it("applies bulk-add Import through the Deck Workspace and preserves undo behavior", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("existing", 1) }),
    );

    const imported = deckWorkspaceTransitions.applyValidatedImport(workspace, {
      mode: "bulk-add",
      validCards: [card("new", 3)],
      warnings: [],
      rawText: "3 New",
    }).workspace;
    const undone = deckWorkspaceTransitions.undoCurrentDecklistEdit(imported);

    expect(imported.current.workingCards).toEqual([card("existing", 1), card("new", 3)]);
    expect(imported.undoStack).toEqual([workspace.current]);
    expect(undone.workspace.current.workingCards).toEqual([card("existing", 1)]);
    expect(undone.intent).toEqual({ kind: "persist-current", snapshot: undone.workspace.current });
  });

  it("applies override Import through the Deck Workspace", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("old", 4) }),
    );
    const importedCards = [card("replacement", 2)];

    const result = deckWorkspaceTransitions.applyValidatedImport(workspace, {
      mode: "override",
      validCards: importedCards,
      warnings: [],
      rawText: "2 Replacement",
    });

    expect(result.workspace.current.workingCards).toEqual(importedCards);
    expect(result.workspace.importStatus.cards).toEqual([card("old", 4)]);
    expect(result.intent).toEqual({ kind: "persist-current", snapshot: result.workspace.current });
  });

  it("keeps validation warnings visible after a validated Import", () => {
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ current: snapshot("existing", 1) }),
    );
    const warnings = [{ lineNumber: 1, quantity: 0, name: "Bad Card", reason: "not found" }];

    const result = deckWorkspaceTransitions.applyValidatedImport(workspace, {
      mode: "bulk-add",
      validCards: [],
      warnings,
      rawText: "Bad Card",
    });

    expect(result.workspace.importStatus.invalidCards).toEqual(warnings);
    expect(result.workspace.importStatus.status).toBe("ready");
    expect(result.workspace.importStatus.errorMessage).toBeNull();
  });

  it("keeps failed Import error state in the Deck Workspace without changing saves", () => {
    const originalSave = save("save-1", "2026-01-01T00:00:00.000Z", snapshot("saved", 1));
    const workspace = deckWorkspaceTransitions.hydrateDeckWorkspace(
      deckItem({ saves: [originalSave], current: snapshot("existing", 1) }),
    );

    const loading = deckWorkspaceTransitions.beginImport(workspace, {
      mode: "bulk-add",
      rawText: "1 Broken",
    }).workspace;
    const result = deckWorkspaceTransitions.failImport(loading, {
      mode: "bulk-add",
      rawText: "1 Broken",
      errorMessage: "Could not add cards right now.",
    });

    expect(loading.importStatus.status).toBe("loading");
    expect(result.workspace.current).toEqual(workspace.current);
    expect(result.workspace.importStatus.status).toBe("ready");
    expect(result.workspace.importStatus.errorMessage).toBe("Could not add cards right now.");
    expect(result.workspace.deck.saves).toEqual([originalSave]);
    expect(result.intent).toEqual({ kind: "none" });
  });
});

function deckItem({
  saves = [],
  current,
}: {
  saves?: DeckSave[];
  current?: EditorSnapshot;
}): DeckItem {
  return {
    id: "deck-1",
    name: "Deck 1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-04T00:00:00.000Z",
    categories: current?.categories,
    cards: current?.workingCards,
    layout: current?.stackLayout,
    saves,
  };
}

function save(id: string, savedAt: string, editorSnapshot: EditorSnapshot): DeckSave {
  return {
    id,
    label: id,
    savedAt,
    categories: editorSnapshot.categories,
    cards: editorSnapshot.workingCards,
    layout: editorSnapshot.stackLayout,
  };
}

function snapshot(oracleId: string, quantity: number): EditorSnapshot {
  return {
    categories: [
      { id: "creature", name: "Creature", kind: "default" },
      { id: "artifact", name: "Artifact", kind: "default" },
    ],
    stackLayout: { lanes: [["creature"], ["artifact"]] },
    workingCards: [card(oracleId, quantity)],
  };
}

function card(
  oracleId: string,
  quantity: number,
  overrides: Partial<ValidatedDeckCard> = {},
): ValidatedDeckCard {
  return {
    oracleId,
    name: oracleId,
    quantity,
    typeLine: "Creature",
    categoryId: "creature",
    ...overrides,
  };
}

function editorRow(oracleId: string, quantity: number) {
  return {
    ...card(oracleId, quantity),
    baselineQuantity: quantity,
    currentQuantity: quantity,
    category: "creature" as const,
    manaValue: 1,
    status: "same" as const,
  };
}
