import { DragDropProvider, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  GripVertical,
  Image,
  ImageOff,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useReducer, useRef } from "react";
import type { FormEvent } from "react";
import { DeckActionsModal } from "#/components/decks/DeckActionsModal";
import { CreateDeckModal } from "#/components/decks/CreateDeckModal";
import { DeckCard } from "#/components/decks/DeckCard";
import { ImageCropModal } from "#/components/decks/ImageCropModal";
import { Button } from "#/components/ui/Button";
import { IconButton } from "#/components/ui/IconButton";
import { Input } from "#/components/ui/Input";
import { Modal } from "#/components/ui/Modal";
import type { DeckFolderView, DeckItem } from "#/lib/deck";
import { swapSplitDeckCover } from "#/lib/deckCover";
import { createDeckExport } from "#/lib/deckExport";
import { getImageCropStyle } from "#/lib/imageCrop";
import {
  createDeckForUser,
  createFolderForUser,
  deleteDeckForUser,
  deleteFolderForUser,
  moveDeckToFolderForUser,
  renameDeckForUser,
  renameFolderForUser,
  reorderFoldersForUser,
  updateDeckCoverForUser,
  updateFolderBackgroundForUser,
} from "#/server/decks";

type DecksPageState = {
  isCreateDeckOpen: boolean;
  isCreateFolderOpen: boolean;
  name: string;
  editingDeck: DeckItem | null;
  cropDeck: DeckItem | null;
  editingFolder: DeckFolderView["folders"][number] | DeckFolderView["currentFolder"] | null;
  cropFolder: DeckFolderView["folders"][number] | DeckFolderView["currentFolder"] | null;
  folderName: string;
  folderBackgroundUrl: string;
  showFolderDeleteConfirm: boolean;
  folderOffset: number;
  optimisticFolderIds: string[] | null;
  visibleFolderSlots: number;
  errorMessage: string | null;
};

type FolderCardProps = {
  folder: DeckFolderView["folders"][number];
  path: string;
  onOpen: (path: string) => void;
  onEdit: (folder: DeckFolderView["folders"][number]) => void;
};

type EditableFolder = NonNullable<DecksPageState["editingFolder"]>;
type FolderViewItem = DeckFolderView["folders"][number];

function folderSearch(folderPath: string) {
  return { folder: folderPath || undefined };
}

function reorderFolders(folders: FolderViewItem[], sourceFolderId: string, targetFolderId: string) {
  const sourceIndex = folders.findIndex((folder) => folder.id === sourceFolderId);
  const targetIndex = folders.findIndex((folder) => folder.id === targetFolderId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return folders;
  }

  const nextFolders = [...folders];
  const [movedFolder] = nextFolders.splice(sourceIndex, 1);
  if (!movedFolder) {
    return folders;
  }

  nextFolders.splice(targetIndex, 0, movedFolder);
  return nextFolders;
}

function applyFolderOrder(folders: FolderViewItem[], folderIds: string[] | null) {
  if (!folderIds) return folders;

  const foldersById = new Map(folders.map((folder) => [folder.id, folder]));
  const orderedFolders = folderIds.flatMap((folderId) => {
    const folder = foldersById.get(folderId);
    return folder ? [folder] : [];
  });

  return orderedFolders.length === folders.length ? orderedFolders : folders;
}

const deckGridClass =
  "grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,24rem),24rem))]";

export function DecksPage() {
  const view = useLoaderData({ from: "/decks" }) as DeckFolderView;
  const navigate = useNavigate({ from: "/decks" });
  const router = useRouter();
  const [state, setState] = useReducer(
    (current: DecksPageState, next: Partial<DecksPageState>) => ({ ...current, ...next }),
    {
      isCreateDeckOpen: false,
      isCreateFolderOpen: false,
      name: "",
      editingDeck: null,
      cropDeck: null,
      editingFolder: null,
      cropFolder: null,
      folderName: "",
      folderBackgroundUrl: "",
      showFolderDeleteConfirm: false,
      folderOffset: 0,
      optimisticFolderIds: null,
      visibleFolderSlots: 1,
      errorMessage: null,
    },
  );
  const {
    isCreateDeckOpen,
    isCreateFolderOpen,
    name,
    editingDeck,
    cropDeck,
    editingFolder,
    cropFolder,
    folderName,
    folderBackgroundUrl,
    showFolderDeleteConfirm,
    folderOffset,
    optimisticFolderIds,
    visibleFolderSlots,
    errorMessage,
  } = state;
  const folderViewportRef = useRef<HTMLDivElement | null>(null);
  const currentFolderId = view.currentFolder?.id ?? null;

  useEffect(() => {
    const viewport = folderViewportRef.current;
    if (!viewport) return;
    const viewportElement = viewport;

    function updateVisibleFolderSlots() {
      const cardWidth = 384;
      const gapWidth = 20;
      const nextSlots = Math.max(
        1,
        Math.floor((viewportElement.clientWidth + gapWidth) / (cardWidth + gapWidth)),
      );
      setState({ visibleFolderSlots: nextSlots });
    }

    updateVisibleFolderSlots();
    const resizeObserver = new ResizeObserver(updateVisibleFolderSlots);
    resizeObserver.observe(viewportElement);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    setState({ optimisticFolderIds: null });
  }, [currentFolderId, view.folders]);

  function openFolder(folderPath: string) {
    void navigate({ to: "/decks", search: folderSearch(folderPath) });
  }

  function closeCreateModal() {
    setState({ isCreateDeckOpen: false, isCreateFolderOpen: false, name: "" });
  }

  function closeEditModal() {
    setState({ editingDeck: null });
  }

  function closeFolderModal() {
    setState({
      editingFolder: null,
      folderName: "",
      folderBackgroundUrl: "",
      showFolderDeleteConfirm: false,
    });
  }

  async function refreshDecks() {
    await router.invalidate();
  }

  async function handleFolderDragEnd(event: DragEndEvent) {
    const sourceFolderId = String(event.operation.source?.id ?? "");
    const targetFolderId = event.operation.target?.data.folderId as string | undefined;

    if (event.operation.canceled || !sourceFolderId || !targetFolderId) return;

    const nextFolders = reorderFolders(displayedFolders, sourceFolderId, targetFolderId);
    if (nextFolders === displayedFolders) return;

    const folderIds = nextFolders.map((folder) => folder.id);
    setState({ optimisticFolderIds: folderIds, errorMessage: null });

    try {
      await reorderFoldersForUser({ data: { parentFolderId: currentFolderId, folderIds } });
      await refreshDecks();
    } catch (error) {
      setState({
        optimisticFolderIds: null,
        errorMessage:
          error instanceof Error ? error.message : "Could not reorder folders right now.",
      });
      await refreshDecks();
    }
  }

  async function handleCreateDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      const newDeck = await createDeckForUser({
        data: { name: trimmedName, folderId: view.currentFolder?.id ?? null },
      });

      if (!newDeck) {
        throw new Error("Could not create deck.");
      }

      closeCreateModal();
      setState({ errorMessage: null });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage: error instanceof Error ? error.message : "Could not create deck right now.",
      });
    }
  }

  async function handleCreateFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      await createFolderForUser({
        data: { name: trimmedName, parentFolderId: view.currentFolder?.id ?? null },
      });
      closeCreateModal();
      setState({ errorMessage: null });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage: error instanceof Error ? error.message : "Could not create folder right now.",
      });
    }
  }

  async function handleDeleteFolder(folder: EditableFolder) {
    if (!folder.isEmpty) return;

    try {
      await deleteFolderForUser({ data: { folderId: folder.id } });
      closeFolderModal();
      setState({ errorMessage: null });

      if (folder.id === view.currentFolder?.id) {
        const parentPath = view.breadcrumbs.at(-2)?.path ?? "";
        await navigate({ to: "/decks", search: folderSearch(parentPath) });
        return;
      }

      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage: error instanceof Error ? error.message : "Could not delete folder right now.",
      });
    }
  }

  async function handleRenameFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingFolder) return;

    const trimmedName = folderName.trim();
    if (!trimmedName || trimmedName === editingFolder.name) return;

    try {
      await renameFolderForUser({ data: { folderId: editingFolder.id, newName: trimmedName } });
      closeFolderModal();
      setState({ errorMessage: null });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage: error instanceof Error ? error.message : "Could not rename folder right now.",
      });
    }
  }

  async function handleMoveDeck(deckId: string, folderId: string | null) {
    try {
      await moveDeckToFolderForUser({ data: { deckId, folderId } });
      setState({ editingDeck: null, errorMessage: null });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage: error instanceof Error ? error.message : "Could not move deck right now.",
      });
    }
  }

  async function handleRenameDeck(deckId: string, newName: string) {
    try {
      const updatedDeck = await renameDeckForUser({
        data: { deckId, newName },
      });

      if (!updatedDeck) {
        throw new Error("Could not rename deck.");
      }

      setState({ editingDeck: updatedDeck, errorMessage: null });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage: error instanceof Error ? error.message : "Could not rename deck right now.",
      });
    }
  }

  async function handleDeleteDeck(deckId: string) {
    try {
      await deleteDeckForUser({ data: { deckId } });
      setState({ editingDeck: null, errorMessage: null });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage: error instanceof Error ? error.message : "Could not delete deck right now.",
      });
    }
  }

  async function handleClearCover(deckId: string) {
    try {
      const updatedDeck = await updateDeckCoverForUser({ data: { deckId, cover: null } });
      if (!updatedDeck) throw new Error("Could not clear deck cover.");

      setState({ editingDeck: updatedDeck, errorMessage: null });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage:
          error instanceof Error ? error.message : "Could not clear deck cover right now.",
      });
    }
  }

  async function handleSwapSplitCover(deck: DeckItem) {
    try {
      const updatedDeck = await updateDeckCoverForUser({
        data: { deckId: deck.id, cover: deck.cover ? swapSplitDeckCover(deck.cover) : null },
      });
      if (!updatedDeck) throw new Error("Could not swap deck cover.");

      setState({ editingDeck: updatedDeck, errorMessage: null });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage:
          error instanceof Error ? error.message : "Could not swap deck cover right now.",
      });
    }
  }

  async function handleSaveFolderBackground(folder: EditableFolder) {
    const imageUrl = folderBackgroundUrl.trim();

    try {
      const updatedFolder = await updateFolderBackgroundForUser({
        data: {
          folderId: folder.id,
          background: imageUrl
            ? {
                imageUrl,
                crop: folder.background?.imageUrl === imageUrl ? folder.background.crop : undefined,
              }
            : null,
        },
      });

      setState({
        editingFolder: {
          ...folder,
          background: updatedFolder.background,
          updatedAt: updatedFolder.updatedAt,
        },
        errorMessage: null,
      });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage:
          error instanceof Error ? error.message : "Could not update folder background right now.",
      });
    }
  }

  async function handleClearFolderBackground(folder: EditableFolder) {
    try {
      const updatedFolder = await updateFolderBackgroundForUser({
        data: { folderId: folder.id, background: null },
      });

      setState({
        editingFolder: {
          ...folder,
          background: updatedFolder.background,
          updatedAt: updatedFolder.updatedAt,
        },
        folderBackgroundUrl: "",
        errorMessage: null,
      });
      await refreshDecks();
    } catch (error) {
      setState({
        errorMessage:
          error instanceof Error ? error.message : "Could not clear folder background right now.",
      });
    }
  }

  function handleExportDeck(deck: DeckItem) {
    const deckExport = createDeckExport(deck);
    if (!deckExport.ok) {
      alert(deckExport.reason);
      return;
    }

    const blob = new Blob([deckExport.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = deckExport.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setState({ editingDeck: null });
  }

  const displayedFolders = applyFolderOrder(view.folders, optimisticFolderIds);
  const hasItems = displayedFolders.length > 0 || view.decks.length > 0;
  const maxFolderOffset = Math.max(0, displayedFolders.length - visibleFolderSlots);
  const clampedFolderOffset = Math.min(folderOffset, maxFolderOffset);

  return (
    <>
      <main className="mx-auto w-full p-8">
        {errorMessage ? (
          <p className="mb-6 rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
            {errorMessage}
          </p>
        ) : null}

        <div className="mx-auto max-w-[74.5rem]">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Breadcrumbs breadcrumbs={view.breadcrumbs} onOpen={openFolder} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setState({ isCreateDeckOpen: true, name: "" })}>
                <Plus className="size-4" strokeWidth={1.75} />
                New Deck
              </Button>
              <Button size="sm" onClick={() => setState({ isCreateFolderOpen: true, name: "" })}>
                <FolderPlus className="size-4" strokeWidth={1.75} />
                New Folder
              </Button>
              {view.currentFolder ? (
                <IconButton
                  aria-label={`Open ${view.currentFolder.name} settings`}
                  onClick={() =>
                    setState({
                      editingFolder: view.currentFolder,
                      folderName: view.currentFolder?.name ?? "",
                      folderBackgroundUrl: view.currentFolder?.background?.imageUrl ?? "",
                      showFolderDeleteConfirm: false,
                    })
                  }
                  className="p-2"
                >
                  <MoreVertical className="size-4" strokeWidth={1.75} />
                </IconButton>
              ) : null}
            </div>
          </div>

          {displayedFolders.length > 0 ? (
            <section className="relative mb-5">
              <IconButton
                aria-label="Show previous folder"
                disabled={clampedFolderOffset === 0}
                onClick={() => setState({ folderOffset: Math.max(0, clampedFolderOffset - 1) })}
                className="absolute left-0 top-1/2 z-20 -translate-x-[calc(100%+1.25rem)] -translate-y-1/2 p-2"
              >
                <ChevronLeft className="size-5" strokeWidth={1.75} />
              </IconButton>
              <DragDropProvider onDragEnd={handleFolderDragEnd}>
                <div ref={folderViewportRef} className="overflow-hidden">
                  <div
                    className="flex gap-5 transition-transform duration-200 ease-out"
                    style={{
                      transform: `translateX(calc(-${clampedFolderOffset} * (24rem + 1.25rem)))`,
                    }}
                  >
                    {displayedFolders.map((folder) => {
                      const folderPath = view.currentFolderPath
                        ? `${view.currentFolderPath}/${folder.slug}`
                        : folder.slug;
                      return (
                        <FolderCard
                          key={folder.id}
                          folder={folder}
                          path={folderPath}
                          onOpen={openFolder}
                          onEdit={(nextFolder) =>
                            setState({
                              editingFolder: nextFolder,
                              folderName: nextFolder.name,
                              folderBackgroundUrl: nextFolder.background?.imageUrl ?? "",
                              showFolderDeleteConfirm: false,
                            })
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </DragDropProvider>
              <IconButton
                aria-label="Show next folder"
                disabled={clampedFolderOffset >= maxFolderOffset}
                onClick={() =>
                  setState({ folderOffset: Math.min(maxFolderOffset, clampedFolderOffset + 1) })
                }
                className="absolute right-0 top-1/2 z-20 translate-x-[calc(100%+1.25rem)] -translate-y-1/2 p-2"
              >
                <ChevronRight className="size-5" strokeWidth={1.75} />
              </IconButton>
            </section>
          ) : null}

          <section className={deckGridClass}>
            {view.decks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onEdit={(editingDeck) => setState({ editingDeck })}
              />
            ))}
          </section>

          {!hasItems ? (
            <p className="mt-8 text-sm text-zinc-500">
              This folder is empty. Create a deck or folder to get started.
            </p>
          ) : null}
        </div>
      </main>

      {isCreateDeckOpen ? (
        <CreateDeckModal
          deckName={name}
          onDeckNameChange={(nextName) => setState({ name: nextName })}
          onClose={closeCreateModal}
          onSubmit={handleCreateDeck}
        />
      ) : null}

      {isCreateFolderOpen ? (
        <CreateDeckModal
          title="New Folder"
          label="Folder name"
          placeholder="Enter a folder name"
          deckName={name}
          onDeckNameChange={(nextName) => setState({ name: nextName })}
          onClose={closeCreateModal}
          onSubmit={handleCreateFolder}
        />
      ) : null}

      {editingDeck ? (
        <DeckActionsModal
          deck={editingDeck}
          isOpen={true}
          onClose={closeEditModal}
          onRename={handleRenameDeck}
          onDelete={handleDeleteDeck}
          onExport={handleExportDeck}
          onMoveToFolder={handleMoveDeck}
          folderOptions={view.folderOptions}
          currentFolderId={view.deckFolderIds[editingDeck.id] ?? null}
          onClearCover={handleClearCover}
          onEditCoverCrop={(deck) => setState({ cropDeck: deck, editingDeck: null })}
          onSwapSplitCover={handleSwapSplitCover}
        />
      ) : null}

      {editingFolder ? (
        <FolderSettingsModal
          folder={editingFolder}
          folderName={folderName}
          folderBackgroundUrl={folderBackgroundUrl}
          showDeleteConfirm={showFolderDeleteConfirm}
          onFolderNameChange={(nextName) => setState({ folderName: nextName })}
          onFolderBackgroundUrlChange={(nextUrl) => setState({ folderBackgroundUrl: nextUrl })}
          onClose={closeFolderModal}
          onRename={handleRenameFolder}
          onSaveBackground={() => void handleSaveFolderBackground(editingFolder)}
          onClearBackground={() => void handleClearFolderBackground(editingFolder)}
          onEditBackgroundCrop={() => setState({ cropFolder: editingFolder, editingFolder: null })}
          onDelete={() => void handleDeleteFolder(editingFolder)}
          onDeleteConfirmChange={(showFolderDeleteConfirm) => setState({ showFolderDeleteConfirm })}
        />
      ) : null}

      {cropDeck?.cover ? (
        <ImageCropModal
          title="Edit cover crop"
          aspectRatio={3 / 2}
          images={
            cropDeck.cover.kind === "split"
              ? cropDeck.cover.cards.map((card, index) => ({
                  id: String(index),
                  name: card.name,
                  imageUrl: card.imageUrl,
                  crop: card.crop,
                }))
              : [
                  {
                    id: "single",
                    name: cropDeck.cover.name,
                    imageUrl: cropDeck.cover.imageUrl,
                    crop: cropDeck.cover.crop,
                  },
                ]
          }
          onClose={() => setState({ cropDeck: null })}
          onSave={(cropsById) => {
            if (!cropDeck.cover) return;

            const nextCover = cropDeck.cover;
            const cover =
              nextCover.kind === "split"
                ? {
                    ...nextCover,
                    cards: [
                      { ...nextCover.cards[0], crop: cropsById["0"] },
                      { ...nextCover.cards[1], crop: cropsById["1"] },
                    ] as typeof nextCover.cards,
                  }
                : { ...nextCover, crop: cropsById.single };

            void updateDeckCoverForUser({ data: { deckId: cropDeck.id, cover } })
              .then((updatedDeck) => {
                if (!updatedDeck) throw new Error("Could not update deck cover.");
                setState({ cropDeck: null, editingDeck: updatedDeck, errorMessage: null });
                return refreshDecks();
              })
              .catch((error: unknown) =>
                setState({
                  errorMessage:
                    error instanceof Error
                      ? error.message
                      : "Could not update deck cover right now.",
                }),
              );
          }}
        />
      ) : null}

      {cropFolder?.background ? (
        <ImageCropModal
          title="Edit folder background crop"
          aspectRatio={4}
          images={[
            {
              id: "background",
              name: cropFolder.name,
              imageUrl: cropFolder.background.imageUrl,
              crop: cropFolder.background.crop,
            },
          ]}
          onClose={() => setState({ cropFolder: null })}
          onSave={(cropsById) => {
            const folder = cropFolder;
            if (!folder?.background) return;

            void updateFolderBackgroundForUser({
              data: {
                folderId: folder.id,
                background: { imageUrl: folder.background.imageUrl, crop: cropsById.background },
              },
            })
              .then((updatedFolder) => {
                setState({
                  cropFolder: null,
                  editingFolder: {
                    ...folder,
                    background: updatedFolder.background,
                    updatedAt: updatedFolder.updatedAt,
                  },
                  folderName: folder.name,
                  folderBackgroundUrl: updatedFolder.background?.imageUrl ?? "",
                  errorMessage: null,
                });
                return refreshDecks();
              })
              .catch((error: unknown) =>
                setState({
                  errorMessage:
                    error instanceof Error
                      ? error.message
                      : "Could not update folder background right now.",
                }),
              );
          }}
        />
      ) : null}
    </>
  );
}

function Breadcrumbs({
  breadcrumbs,
  onOpen,
}: {
  breadcrumbs: DeckFolderView["breadcrumbs"];
  onOpen: (path: string) => void;
}) {
  const isRootCurrent = breadcrumbs.length === 0;

  return (
    <nav
      className="flex flex-wrap items-center gap-2 text-sm text-zinc-500"
      aria-label="Deck folders"
    >
      <button
        type="button"
        onClick={() => onOpen("")}
        className={isRootCurrent ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"}
      >
        Decks
      </button>
      {breadcrumbs.map((breadcrumb, index) => {
        const isCurrent = index === breadcrumbs.length - 1;

        return (
          <span key={breadcrumb.id} className="inline-flex items-center gap-2">
            <ChevronRight className="size-4" strokeWidth={1.75} />
            <button
              type="button"
              onClick={() => onOpen(breadcrumb.path)}
              className={isCurrent ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"}
            >
              {breadcrumb.name}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function FolderCard({ folder, path, onOpen, onEdit }: FolderCardProps) {
  const {
    isDragging,
    ref: draggableRef,
    handleRef,
  } = useDraggable({
    id: folder.id,
    type: "folder",
  });
  const { isDropTarget, ref: droppableRef } = useDroppable({
    id: `folder-drop-${folder.id}`,
    type: "folder-drop",
    accept: "folder",
    data: { folderId: folder.id },
  });

  return (
    <div
      ref={(element) => {
        draggableRef(element);
        droppableRef(element);
      }}
      className={`group relative flex min-h-24 w-96 shrink-0 flex-col justify-center overflow-hidden rounded-2xl border bg-zinc-950 px-5 py-4 text-left transition hover:border-zinc-700 ${
        isDropTarget ? "border-cyan-700/70" : "border-zinc-800"
      } ${isDragging ? "opacity-50" : "opacity-100"}`}
    >
      {folder.background ? <FolderBackgroundImage folder={folder} /> : null}
      {folder.background ? <div className="absolute inset-0 bg-black/45" /> : null}
      <div className="pointer-events-none relative z-10 grid grid-cols-[1.75rem_1fr] items-center gap-x-3 gap-y-2 pr-24">
        <Folder className="size-7 shrink-0 text-amber-300" strokeWidth={1.75} />
        <span className="truncate text-2xl font-semibold tracking-tight text-zinc-100">
          {folder.name}
        </span>
        <p className="col-span-2 text-sm text-zinc-500">
          {folder.folderCount} folder{folder.folderCount === 1 ? "" : "s"} | {folder.deckCount} deck
          {folder.deckCount === 1 ? "" : "s"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onOpen(path)}
        className="absolute inset-0 rounded-2xl"
        aria-label={`Open ${folder.name}`}
      />
      <div className="absolute right-4 top-4 z-20 flex items-center rounded-xl border border-zinc-800 bg-zinc-950/90 p-1 opacity-0 shadow-lg shadow-black/20 transition group-hover:opacity-100">
        <button
          ref={handleRef}
          type="button"
          onClick={(event) => event.stopPropagation()}
          className="cursor-grab rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200 active:cursor-grabbing"
          aria-label={`Reorder ${folder.name}`}
        >
          <GripVertical className="size-4" strokeWidth={1.75} />
        </button>
        <IconButton
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit(folder);
          }}
          aria-label={`Open ${folder.name} settings`}
          variant="ghost"
          className="cursor-pointer rounded-lg p-2"
        >
          <MoreVertical className="size-4" strokeWidth={1.75} />
        </IconButton>
      </div>
    </div>
  );
}

function FolderBackgroundImage({ folder }: { folder: FolderViewItem }) {
  const background = folder.background;
  if (!background) return null;

  return (
    <img
      src={background.imageUrl}
      alt=""
      className={
        background.crop
          ? "object-fill opacity-85"
          : "absolute inset-0 h-full w-full object-cover opacity-85"
      }
      style={background.crop ? getImageCropStyle(background.crop) : undefined}
      loading="lazy"
    />
  );
}

function FolderSettingsModal({
  folder,
  folderName,
  folderBackgroundUrl,
  showDeleteConfirm,
  onFolderNameChange,
  onFolderBackgroundUrlChange,
  onClose,
  onRename,
  onSaveBackground,
  onClearBackground,
  onEditBackgroundCrop,
  onDelete,
  onDeleteConfirmChange,
}: {
  folder: EditableFolder;
  folderName: string;
  folderBackgroundUrl: string;
  showDeleteConfirm: boolean;
  onFolderNameChange: (value: string) => void;
  onFolderBackgroundUrlChange: (value: string) => void;
  onClose: () => void;
  onRename: (event: FormEvent<HTMLFormElement>) => void;
  onSaveBackground: () => void;
  onClearBackground: () => void;
  onEditBackgroundCrop: () => void;
  onDelete: () => void;
  onDeleteConfirmChange: (showDeleteConfirm: boolean) => void;
}) {
  return (
    <Modal ariaLabel="Close folder settings modal" onClose={onClose}>
      <h1 className="text-xl font-semibold text-zinc-100">{folder.name}</h1>
      <form className="mt-5 space-y-3" onSubmit={onRename}>
        <label className="block text-sm font-medium text-zinc-400" htmlFor="folder-name">
          Folder name
        </label>
        <Input
          id="folder-name"
          value={folderName}
          onChange={(event) => onFolderNameChange(event.target.value)}
          placeholder="Enter a folder name"
          className="w-full"
        />
        <div className="flex gap-2">
          <Button onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            <Pencil className="size-4" strokeWidth={1.75} />
            Rename
          </Button>
        </div>
      </form>

      <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <label className="block text-sm font-medium text-zinc-400" htmlFor="folder-background-url">
          Background image URL
        </label>
        <Input
          id="folder-background-url"
          value={folderBackgroundUrl}
          onChange={(event) => onFolderBackgroundUrlChange(event.target.value)}
          placeholder="https://cards.scryfall.io/..."
          className="mt-3 w-full"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={onSaveBackground} className="flex-1">
            <Image className="size-4" strokeWidth={1.75} />
            Save background
          </Button>
          {folder.background ? (
            <Button onClick={onEditBackgroundCrop} className="flex-1">
              <Image className="size-4" strokeWidth={1.75} />
              Edit crop
            </Button>
          ) : null}
          {folder.background ? (
            <Button onClick={onClearBackground} className="flex-1">
              <ImageOff className="size-4" strokeWidth={1.75} />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {showDeleteConfirm ? (
        <div className="mt-5 rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-sm text-rose-200">
          <p>Delete this empty folder?</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => onDeleteConfirmChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" onClick={onDelete} className="flex-1">
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => onDeleteConfirmChange(true)}
          disabled={!folder.isEmpty}
          title={folder.isEmpty ? `Delete ${folder.name}` : "Folder must be empty"}
          className="mt-5 w-full justify-start px-4 py-3 text-left text-rose-400 hover:border-rose-900/50 hover:bg-rose-950/20"
        >
          <Trash2 className="size-5" strokeWidth={1.75} />
          <span>{folder.isEmpty ? "Delete folder" : "Folder must be empty"}</span>
        </Button>
      )}
    </Modal>
  );
}
