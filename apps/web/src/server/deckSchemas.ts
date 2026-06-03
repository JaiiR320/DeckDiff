import { z } from "zod";
import type { DeckColor, DeckStackLayout, DeckTileCover } from "#/lib/deck";
import {
  normalizeCategoryNameForCompare,
  type DeckCategory,
  type ValidatedDeckCard,
} from "#/lib/decklist";

export type CreateDeckInput = { name: string; folderId?: string | null };
export type RenameDeckInput = { deckId: string; newName: string };
export type DeleteDeckInput = { deckId: string };
export type GetDeckInput = { deckId: string };
export type ListDeckFolderViewInput = { folderPath?: string };
export type CreateFolderInput = { name: string; parentFolderId?: string | null };
export type DeleteFolderInput = { folderId: string };
export type RenameFolderInput = { folderId: string; newName: string };
export type ReorderFoldersInput = { parentFolderId?: string | null; folderIds: string[] };
export type MoveDeckToFolderInput = { deckId: string; folderId?: string | null };
export type SaveDeckInput = {
  deckId: string;
  label: string;
  categories?: DeckCategory[];
  cards: ValidatedDeckCard[];
  layout?: DeckStackLayout;
};
export type UpdateDeckCurrentInput = {
  deckId: string;
  categories: DeckCategory[];
  cards: ValidatedDeckCard[];
  layout: DeckStackLayout;
};
export type UpdateDeckCoverInput = {
  deckId: string;
  cover: DeckTileCover | null;
};
export type UpdateDeckColorsInput = {
  deckId: string;
  colors: DeckColor[];
};

export const deckIdSchema = z.object({
  deckId: z.string().trim().min(1, "Deck ID is required."),
});

const deckNameSchema = z.string().trim().min(1, "Deck name is required.");

export const createDeckInputSchema = z.object({
  name: deckNameSchema,
  folderId: z.string().trim().min(1, "Folder ID is required.").nullable().optional(),
});

export const listDeckFolderViewInputSchema = z.object({
  folderPath: z.string().optional(),
});

export const createFolderInputSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required."),
  parentFolderId: z.string().trim().min(1, "Folder ID is required.").nullable().optional(),
});

export const deleteFolderInputSchema = z.object({
  folderId: z.string().trim().min(1, "Folder ID is required."),
});

export const renameFolderInputSchema = z.object({
  folderId: z.string().trim().min(1, "Folder ID is required."),
  newName: z.string().trim().min(1, "Folder name is required."),
});

export const reorderFoldersInputSchema = z.object({
  parentFolderId: z.string().trim().min(1, "Folder ID is required.").nullable().optional(),
  folderIds: z.array(z.string().trim().min(1, "Folder ID is required.")).min(1),
});

export const moveDeckToFolderInputSchema = z.object({
  deckId: z.string().trim().min(1, "Deck ID is required."),
  folderId: z.string().trim().min(1, "Folder ID is required.").nullable().optional(),
});

export const renameDeckInputSchema = z.object({
  deckId: z.string().trim().min(1, "Deck ID is required."),
  newName: deckNameSchema,
});

const legacyCardCategorySchema = z.enum([
  "Land",
  "Creature",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
  "Planeswalker",
  "Battle",
  "Other",
]);
const deckColorSchema = z.enum(["W", "U", "B", "R", "G"]);

const deckCategorySchema = z.object({
  id: z.string().trim().min(1, "Category ID is required."),
  name: z.string().trim().min(1, "Category name is required."),
  kind: z.enum(["default", "custom"]).optional(),
  hidden: z.boolean().optional(),
  includeInDeck: z.boolean().optional(),
});

const cardPreviewFaceSchema = z.object({
  name: z.string().trim().min(1, "Card face name is required."),
  typeLine: z.string().trim().min(1, "Card face type line is required."),
  manaCost: z.string().optional(),
  oracleText: z.string().optional(),
  smallImageUrl: z.string().min(1, "Card face small image URL is required."),
  imageUrl: z.string().min(1, "Card face image URL is required."),
});

const deckTileCoverCardSchema = z.object({
  oracleId: z.string().trim().min(1, "Card oracle ID is required."),
  setCode: z.string().trim().min(1, "Card set code is required.").optional(),
  collectorNumber: z.string().trim().min(1, "Card collector number is required.").optional(),
  name: z.string().trim().min(1, "Cover name is required."),
  imageUrl: z.string().min(1, "Cover image URL is required."),
});

const singleDeckTileCoverSchema = deckTileCoverCardSchema.extend({
  source: z.enum(["manual", "commander"]).optional(),
  kind: z.literal("single").optional(),
});

const splitDeckTileCoverSchema = z.object({
  source: z.literal("commander"),
  kind: z.literal("split"),
  cards: z.tuple([deckTileCoverCardSchema, deckTileCoverCardSchema]),
  reversed: z.boolean().optional(),
});

const deckTileCoverSchema = z.union([singleDeckTileCoverSchema, splitDeckTileCoverSchema]);

const validatedDeckCardSchema = z.object({
  oracleId: z.string().trim().min(1, "Card oracle ID is required."),
  name: z.string().trim().min(1, "Card name is required."),
  quantity: z.number().int().positive("Card quantity must be greater than zero."),
  typeLine: z.string().trim().min(1, "Card type line is required."),
  categoryId: z.string().trim().min(1, "Card category ID is required.").optional(),
  category: legacyCardCategorySchema.optional(),
  manaCost: z.string().optional(),
  manaValue: z.number().nonnegative().optional(),
  producedMana: z.array(z.string()).optional(),
  setCode: z.string().trim().min(1, "Card set code is required."),
  collectorNumber: z.string().trim().min(1, "Card collector number is required."),
  smallImageUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  faces: z.array(cardPreviewFaceSchema).optional(),
  priceUsd: z.number().nonnegative().optional(),
  edhrecRank: z.number().int().nonnegative().nullable().optional(),
});

const deckStackLayoutSchema = z.object({
  lanes: z.array(z.array(z.string().trim().min(1))),
  showRemovedCardGhosts: z.boolean().optional(),
  cardSort: z.enum(["manaValue", "alphabetical", "price", "edhrecRank"]).optional(),
  cardSortDirection: z.enum(["asc", "desc"]).optional(),
});

export const saveDeckInputSchema = z.object({
  deckId: z.string().trim().min(1, "Deck ID is required."),
  label: z.string(),
  categories: z
    .array(deckCategorySchema)
    .superRefine((categories, context) => {
      const names = new Set<string>();

      for (const [index, category] of categories.entries()) {
        const name = normalizeCategoryNameForCompare(category.name);

        if (names.has(name)) {
          context.addIssue({
            code: "custom",
            message: "Category names must be unique.",
            path: [index, "name"],
          });
        }

        names.add(name);
      }
    })
    .optional(),
  cards: z.array(validatedDeckCardSchema),
  layout: deckStackLayoutSchema.optional(),
});

export const updateDeckCurrentInputSchema = z.object({
  deckId: z.string().trim().min(1, "Deck ID is required."),
  categories: z.array(deckCategorySchema),
  cards: z.array(validatedDeckCardSchema),
  layout: deckStackLayoutSchema,
});

export const updateDeckCoverInputSchema = z.object({
  deckId: z.string().trim().min(1, "Deck ID is required."),
  cover: deckTileCoverSchema.nullable(),
});

export const updateDeckColorsInputSchema = z.object({
  deckId: z.string().trim().min(1, "Deck ID is required."),
  colors: z.array(deckColorSchema),
});
