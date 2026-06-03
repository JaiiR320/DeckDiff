import type { CardCategory, DeckCategory, ValidatedDeckCard } from "./decklist";

export type DeckColor = "W" | "U" | "B" | "R" | "G";
export type DeckCardSort = "manaValue" | "alphabetical" | "price" | "edhrecRank";
export type DeckCardSortDirection = "asc" | "desc";

export type DeckStackLayout = {
  lanes: CardCategory[][];
  showRemovedCardGhosts?: boolean;
  cardSort?: DeckCardSort;
  cardSortDirection?: DeckCardSortDirection;
};

export type DeckSave = {
  id: string; // crypto.randomUUID()
  savedAt: string; // ISO-8601
  label: string; // "Save #N" or user-provided
  categories?: DeckCategory[];
  cards: ValidatedDeckCard[];
  layout?: DeckStackLayout;
};

export type DeckTileCoverCard = {
  oracleId: string;
  setCode?: string;
  collectorNumber?: string;
  name: string;
  imageUrl: string;
};

type SingleDeckTileCover = DeckTileCoverCard & {
  source?: "manual" | "commander";
  kind?: "single";
};

export type DeckTileCover =
  | SingleDeckTileCover
  | {
      source: "commander";
      kind: "split";
      cards: [DeckTileCoverCard, DeckTileCoverCard];
      reversed?: boolean;
    };

export type DeckItem = {
  id: string; // slugified name, e.g., "my-commander-deck"
  name: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  categories?: DeckCategory[];
  cards?: ValidatedDeckCard[];
  colors?: DeckColor[];
  cover?: DeckTileCover;
  layout?: DeckStackLayout;
  saves: DeckSave[]; // oldest-first
};

export type DeckFolder = {
  id: string;
  name: string;
  slug: string;
  parentFolderId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type DeckBreadcrumb = {
  id: string;
  name: string;
  path: string;
};

export type DeckFolderOption = DeckFolder & {
  path: string;
  depth: number;
};

export type DeckFolderView = {
  currentFolder?: DeckFolder & { isEmpty: boolean; folderCount: number; deckCount: number };
  currentFolderPath: string;
  breadcrumbs: DeckBreadcrumb[];
  folders: Array<DeckFolder & { isEmpty: boolean; folderCount: number; deckCount: number }>;
  folderOptions: DeckFolderOption[];
  deckFolderIds: Record<string, string | null>;
  decks: DeckItem[];
};

/**
 * Converts a deck name to a URL-safe slug for use as the deck ID.
 * "My Commander Deck" → "my-commander-deck"
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special chars except underscores, spaces, hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Trim leading/trailing hyphens
}

/**
 * Returns the most recent save for a deck, or null if no saves exist.
 */
export function getLatestSave(deck: DeckItem): DeckSave | null {
  if (deck.saves.length === 0) {
    return null;
  }
  return deck.saves[deck.saves.length - 1];
}
