import { DragDropProvider, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  FolderInput,
  GripVertical,
  Image,
  ImageOff,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import { ManaSymbolIcon } from "#/components/cards/ManaSymbolIcon";
import type { Dispatch, FormEvent } from "react";
import { useReducer, useState } from "react";
import { Alert } from "#/components/ui/Alert";
import { Button } from "#/components/ui/Button";
import { Input } from "#/components/ui/Input";
import { Modal } from "#/components/ui/Modal";
import { TabButton } from "#/components/ui/TabButton";
import { ToggleChip } from "#/components/ui/ToggleChip";
import type { DeckColor, DeckFolderOption, DeckItem } from "../../lib/deck";
import {
  createCategoryId,
  hasCategoryName,
  type DeckCategory,
  type ValidatedDeckCard,
} from "../../lib/decklist";

type DeckActionsModalProps = {
  deck: DeckItem;
  isOpen: boolean;
  onClose: () => void;
  onRename: (deckId: string, newName: string) => void;
  onDelete: (deckId: string) => void;
  onExport: (deck: DeckItem) => void;
  onMoveToFolder?: (deckId: string, folderId: string | null) => void;
  folderOptions?: DeckFolderOption[];
  currentFolderId?: string | null;
  onColorsChange?: (colors: DeckColor[]) => void | Promise<unknown>;
  onClearCover?: (deckId: string) => void;
  onEditCoverCrop?: (deck: DeckItem) => void;
  onSwapSplitCover?: (deck: DeckItem) => void;
  categories?: DeckCategory[];
  cards?: ValidatedDeckCard[];
  showRemovedCardGhosts?: boolean;
  onAddLane?: () => void;
  onCategoriesChange?: (categories: DeckCategory[]) => void;
  onShowRemovedCardGhostsChange?: (showRemovedCardGhosts: boolean) => void;
};

const EMPTY_CARDS: ValidatedDeckCard[] = [];
const EMPTY_FOLDER_OPTIONS: DeckFolderOption[] = [];
const DECK_COLORS: Array<{
  color: DeckColor;
  label: string;
}> = [
  { color: "W", label: "White" },
  { color: "U", label: "Blue" },
  { color: "B", label: "Black" },
  { color: "R", label: "Red" },
  { color: "G", label: "Green" },
];

type ModalState = {
  activeTab: "general" | "categories";
  categoryName: string;
  isEditing: boolean;
  newCategoryName: string;
  newName: string;
  renamingCategoryId: string | null;
  showDeleteConfirm: boolean;
};

const initialModalState: ModalState = {
  activeTab: "general",
  categoryName: "",
  isEditing: false,
  newCategoryName: "",
  newName: "",
  renamingCategoryId: null,
  showDeleteConfirm: false,
};

export function DeckActionsModal({
  deck,
  isOpen,
  onClose,
  onRename,
  onDelete,
  onExport,
  onMoveToFolder,
  folderOptions = EMPTY_FOLDER_OPTIONS,
  currentFolderId = null,
  onColorsChange,
  onClearCover,
  onEditCoverCrop,
  onSwapSplitCover,
  categories,
  cards = EMPTY_CARDS,
  showRemovedCardGhosts = true,
  onAddLane,
  onCategoriesChange,
  onShowRemovedCardGhostsChange,
}: DeckActionsModalProps) {
  const [state, setState] = useReducer(
    (current: ModalState, next: Partial<ModalState>) => ({
      ...current,
      ...next,
    }),
    initialModalState,
  );
  const {
    activeTab,
    categoryName,
    isEditing,
    newCategoryName,
    newName,
    renamingCategoryId,
    showDeleteConfirm,
  } = state;
  const [draftColors, setDraftColors] = useState<DeckColor[]>(deck.colors ?? []);

  if (!isOpen) return null;

  function persistDraftColors() {
    if (!onColorsChange || areDeckColorsEqual(deck.colors ?? [], draftColors)) return;

    void onColorsChange(draftColors);
  }

  function handleClose() {
    persistDraftColors();
    onClose();
  }

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newName.trim();
    if (trimmed && trimmed !== deck.name) {
      persistDraftColors();
      onRename(deck.id, trimmed);
    }
    setState({ isEditing: false });
  }

  function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed || !categories || !onCategoriesChange || hasCategoryName(categories, trimmed)) {
      return;
    }

    onCategoriesChange([
      ...categories,
      {
        id: createCategoryId(trimmed, categories),
        name: trimmed,
        kind: "custom",
      },
    ]);
    setState({ newCategoryName: "" });
  }

  function handleRenameCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = categoryName.trim();
    if (
      !trimmed ||
      !renamingCategoryId ||
      !categories ||
      !onCategoriesChange ||
      hasCategoryName(categories, trimmed, renamingCategoryId)
    ) {
      return;
    }

    onCategoriesChange(
      categories.map((category) =>
        category.id === renamingCategoryId ? { ...category, name: trimmed } : category,
      ),
    );
    setState({ renamingCategoryId: null, categoryName: "" });
  }

  return (
    <Modal
      ariaLabel="Close deck actions modal"
      className="items-center justify-center overflow-y-auto overscroll-contain p-6"
      maxWidth="4xl"
      onClose={handleClose}
      panelClassName="flex h-[736px] !max-w-[800px] max-h-[85vh] flex-col p-6"
    >
      <h2 className="text-xl font-semibold text-zinc-100">{deck.name}</h2>
      <div className="mt-5 flex border-b border-zinc-800">
        <TabButton
          active={activeTab === "general"}
          onClick={() => setState({ activeTab: "general" })}
          className="px-4 py-2"
        >
          General
        </TabButton>
        {categories && onCategoriesChange ? (
          <TabButton
            active={activeTab === "categories"}
            onClick={() => setState({ activeTab: "categories" })}
            className="px-4 py-2"
          >
            Categories
          </TabButton>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {activeTab === "general" ? (
          <GeneralSettingsTab
            deck={deck}
            isEditing={isEditing}
            newName={newName}
            draftColors={draftColors}
            showDeleteConfirm={showDeleteConfirm}
            onClose={onClose}
            onDelete={onDelete}
            onExport={(deckToExport) => {
              persistDraftColors();
              onExport({ ...deckToExport, colors: draftColors });
            }}
            onMoveToFolder={onMoveToFolder}
            folderOptions={folderOptions}
            currentFolderId={currentFolderId}
            onColorsChange={onColorsChange}
            onDraftColorsChange={setDraftColors}
            onClearCover={onClearCover}
            onEditCoverCrop={onEditCoverCrop}
            onSwapSplitCover={onSwapSplitCover}
            onRenameSubmit={handleRenameSubmit}
            setState={setState}
          />
        ) : categories && onCategoriesChange ? (
          <CategoriesSettingsTab
            cards={cards}
            categories={categories}
            categoryName={categoryName}
            newCategoryName={newCategoryName}
            renamingCategoryId={renamingCategoryId}
            showRemovedCardGhosts={showRemovedCardGhosts}
            onAddCategory={handleAddCategory}
            onAddLane={onAddLane}
            onCategoriesChange={onCategoriesChange}
            onRenameCategory={handleRenameCategory}
            onShowRemovedCardGhostsChange={onShowRemovedCardGhostsChange}
            setState={setState}
          />
        ) : null}
      </div>

      <Button onClick={handleClose} className="mt-5 w-full">
        Close
      </Button>
    </Modal>
  );
}

function GeneralSettingsTab({
  deck,
  isEditing,
  newName,
  draftColors,
  showDeleteConfirm,
  onClose,
  onDelete,
  onExport,
  onMoveToFolder,
  folderOptions,
  currentFolderId,
  onColorsChange,
  onDraftColorsChange,
  onClearCover,
  onEditCoverCrop,
  onSwapSplitCover,
  onRenameSubmit,
  setState,
}: {
  deck: DeckItem;
  isEditing: boolean;
  newName: string;
  draftColors: DeckColor[];
  showDeleteConfirm: boolean;
  onClose: () => void;
  onDelete: (deckId: string) => void;
  onExport: (deck: DeckItem) => void;
  onMoveToFolder?: (deckId: string, folderId: string | null) => void;
  folderOptions: DeckFolderOption[];
  currentFolderId: string | null;
  onColorsChange?: (colors: DeckColor[]) => void | Promise<unknown>;
  onDraftColorsChange: (colors: DeckColor[]) => void;
  onClearCover?: (deckId: string) => void;
  onEditCoverCrop?: (deck: DeckItem) => void;
  onSwapSplitCover?: (deck: DeckItem) => void;
  onRenameSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setState: Dispatch<Partial<ModalState>>;
}) {
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => new Set());
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const folderHasChildren = new Set(
    folderOptions.flatMap((folder) => (folder.parentFolderId ? [folder.parentFolderId] : [])),
  );
  const foldersById = new Map(folderOptions.map((folder) => [folder.id, folder]));
  const visibleFolderOptions = folderOptions.filter((folder) =>
    isFolderVisible(folder, foldersById, collapsedFolderIds),
  );
  const currentFolderName = currentFolderId
    ? (folderOptions.find((folder) => folder.id === currentFolderId)?.name ?? "Unknown folder")
    : "Root";
  const moveToFolderPanelId = `move-to-folder-panel-${deck.id}`;

  function toggleFolderCollapsed(folderId: string) {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  return (
    <div className="mt-5 space-y-2">
      {isEditing ? (
        <form onSubmit={onRenameSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-zinc-400" htmlFor="deck-rename">
            New name
          </label>
          <Input
            id="deck-rename"
            value={newName}
            onChange={(event) => setState({ newName: event.target.value })}
            placeholder="Enter a new name"
            className="w-full"
          />
          <div className="flex gap-2">
            <Button onClick={() => setState({ isEditing: false })} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Save
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          onClick={() => setState({ newName: deck.name, isEditing: true })}
          className="w-full justify-start px-4 py-3 text-left"
        >
          <Pencil className="size-5 text-zinc-500" strokeWidth={1.75} />
          <span>Rename deck</span>
        </Button>
      )}

      {onColorsChange ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-100">Deck colors</p>
              <p className="mt-1 text-xs text-zinc-500">
                Used to clamp flexible mana production stats.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {DECK_COLORS.map(({ color, label }) => {
                const isSelected = draftColors.includes(color);
                return (
                  <button
                    key={color}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${isSelected ? "Remove" : "Add"} ${label}`}
                    title={label}
                    onClick={() => onDraftColorsChange(toggleDeckColor(draftColors, color))}
                    className={`inline-flex size-10 items-center justify-center rounded-full border transition ${
                      isSelected
                        ? "border-white/40 bg-zinc-950 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                        : "border-zinc-800 bg-zinc-950 opacity-30 grayscale hover:border-zinc-700 hover:opacity-60"
                    }`}
                  >
                    <ManaSymbolIcon symbol={color} label={label} className="size-7" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {onMoveToFolder ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <button
            type="button"
            aria-controls={moveToFolderPanelId}
            aria-expanded={isMoveToFolderOpen}
            onClick={() => setIsMoveToFolderOpen((isOpen) => !isOpen)}
            className="flex w-full items-center justify-between gap-3 rounded-lg text-left text-sm transition hover:text-zinc-100"
          >
            <span className="flex min-w-0 items-center gap-2 font-medium text-zinc-100">
              <FolderInput className="size-5 shrink-0 text-zinc-500" strokeWidth={1.75} />
              <span>Move to folder</span>
            </span>
            <span className="flex min-w-0 items-center gap-2 text-zinc-400">
              <span className="truncate">{currentFolderName}</span>
              {isMoveToFolderOpen ? (
                <ChevronDown className="size-4 shrink-0" strokeWidth={1.75} />
              ) : (
                <ChevronRight className="size-4 shrink-0" strokeWidth={1.75} />
              )}
            </span>
          </button>
          {isMoveToFolderOpen ? (
            <div
              id={moveToFolderPanelId}
              className="mt-3 space-y-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1"
            >
              <button
                type="button"
                disabled={!currentFolderId}
                onClick={() => onMoveToFolder(deck.id, null)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition disabled:cursor-default ${
                  currentFolderId
                    ? "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                    : "bg-cyan-400 text-cyan-950"
                }`}
              >
                <FolderInput className="size-4" strokeWidth={1.75} />
                <span>Root</span>
              </button>
              {visibleFolderOptions.map((folder) => {
                const hasChildren = folderHasChildren.has(folder.id);
                const isCollapsed = collapsedFolderIds.has(folder.id);
                const isCurrent = currentFolderId === folder.id;

                return (
                  <div
                    key={folder.id}
                    className={`flex items-center rounded-lg text-sm transition ${
                      isCurrent
                        ? "bg-cyan-400 text-cyan-950"
                        : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100"
                    }`}
                    style={{ paddingLeft: `${8 + folder.depth * 20}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleFolderCollapsed(folder.id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md transition hover:bg-black/10"
                        aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${folder.name}`}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="size-4" strokeWidth={1.75} />
                        ) : (
                          <ChevronDown className="size-4" strokeWidth={1.75} />
                        )}
                      </button>
                    ) : (
                      <span className="size-8 shrink-0" />
                    )}
                    <button
                      type="button"
                      disabled={isCurrent}
                      onClick={() => onMoveToFolder(deck.id, folder.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-3 text-left disabled:cursor-default"
                      title={folder.path}
                    >
                      <Folder className="size-4 shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{folder.name}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <Button onClick={() => onExport(deck)} className="w-full justify-start px-4 py-3 text-left">
        <Download className="size-5 text-zinc-500" strokeWidth={1.75} />
        <span>Export deck list</span>
      </Button>

      {deck.cover && onEditCoverCrop ? (
        <Button
          onClick={() => onEditCoverCrop(deck)}
          className="w-full justify-start px-4 py-3 text-left"
        >
          <Image className="size-5 text-zinc-500" strokeWidth={1.75} />
          <span>Edit cover crop</span>
        </Button>
      ) : null}

      {deck.cover && onClearCover ? (
        <Button
          onClick={() => onClearCover(deck.id)}
          className="w-full justify-start px-4 py-3 text-left"
        >
          <ImageOff className="size-5 text-zinc-500" strokeWidth={1.75} />
          <span>Clear deck cover</span>
        </Button>
      ) : null}

      {deck.cover?.kind === "split" && onSwapSplitCover ? (
        <Button
          onClick={() => onSwapSplitCover(deck)}
          className="w-full justify-start px-4 py-3 text-left"
        >
          <Shuffle className="size-5 text-zinc-500" strokeWidth={1.75} />
          <span>Swap commander cover sides</span>
        </Button>
      ) : null}

      {showDeleteConfirm ? (
        <Alert tone="danger" className="space-y-3 bg-rose-950/20 p-4">
          <p>
            Are you sure? This will delete the deck and all {deck.saves.length} snapshot
            {deck.saves.length === 1 ? "" : "s"}.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setState({ showDeleteConfirm: false })} className="flex-1">
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                onDelete(deck.id);
                onClose();
              }}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </Alert>
      ) : (
        <Button
          onClick={() => setState({ showDeleteConfirm: true })}
          className="w-full justify-start px-4 py-3 text-left text-rose-400 hover:border-rose-900/50 hover:bg-rose-950/20"
        >
          <Trash2 className="size-5" strokeWidth={1.75} />
          <span>Delete deck</span>
        </Button>
      )}
    </div>
  );
}

function toggleDeckColor(colors: DeckColor[], color: DeckColor) {
  const nextColors = new Set(colors);

  if (nextColors.has(color)) {
    nextColors.delete(color);
  } else {
    nextColors.add(color);
  }

  return DECK_COLORS.flatMap((deckColor) =>
    nextColors.has(deckColor.color) ? [deckColor.color] : [],
  );
}

function isFolderVisible(
  folder: DeckFolderOption,
  foldersById: Map<string, DeckFolderOption>,
  collapsedFolderIds: Set<string>,
) {
  let parentFolderId = folder.parentFolderId;

  while (parentFolderId) {
    if (collapsedFolderIds.has(parentFolderId)) {
      return false;
    }

    parentFolderId = foldersById.get(parentFolderId)?.parentFolderId;
  }

  return true;
}

function areDeckColorsEqual(left: DeckColor[], right: DeckColor[]) {
  return left.length === right.length && left.every((color, index) => color === right[index]);
}

function CategoriesSettingsTab({
  cards,
  categories,
  categoryName,
  newCategoryName,
  renamingCategoryId,
  showRemovedCardGhosts,
  onAddCategory,
  onAddLane,
  onCategoriesChange,
  onRenameCategory,
  onShowRemovedCardGhostsChange,
  setState,
}: {
  cards: ValidatedDeckCard[];
  categories: DeckCategory[];
  categoryName: string;
  newCategoryName: string;
  renamingCategoryId: string | null;
  showRemovedCardGhosts: boolean;
  onAddCategory: (event: FormEvent<HTMLFormElement>) => void;
  onAddLane?: () => void;
  onCategoriesChange: (categories: DeckCategory[]) => void;
  onRenameCategory: (event: FormEvent<HTMLFormElement>) => void;
  onShowRemovedCardGhostsChange?: (showRemovedCardGhosts: boolean) => void;
  setState: Dispatch<Partial<ModalState>>;
}) {
  function handleDragEnd(event: DragEndEvent) {
    const { source, target } = event.operation;
    const targetCategoryId = target?.data.categoryId as string | undefined;

    if (
      event.operation.canceled ||
      source?.type !== "settings-category" ||
      !targetCategoryId ||
      source.id === targetCategoryId
    ) {
      return;
    }

    onCategoriesChange(reorderCategories(categories, String(source.id), targetCategoryId));
  }

  return (
    <div className="mt-5 space-y-3">
      <form onSubmit={onAddCategory} className="flex gap-2">
        <Input
          value={newCategoryName}
          onChange={(event) => setState({ newCategoryName: event.target.value })}
          placeholder="New category"
          inputSize="sm"
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="primary" size="sm">
          <Plus className="size-4" />
          Add
        </Button>
      </form>

      {onAddLane ? (
        <Button onClick={onAddLane} className="w-full">
          Add lane
        </Button>
      ) : null}

      {onShowRemovedCardGhostsChange ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-100">Removed-card ghosts</p>
              <p className="mt-1 text-xs text-zinc-500">
                Keep cards visible in their old category after moving them.
              </p>
            </div>
            <ToggleChip
              label={showRemovedCardGhosts ? "On" : "Off"}
              checked={showRemovedCardGhosts}
              onToggle={() => onShowRemovedCardGhostsChange(!showRemovedCardGhosts)}
            />
          </div>
        </div>
      ) : null}

      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="space-y-2">
          {categories.map((category) => (
            <CategorySettingsRow
              key={category.id}
              cards={cards}
              categories={categories}
              category={category}
              categoryName={categoryName}
              isRenaming={renamingCategoryId === category.id}
              onCategoriesChange={onCategoriesChange}
              onRenameCategory={onRenameCategory}
              setState={setState}
            />
          ))}
        </div>
      </DragDropProvider>
    </div>
  );
}

function CategorySettingsRow({
  cards,
  categories,
  category,
  categoryName,
  isRenaming,
  onCategoriesChange,
  onRenameCategory,
  setState,
}: {
  cards: ValidatedDeckCard[];
  categories: DeckCategory[];
  category: DeckCategory;
  categoryName: string;
  isRenaming: boolean;
  onCategoriesChange: (categories: DeckCategory[]) => void;
  onRenameCategory: (event: FormEvent<HTMLFormElement>) => void;
  setState: Dispatch<Partial<ModalState>>;
}) {
  const cardCount = cards.filter((card) => card.categoryId === category.id).length;
  const isBlocked = cardCount > 0;
  const {
    isDragging,
    ref: draggableRef,
    handleRef,
  } = useDraggable({
    id: category.id,
    type: "settings-category",
  });
  const { isDropTarget, ref: droppableRef } = useDroppable({
    id: `settings-category-${category.id}`,
    type: "settings-category-drop",
    accept: "settings-category",
    data: { categoryId: category.id },
  });

  return (
    <div
      ref={(element) => {
        draggableRef(element);
        droppableRef(element);
      }}
      className={`rounded-xl border bg-zinc-900/40 p-3 transition ${
        isDropTarget ? "border-cyan-700/70" : "border-zinc-800"
      } ${isDragging ? "opacity-50" : "opacity-100"}`}
    >
      {isRenaming ? (
        <form onSubmit={onRenameCategory} className="flex gap-2">
          <DragHandle handleRef={handleRef} categoryName={category.name} />
          <Input
            value={categoryName}
            onChange={(event) => setState({ categoryName: event.target.value })}
            inputSize="sm"
            className="min-w-0 flex-1 rounded-lg bg-zinc-950 px-3"
          />
          <Button type="submit" variant="primary" size="sm" className="rounded-lg px-3">
            Save
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <DragHandle handleRef={handleRef} categoryName={category.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-100">{category.name}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {cardCount} card{cardCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ToggleChip
              label="Hide"
              checked={category.hidden === true}
              onToggle={() =>
                updateCategory(category.id, categories, onCategoriesChange, {
                  hidden: !category.hidden,
                })
              }
            />
            <ToggleChip
              label="In Deck"
              checked={category.includeInDeck !== false}
              onToggle={() =>
                updateCategory(category.id, categories, onCategoriesChange, {
                  includeInDeck: category.includeInDeck === false,
                })
              }
            />
            <Button
              onClick={() =>
                setState({
                  renamingCategoryId: category.id,
                  categoryName: category.name,
                })
              }
              size="sm"
              className="rounded-lg py-1.5"
            >
              Rename
            </Button>
            <Button
              onClick={() => removeCategory(category.id, categories, cards, onCategoriesChange)}
              disabled={isBlocked}
              title={isBlocked ? "Move cards out before removing." : "Remove category"}
              size="sm"
              className="rounded-lg py-1.5 text-rose-400 hover:border-rose-900/50"
            >
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DragHandle({
  handleRef,
  categoryName,
}: {
  handleRef: (element: HTMLElement | null) => void;
  categoryName: string;
}) {
  return (
    <button
      ref={handleRef}
      type="button"
      aria-label={`Reorder ${categoryName}`}
      className="rounded-md p-1 text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );
}

function reorderCategories(
  categories: DeckCategory[],
  sourceCategoryId: string,
  targetCategoryId: string,
) {
  const sourceIndex = categories.findIndex((category) => category.id === sourceCategoryId);
  const targetIndex = categories.findIndex((category) => category.id === targetCategoryId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return categories;
  }

  const nextCategories = [...categories];
  const [movedCategory] = nextCategories.splice(sourceIndex, 1);
  if (!movedCategory) {
    return categories;
  }

  nextCategories.splice(targetIndex, 0, movedCategory);
  return nextCategories;
}

function updateCategory(
  categoryId: string,
  categories: DeckCategory[],
  onCategoriesChange: (categories: DeckCategory[]) => void,
  patch: Partial<DeckCategory>,
) {
  onCategoriesChange(
    categories.map((category) =>
      category.id === categoryId ? { ...category, ...patch } : category,
    ),
  );
}

function removeCategory(
  categoryId: string,
  categories: DeckCategory[] | undefined,
  cards: ValidatedDeckCard[],
  onCategoriesChange: ((categories: DeckCategory[]) => void) | undefined,
) {
  if (!categories || !onCategoriesChange || cards.some((card) => card.categoryId === categoryId)) {
    return;
  }
  onCategoriesChange(categories.filter((category) => category.id !== categoryId));
}
