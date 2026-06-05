import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { db } from "#/db";
import { deckFolderEntries, deckSaves, decks, folders } from "#/db/schema";
import { auth } from "#/lib/auth";
import { createCommanderDeckCover, shouldRefreshCommanderCover } from "#/lib/deckCover";
import { slugifyName, type DeckFolder, type DeckFolderOption } from "#/lib/deck";
import { mapDeck, type DeckSaveRow } from "./deckMappers";
import {
  createFolderInputSchema,
  createDeckInputSchema,
  deleteFolderInputSchema,
  deckIdSchema,
  listDeckFolderViewInputSchema,
  moveDeckToFolderInputSchema,
  renameDeckInputSchema,
  renameFolderInputSchema,
  reorderFoldersInputSchema,
  saveDeckInputSchema,
  updateDeckCoverInputSchema,
  updateDeckColorsInputSchema,
  updateDeckCurrentInputSchema,
  updateFolderBackgroundInputSchema,
  type CreateDeckInput,
  type CreateFolderInput,
  type DeleteDeckInput,
  type DeleteFolderInput,
  type GetDeckInput,
  type ListDeckFolderViewInput,
  type MoveDeckToFolderInput,
  type RenameDeckInput,
  type RenameFolderInput,
  type ReorderFoldersInput,
  type SaveDeckInput,
  type UpdateDeckCoverInput,
  type UpdateDeckColorsInput,
  type UpdateDeckCurrentInput,
  type UpdateFolderBackgroundInput,
} from "./deckSchemas";

async function requireUserId() {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
  });

  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
}

type FolderRow = typeof folders.$inferSelect;

function mapFolder(folder: FolderRow): DeckFolder {
  return {
    id: folder.id,
    name: folder.name,
    slug: folder.slug,
    parentFolderId: folder.parentFolderId ?? undefined,
    background: folder.background ?? undefined,
    sortOrder: folder.sortOrder,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

function normalizeFolderPath(path?: string) {
  return (path ?? "").trim().replace(/^\/+|\/+$/g, "");
}

function folderParentMatches(folder: FolderRow, parentFolderId: string | null) {
  return (folder.parentFolderId ?? null) === parentFolderId;
}

function resolveFolderPath(allFolders: FolderRow[], folderPath?: string) {
  const segments = normalizeFolderPath(folderPath).split("/").filter(Boolean);
  const breadcrumbs = [] as Array<{ folder: FolderRow; path: string }>;
  const foldersByParentAndSlug = new Map(
    allFolders.map((folder) => [`${folder.parentFolderId ?? ""}/${folder.slug}`, folder]),
  );
  let parentFolderId: string | null = null;
  let currentFolder: FolderRow | null = null;
  let currentPath = "";

  for (const slug of segments) {
    const folder = foldersByParentAndSlug.get(`${parentFolderId ?? ""}/${slug}`);

    if (!folder) {
      throw new Error("Folder not found.");
    }

    currentPath = currentPath ? `${currentPath}/${folder.slug}` : folder.slug;
    breadcrumbs.push({ folder, path: currentPath });
    parentFolderId = folder.id;
    currentFolder = folder;
  }

  return { breadcrumbs, currentFolder, currentFolderPath: currentPath };
}

function buildFolderOptions(allFolders: FolderRow[]): DeckFolderOption[] {
  const foldersByParentId = new Map<string | null, FolderRow[]>();

  for (const folder of allFolders) {
    const parentId = folder.parentFolderId ?? null;
    foldersByParentId.set(parentId, [...(foldersByParentId.get(parentId) ?? []), folder]);
  }

  for (const siblingFolders of foldersByParentId.values()) {
    siblingFolders.sort(
      (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
    );
  }

  const options: DeckFolderOption[] = [];

  function appendFolderOptions(parentFolderId: string | null, parentPath: string, depth: number) {
    for (const folder of foldersByParentId.get(parentFolderId) ?? []) {
      const path = parentPath ? `${parentPath}/${folder.slug}` : folder.slug;
      options.push({ ...mapFolder(folder), path, depth });
      appendFolderOptions(folder.id, path, depth + 1);
    }
  }

  appendFolderOptions(null, "", 0);
  return options;
}

function countFolderContents(
  folderId: string,
  foldersByParentId: Map<string | null, FolderRow[]>,
  deckCountByFolderId: Map<string, number>,
) {
  let folderCount = 0;
  let deckCount = deckCountByFolderId.get(folderId) ?? 0;

  for (const childFolder of foldersByParentId.get(folderId) ?? []) {
    const childCounts = countFolderContents(childFolder.id, foldersByParentId, deckCountByFolderId);
    folderCount += 1 + childCounts.folderCount;
    deckCount += childCounts.deckCount;
  }

  return { folderCount, deckCount };
}

async function getDeckRowsWithSaves(userId: string, folderId?: string | null) {
  const deckRows = await db
    .select()
    .from(decks)
    .where(eq(decks.userId, userId))
    .orderBy(desc(decks.updatedAt));

  if (deckRows.length === 0) {
    return [];
  }

  const entryRows = await db
    .select()
    .from(deckFolderEntries)
    .where(
      inArray(
        deckFolderEntries.deckId,
        deckRows.map((deck) => deck.id),
      ),
    );
  const folderIdsByDeckId = new Map(entryRows.map((entry) => [entry.deckId, entry.folderId]));
  const targetDeckRows = deckRows.filter(
    (deck) => (folderIdsByDeckId.get(deck.id) ?? null) === (folderId ?? null),
  );

  if (targetDeckRows.length === 0) {
    return [];
  }

  const saveRows = await db
    .select()
    .from(deckSaves)
    .where(
      inArray(
        deckSaves.deckId,
        targetDeckRows.map((deck) => deck.id),
      ),
    )
    .orderBy(asc(deckSaves.savedAt));

  const savesByDeckId = new Map<string, DeckSaveRow[]>();

  for (const save of saveRows) {
    const current = savesByDeckId.get(save.deckId) ?? [];
    current.push(save);
    savesByDeckId.set(save.deckId, current);
  }

  return targetDeckRows.map((deck) => mapDeck(deck, savesByDeckId.get(deck.id) ?? []));
}

async function getDeckWithSavesBySlug(userId: string, slug: string) {
  const deckRow = await db.query.decks.findFirst({
    where: and(eq(decks.userId, userId), eq(decks.slug, slug)),
  });

  if (!deckRow) {
    return null;
  }

  const saveRows = await db
    .select()
    .from(deckSaves)
    .where(eq(deckSaves.deckId, deckRow.id))
    .orderBy(asc(deckSaves.savedAt));

  return mapDeck(deckRow, saveRows);
}

async function getUniqueDeckIdentity(
  userId: string,
  name: string,
  currentDeckId?: string,
): Promise<string> {
  const existingDecks = await db
    .select({ slug: decks.slug })
    .from(decks)
    .where(
      currentDeckId
        ? and(eq(decks.userId, userId), ne(decks.id, currentDeckId))
        : eq(decks.userId, userId),
    );

  const existingSlugs = new Set(existingDecks.map((deck) => deck.slug));
  const baseSlug = slugifyName(name) || "deck";

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  let nextSlug = `${baseSlug}-${suffix}`;

  while (existingSlugs.has(nextSlug)) {
    suffix += 1;
    nextSlug = `${baseSlug}-${suffix}`;
  }

  return nextSlug;
}

async function getUniqueSlug(userId: string, name: string, currentDeckId?: string) {
  return getUniqueDeckIdentity(userId, name, currentDeckId);
}

async function getUniqueFolderSlug(
  userId: string,
  parentFolderId: string | null,
  name: string,
  currentFolderId?: string,
) {
  const siblingFolders = await db
    .select({ slug: folders.slug })
    .from(folders)
    .where(
      and(
        eq(folders.userId, userId),
        parentFolderId
          ? eq(folders.parentFolderId, parentFolderId)
          : isNull(folders.parentFolderId),
        currentFolderId ? ne(folders.id, currentFolderId) : undefined,
      ),
    );
  const existingSlugs = new Set(siblingFolders.map((folder) => folder.slug));
  const baseSlug = slugifyName(name) || "folder";

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  let nextSlug = `${baseSlug}-${suffix}`;

  while (existingSlugs.has(nextSlug)) {
    suffix += 1;
    nextSlug = `${baseSlug}-${suffix}`;
  }

  return nextSlug;
}

async function requireFolderForUser(userId: string, folderId: string) {
  const folder = await db.query.folders.findFirst({
    where: and(eq(folders.userId, userId), eq(folders.id, folderId)),
  });

  if (!folder) {
    throw new Error("Folder not found.");
  }

  return folder;
}

async function getSiblingFolders(userId: string, parentFolderId: string | null) {
  return db
    .select()
    .from(folders)
    .where(
      and(
        eq(folders.userId, userId),
        parentFolderId
          ? eq(folders.parentFolderId, parentFolderId)
          : isNull(folders.parentFolderId),
      ),
    )
    .orderBy(asc(folders.sortOrder), asc(folders.name));
}

export const listDecks = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return getDeckRowsWithSaves(userId);
});

export const listDeckFolderView = createServerFn({ method: "GET" })
  .inputValidator((data: ListDeckFolderViewInput) => listDeckFolderViewInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const allFolders = await db
      .select()
      .from(folders)
      .where(eq(folders.userId, userId))
      .orderBy(asc(folders.sortOrder), asc(folders.name));
    const { breadcrumbs, currentFolder, currentFolderPath } = resolveFolderPath(
      allFolders,
      data.folderPath,
    );
    const currentFolderId = currentFolder?.id ?? null;
    const childFolders = allFolders.filter((folder) =>
      folderParentMatches(folder, currentFolderId),
    );
    const userDeckRows = await db.select().from(decks).where(eq(decks.userId, userId));
    const entryRows =
      userDeckRows.length === 0
        ? []
        : await db
            .select()
            .from(deckFolderEntries)
            .where(
              inArray(
                deckFolderEntries.deckId,
                userDeckRows.map((deck) => deck.id),
              ),
            );
    const folderIdsWithDecks = new Set(entryRows.map((entry) => entry.folderId));
    const folderIdsWithChildren = new Set(
      allFolders.flatMap((folder) => (folder.parentFolderId ? [folder.parentFolderId] : [])),
    );
    const foldersByParentId = new Map<string | null, FolderRow[]>();

    for (const folder of allFolders) {
      const parentId = folder.parentFolderId ?? null;
      foldersByParentId.set(parentId, [...(foldersByParentId.get(parentId) ?? []), folder]);
    }

    const deckCountByFolderId = new Map<string, number>();

    for (const entry of entryRows) {
      deckCountByFolderId.set(entry.folderId, (deckCountByFolderId.get(entry.folderId) ?? 0) + 1);
    }

    const deckFolderIds = Object.fromEntries(
      userDeckRows.map((deck) => [
        deck.slug,
        entryRows.find((entry) => entry.deckId === deck.id)?.folderId ?? null,
      ]),
    );

    const currentFolderCounts = currentFolder
      ? countFolderContents(currentFolder.id, foldersByParentId, deckCountByFolderId)
      : null;

    return {
      currentFolder: currentFolder
        ? {
            ...mapFolder(currentFolder),
            isEmpty:
              !folderIdsWithChildren.has(currentFolder.id) &&
              !folderIdsWithDecks.has(currentFolder.id),
            folderCount: currentFolderCounts?.folderCount ?? 0,
            deckCount: currentFolderCounts?.deckCount ?? 0,
          }
        : undefined,
      currentFolderPath,
      breadcrumbs: breadcrumbs.map(({ folder, path }) => ({
        id: folder.id,
        name: folder.name,
        path,
      })),
      folders: childFolders.map((folder) => ({
        ...mapFolder(folder),
        isEmpty: !folderIdsWithChildren.has(folder.id) && !folderIdsWithDecks.has(folder.id),
        ...countFolderContents(folder.id, foldersByParentId, deckCountByFolderId),
      })),
      folderOptions: buildFolderOptions(allFolders),
      deckFolderIds,
      decks: await getDeckRowsWithSaves(userId, currentFolderId),
    };
  });

export const createFolderForUser = createServerFn({ method: "POST" })
  .inputValidator((data: CreateFolderInput) => createFolderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const name = data.name.trim();
    const parentFolderId = data.parentFolderId ?? null;

    if (parentFolderId) {
      await requireFolderForUser(userId, parentFolderId);
    }

    const now = new Date();
    const siblingFolders = await getSiblingFolders(userId, parentFolderId);
    const maxSortOrder = Math.max(-1, ...siblingFolders.map((folder) => folder.sortOrder));
    const folder = {
      id: crypto.randomUUID(),
      userId,
      parentFolderId,
      slug: await getUniqueFolderSlug(userId, parentFolderId, name),
      name,
      background: null,
      sortOrder: maxSortOrder + 1,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(folders).values(folder);
    return mapFolder(folder);
  });

export const deleteFolderForUser = createServerFn({ method: "POST" })
  .inputValidator((data: DeleteFolderInput) => deleteFolderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const folder = await requireFolderForUser(userId, data.folderId);
    const childFolders = await db
      .select({ id: folders.id })
      .from(folders)
      .where(and(eq(folders.userId, userId), eq(folders.parentFolderId, folder.id)));

    if (childFolders.length > 0) {
      throw new Error("Folder must be empty before it can be deleted.");
    }

    const assignedDecks = await db
      .select({ deckId: deckFolderEntries.deckId })
      .from(deckFolderEntries)
      .where(eq(deckFolderEntries.folderId, folder.id));

    if (assignedDecks.length > 0) {
      throw new Error("Folder must be empty before it can be deleted.");
    }

    await db.delete(folders).where(eq(folders.id, folder.id));
    return { success: true, parentFolderId: folder.parentFolderId };
  });

export const renameFolderForUser = createServerFn({ method: "POST" })
  .inputValidator((data: RenameFolderInput) => renameFolderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const folder = await requireFolderForUser(userId, data.folderId);
    const nextName = data.newName.trim();
    const nextSlug = await getUniqueFolderSlug(
      userId,
      folder.parentFolderId ?? null,
      nextName,
      folder.id,
    );

    await db
      .update(folders)
      .set({ name: nextName, slug: nextSlug, updatedAt: new Date() })
      .where(eq(folders.id, folder.id));

    const updatedFolder = await requireFolderForUser(userId, folder.id);
    return mapFolder(updatedFolder);
  });

export const updateFolderBackgroundForUser = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateFolderBackgroundInput) =>
    updateFolderBackgroundInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const folder = await requireFolderForUser(userId, data.folderId);

    await db
      .update(folders)
      .set({ background: data.background, updatedAt: new Date() })
      .where(eq(folders.id, folder.id));

    const updatedFolder = await requireFolderForUser(userId, folder.id);
    return mapFolder(updatedFolder);
  });

export const reorderFoldersForUser = createServerFn({ method: "POST" })
  .inputValidator((data: ReorderFoldersInput) => reorderFoldersInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const parentFolderId = data.parentFolderId ?? null;

    if (parentFolderId) {
      await requireFolderForUser(userId, parentFolderId);
    }

    const siblingFolders = await getSiblingFolders(userId, parentFolderId);
    const siblingIds = new Set(siblingFolders.map((folder) => folder.id));
    const nextIds = new Set(data.folderIds);

    if (
      siblingIds.size !== data.folderIds.length ||
      nextIds.size !== data.folderIds.length ||
      data.folderIds.some((folderId) => !siblingIds.has(folderId))
    ) {
      throw new Error("Folder order does not match the current folder list.");
    }

    const now = new Date();
    await Promise.all(
      data.folderIds.map((folderId, sortOrder) =>
        db.update(folders).set({ sortOrder, updatedAt: now }).where(eq(folders.id, folderId)),
      ),
    );

    return { success: true };
  });

export const moveDeckToFolderForUser = createServerFn({ method: "POST" })
  .inputValidator((data: MoveDeckToFolderInput) => moveDeckToFolderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const folderId = data.folderId ?? null;
    const existingDeck = await db.query.decks.findFirst({
      where: and(eq(decks.userId, userId), eq(decks.slug, data.deckId)),
    });

    if (!existingDeck) {
      throw new Error("Deck not found.");
    }

    if (folderId) {
      await requireFolderForUser(userId, folderId);
    }

    await db.delete(deckFolderEntries).where(eq(deckFolderEntries.deckId, existingDeck.id));

    if (folderId) {
      await db.insert(deckFolderEntries).values({ deckId: existingDeck.id, folderId });
    }

    return { success: true };
  });

export const getDeck = createServerFn({ method: "GET" })
  .inputValidator((data: GetDeckInput) => deckIdSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return getDeckWithSavesBySlug(userId, data.deckId);
  });

export const createDeckForUser = createServerFn({ method: "POST" })
  .inputValidator((data: CreateDeckInput) => createDeckInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const name = data.name.trim();

    if (!name) {
      throw new Error("Deck name is required.");
    }

    const now = new Date();
    const slug = await getUniqueSlug(userId, name);
    const id = crypto.randomUUID();
    const folderId = data.folderId ?? null;

    if (folderId) {
      await requireFolderForUser(userId, folderId);
    }

    await db.insert(decks).values({
      id,
      userId,
      slug,
      name,
      createdAt: now,
      updatedAt: now,
    });

    if (folderId) {
      await db.insert(deckFolderEntries).values({ deckId: id, folderId });
    }

    return getDeckWithSavesBySlug(userId, slug);
  });

export const renameDeckForUser = createServerFn({ method: "POST" })
  .inputValidator((data: RenameDeckInput) => renameDeckInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const nextName = data.newName.trim();

    if (!nextName) {
      throw new Error("Deck name is required.");
    }

    const existingDeck = await db.query.decks.findFirst({
      where: and(eq(decks.userId, userId), eq(decks.slug, data.deckId)),
    });

    if (!existingDeck) {
      throw new Error("Deck not found.");
    }

    const nextSlug = await getUniqueSlug(userId, nextName, existingDeck.id);

    await db
      .update(decks)
      .set({
        slug: nextSlug,
        name: nextName,
        updatedAt: new Date(),
      })
      .where(eq(decks.id, existingDeck.id));

    return getDeckWithSavesBySlug(userId, nextSlug);
  });

export const deleteDeckForUser = createServerFn({ method: "POST" })
  .inputValidator((data: DeleteDeckInput) => deckIdSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();

    const existingDeck = await db.query.decks.findFirst({
      where: and(eq(decks.userId, userId), eq(decks.slug, data.deckId)),
    });

    if (!existingDeck) {
      return { success: false };
    }

    await db.delete(decks).where(eq(decks.id, existingDeck.id));
    return { success: true };
  });

export const saveDeckForUser = createServerFn({ method: "POST" })
  .inputValidator((data: SaveDeckInput) => saveDeckInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();

    const existingDeck = await db.query.decks.findFirst({
      where: and(eq(decks.userId, userId), eq(decks.slug, data.deckId)),
    });

    if (!existingDeck) {
      throw new Error("Deck not found.");
    }

    const saveLabel = data.label.trim() || `Save #1`;
    const now = new Date();
    const cover = shouldRefreshCommanderCover(existingDeck.cover)
      ? createCommanderDeckCover(data.categories, data.cards, existingDeck.cover)
      : existingDeck.cover;

    await db.insert(deckSaves).values({
      id: crypto.randomUUID(),
      deckId: existingDeck.id,
      label: saveLabel,
      savedAt: now,
      categories: data.categories ?? null,
      cards: data.cards,
      layout: data.layout ?? null,
    });

    await db
      .update(decks)
      .set({
        cover,
        updatedAt: now,
      })
      .where(eq(decks.id, existingDeck.id));

    return getDeckWithSavesBySlug(userId, existingDeck.slug);
  });

export const updateDeckCurrentForUser = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateDeckCurrentInput) => updateDeckCurrentInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();

    const existingDeck = await db.query.decks.findFirst({
      where: and(eq(decks.userId, userId), eq(decks.slug, data.deckId)),
    });

    if (!existingDeck) {
      throw new Error("Deck not found.");
    }

    const cover = shouldRefreshCommanderCover(existingDeck.cover)
      ? createCommanderDeckCover(data.categories, data.cards, existingDeck.cover)
      : existingDeck.cover;

    await db
      .update(decks)
      .set({
        categories: data.categories,
        cards: data.cards,
        cover,
        layout: data.layout,
        updatedAt: new Date(),
      })
      .where(eq(decks.id, existingDeck.id));

    return getDeckWithSavesBySlug(userId, existingDeck.slug);
  });

export const updateDeckCoverForUser = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateDeckCoverInput) => updateDeckCoverInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();

    const existingDeck = await db.query.decks.findFirst({
      where: and(eq(decks.userId, userId), eq(decks.slug, data.deckId)),
    });

    if (!existingDeck) {
      throw new Error("Deck not found.");
    }

    await db
      .update(decks)
      .set({
        cover: data.cover,
        updatedAt: new Date(),
      })
      .where(eq(decks.id, existingDeck.id));

    return getDeckWithSavesBySlug(userId, existingDeck.slug);
  });

export const updateDeckColorsForUser = createServerFn({ method: "POST" })
  .inputValidator((data: UpdateDeckColorsInput) => updateDeckColorsInputSchema.parse(data))
  .handler(async ({ data }) => {
    const userId = await requireUserId();

    const existingDeck = await db.query.decks.findFirst({
      where: and(eq(decks.userId, userId), eq(decks.slug, data.deckId)),
    });

    if (!existingDeck) {
      throw new Error("Deck not found.");
    }

    await db
      .update(decks)
      .set({
        colors: data.colors,
        updatedAt: new Date(),
      })
      .where(eq(decks.id, existingDeck.id));

    return getDeckWithSavesBySlug(userId, existingDeck.slug);
  });
