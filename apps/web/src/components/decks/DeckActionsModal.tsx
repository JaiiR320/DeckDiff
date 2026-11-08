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
import { Alert, AlertActions, AlertDescription } from "@jaiir320/design-system/components/alert";
import { Button } from "@jaiir320/design-system/components/button";
import { Card } from "@jaiir320/design-system/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@jaiir320/design-system/components/collapsible";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@jaiir320/design-system/components/dialog";
import { Input } from "@jaiir320/design-system/components/input";
import { Label } from "@jaiir320/design-system/components/label";
import { SwitchChip } from "@jaiir320/design-system/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@jaiir320/design-system/components/tabs";
import { ToggleGroup, ToggleGroupItem } from "@jaiir320/design-system/components/toggle-group";
import { focusRing } from "@jaiir320/design-system/lib/recipes";
import { ManaSymbolIcon } from "#/components/cards/ManaSymbolIcon";
import type { Dispatch, FormEvent } from "react";
import { useId, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="settings" className="flex h-[736px] max-h-[85vh] flex-col">
        <DialogTitle>{deck.name}</DialogTitle>
        <Tabs
          value={activeTab}
          onValueChange={(value: ModalState["activeTab"]) => setState({ activeTab: value })}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="mt-5 border-b border-border">
            <TabsTrigger value="general">General</TabsTrigger>
            {categories && onCategoriesChange ? (
              <TabsTrigger value="categories">Categories</TabsTrigger>
            ) : null}
          </TabsList>

          <DialogBody className="flex-1 overflow-y-auto pr-1">
            <TabsContent value="general">
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
            </TabsContent>
            {categories && onCategoriesChange ? (
              <TabsContent value="categories">
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
              </TabsContent>
            ) : null}
          </DialogBody>
        </Tabs>

        <DialogClose render={<Button className="mt-5 w-full" />}>Close</DialogClose>
      </DialogContent>
    </Dialog>
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
  const colorsTitleId = useId();
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
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

  // The confirm replaces its trigger, so move focus explicitly in both directions.
  function setDeleteConfirm(showDeleteConfirm: boolean) {
    flushSync(() => setState({ showDeleteConfirm }));
    (showDeleteConfirm ? cancelDeleteRef : deleteButtonRef).current?.focus();
  }

  return (
    <div className="mt-5 space-y-2">
      {isEditing ? (
        <form onSubmit={onRenameSubmit} className="space-y-3">
          <Label htmlFor="deck-rename">New name</Label>
          <Input
            id="deck-rename"
            value={newName}
            onChange={(event) => setState({ newName: event.target.value })}
            placeholder="Enter a new name"
          />
          <div className="flex gap-2">
            <Button onClick={() => setState({ isEditing: false })} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="default" className="flex-1">
              Save
            </Button>
          </div>
        </form>
      ) : (
        <Button
          size="lg"
          onClick={() => setState({ newName: deck.name, isEditing: true })}
          className="w-full justify-start text-left"
        >
          <Pencil className="size-5 text-muted-foreground" strokeWidth={1.75} />
          <span>Rename deck</span>
        </Button>
      )}

      {onColorsChange ? (
        <Card variant="inset" padding="md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p id={colorsTitleId} className="text-sm font-medium text-foreground">
                Deck colors
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Used to clamp flexible mana production stats.
              </p>
            </div>
            <ToggleGroup
              aria-labelledby={colorsTitleId}
              variant="round"
              multiple
              value={draftColors}
              onValueChange={(colors: DeckColor[]) =>
                onDraftColorsChange(
                  DECK_COLORS.flatMap(({ color }) => (colors.includes(color) ? [color] : [])),
                )
              }
            >
              {DECK_COLORS.map(({ color, label }) => (
                <ToggleGroupItem key={color} value={color} aria-label={label} title={label}>
                  <ManaSymbolIcon symbol={color} label={label} className="size-7" />
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </Card>
      ) : null}

      {onMoveToFolder ? (
        <Card variant="inset" padding="md">
          <Collapsible open={isMoveToFolderOpen} onOpenChange={setIsMoveToFolderOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-lg text-left transition hover:text-foreground">
              <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                <FolderInput className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span>Move to folder</span>
              </span>
              <span className="flex min-w-0 items-center gap-2 text-subtle-foreground">
                <span className="truncate">{currentFolderName}</span>
                {isMoveToFolderOpen ? (
                  <ChevronDown className="size-4 shrink-0" strokeWidth={1.75} />
                ) : (
                  <ChevronRight className="size-4 shrink-0" strokeWidth={1.75} />
                )}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-1 rounded-xl border border-border bg-background/60 p-1">
              <button
                type="button"
                disabled={!currentFolderId}
                aria-current={currentFolderId ? undefined : "true"}
                onClick={() => onMoveToFolder(deck.id, null)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition disabled:cursor-default ${
                  currentFolderId
                    ? "text-secondary-foreground hover:bg-surface hover:text-foreground"
                    : "bg-primary text-primary-foreground"
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
                        ? "bg-primary text-primary-foreground"
                        : "text-secondary-foreground hover:bg-surface hover:text-foreground"
                    }`}
                    style={{ paddingLeft: `${8 + folder.depth * 20}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => toggleFolderCollapsed(folder.id)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md transition hover:bg-on-image/10"
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
                      aria-current={isCurrent ? "true" : undefined}
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
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ) : null}

      <Button size="lg" onClick={() => onExport(deck)} className="w-full justify-start text-left">
        <Download className="size-5 text-muted-foreground" strokeWidth={1.75} />
        <span>Export deck list</span>
      </Button>

      {deck.cover && onEditCoverCrop ? (
        <Button
          size="lg"
          onClick={() => onEditCoverCrop(deck)}
          className="w-full justify-start text-left"
        >
          <Image className="size-5 text-muted-foreground" strokeWidth={1.75} />
          <span>Edit cover crop</span>
        </Button>
      ) : null}

      {deck.cover && onClearCover ? (
        <Button
          size="lg"
          onClick={() => onClearCover(deck.id)}
          className="w-full justify-start text-left"
        >
          <ImageOff className="size-5 text-muted-foreground" strokeWidth={1.75} />
          <span>Clear deck cover</span>
        </Button>
      ) : null}

      {deck.cover?.kind === "split" && onSwapSplitCover ? (
        <Button
          size="lg"
          onClick={() => onSwapSplitCover(deck)}
          className="w-full justify-start text-left"
        >
          <Shuffle className="size-5 text-muted-foreground" strokeWidth={1.75} />
          <span>Swap commander cover sides</span>
        </Button>
      ) : null}

      {showDeleteConfirm ? (
        <Alert role="alert" tone="danger">
          <AlertDescription>
            Are you sure? This will delete the deck and all {deck.saves.length} snapshot
            {deck.saves.length === 1 ? "" : "s"}.
          </AlertDescription>
          <AlertActions>
            <Button
              ref={cancelDeleteRef}
              onClick={() => setDeleteConfirm(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDelete(deck.id);
                onClose();
              }}
              className="flex-1"
            >
              Delete
            </Button>
          </AlertActions>
        </Alert>
      ) : (
        <Button
          ref={deleteButtonRef}
          size="lg"
          onClick={() => setDeleteConfirm(true)}
          className="w-full justify-start text-left"
        >
          <Trash2 className="size-5" strokeWidth={1.75} />
          <span>Delete deck</span>
        </Button>
      )}
    </div>
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
  const ghostsTitleId = useId();

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
          aria-label="New category"
          inputSize="sm"
          className="flex-1"
        />
        <Button type="submit" variant="default" size="sm">
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
        <Card variant="inset" padding="sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p id={ghostsTitleId} className="text-sm font-medium text-foreground">
                Removed-card ghosts
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep cards visible in their old category after moving them.
              </p>
            </div>
            <SwitchChip
              aria-labelledby={ghostsTitleId}
              checked={showRemovedCardGhosts}
              onCheckedChange={onShowRemovedCardGhostsChange}
            >
              {showRemovedCardGhosts ? "On" : "Off"}
            </SwitchChip>
          </div>
        </Card>
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
      className={`rounded-xl border bg-muted p-3 transition ${
        isDropTarget ? "border-cyan-700/70" : "border-border"
      } ${isDragging ? "opacity-50" : "opacity-100"}`}
    >
      {isRenaming ? (
        <form onSubmit={onRenameCategory} className="flex gap-2">
          <DragHandle handleRef={handleRef} categoryName={category.name} />
          <Input
            value={categoryName}
            onChange={(event) => setState({ categoryName: event.target.value })}
            aria-label="Category name"
            inputSize="sm"
            className="flex-1 bg-background"
          />
          <Button type="submit" variant="default" size="sm">
            Save
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <DragHandle handleRef={handleRef} categoryName={category.name} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {cardCount} card{cardCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SwitchChip
              aria-label={`Hide ${category.name}`}
              checked={category.hidden === true}
              onCheckedChange={(hidden) =>
                updateCategory(category.id, categories, onCategoriesChange, { hidden })
              }
            >
              Hide
            </SwitchChip>
            <SwitchChip
              aria-label={`${category.name} in deck`}
              checked={category.includeInDeck !== false}
              onCheckedChange={(includeInDeck) =>
                updateCategory(category.id, categories, onCategoriesChange, { includeInDeck })
              }
            >
              In Deck
            </SwitchChip>
            <Button
              onClick={() =>
                setState({
                  renamingCategoryId: category.id,
                  categoryName: category.name,
                })
              }
              size="sm"
              aria-label={`Rename ${category.name}`}
            >
              Rename
            </Button>
            <RemoveCategoryButton
              categoryName={category.name}
              isBlocked={isBlocked}
              onRemove={() => removeCategory(category.id, categories, cards, onCategoriesChange)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const blockedReason = "Move cards out before removing.";

// A disabled button is pointer-inert, so a focusable group carries the hover title and
// describes itself with persistent sr-only text.
function RemoveCategoryButton({
  categoryName,
  isBlocked,
  onRemove,
}: {
  categoryName: string;
  isBlocked: boolean;
  onRemove: () => void;
}) {
  const reasonId = useId();

  if (!isBlocked) {
    return (
      <Button
        onClick={onRemove}
        title="Remove category"
        size="sm"
        aria-label={`Remove ${categoryName}`}
      >
        Remove
      </Button>
    );
  }

  return (
    <>
      <span
        tabIndex={0}
        role="group"
        title={blockedReason}
        aria-label={`Remove ${categoryName}`}
        aria-describedby={reasonId}
        className={`inline-flex rounded-lg ${focusRing}`}
      >
        <Button disabled size="sm" aria-label={`Remove ${categoryName}`}>
          Remove
        </Button>
      </span>
      <span id={reasonId} className="sr-only">
        {blockedReason}
      </span>
    </>
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
    <Button
      ref={handleRef}
      variant="ghost"
      size="none"
      aria-label={`Reorder ${categoryName}`}
      className="rounded-md p-1 text-faint-foreground hover:bg-secondary hover:text-secondary-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </Button>
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
