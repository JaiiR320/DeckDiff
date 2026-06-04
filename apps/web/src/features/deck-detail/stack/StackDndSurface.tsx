import {
  DragDropProvider,
  DragOverlay,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  useDragOperation,
} from "@dnd-kit/react";
import { Minus, Plus } from "lucide-react";
import { Fragment, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { ContextMenu, ContextMenuItem } from "#/components/ui/ContextMenu";
import { IconButton } from "#/components/ui/IconButton";
import type { DeckStackLayout, DeckTileCover } from "#/lib/deck";
import { createCategoryId, type CardCategory, type DeckCategory } from "#/lib/decklist";
import type { SearchCardResult } from "#/lib/scryfall";
import type { CategoryDiff, EditorRow } from "../editor/types";
import { buildGeneratedCardGroups, type CardGroupView } from "./cardGroupView";
import { CategoryLane } from "./CategoryLane";
import { CategoryStack } from "./CategoryStack";
import { DropPlaceholder } from "./DropPlaceholder";
import {
  getDropPlacement,
  getPlaceholderRenderIndex,
  moveLayoutByPointer,
  type DropPreview,
} from "./stackLayoutDrag";

type EditorDeckStackProps = {
  categories: DeckCategory[];
  categoryDiffs: Record<CardCategory, CategoryDiff>;
  groupedRows: Record<CardCategory, EditorRow[]>;
  resultCardTotal: number;
  showDiffOnly: boolean;
  layout: DeckStackLayout;
  cardGroupView: CardGroupView;
  onToggleShowDiffOnly: () => void;
  onLayoutChange: (layout: DeckStackLayout) => void;
  onAdjustQuantity?: (row: EditorRow, delta: number) => void;
  onMoveCardCategory?: (row: EditorRow, category: CardCategory) => void;
  onChangePrinting?: (row: EditorRow) => void;
  onSetDeckCover?: (cover: DeckTileCover) => void;
  onMoveCategoryCards?: (category: CardCategory, targetCategory: CardCategory) => void;
  onCreateCategoryInLane?: (laneIndex: number, category: DeckCategory) => void;
  onRemoveLane?: (laneIndex: number) => void;
  onRemoveCategory?: (category: CardCategory) => void;
  onCategoryChange?: (category: CardCategory, patch: Partial<DeckCategory>) => void;
  onRenameCategory?: (category: CardCategory, name: string) => void;
  onAddSearchCard?: (card: SearchCardResult, category: CardCategory) => void;
  searchToolbar: ReactNode;
  readOnly?: boolean;
};

type StackLaneGridData = {
  categories: DeckCategory[];
  categoryDiffs: Record<CardCategory, CategoryDiff>;
  dropPreview: DropPreview | null;
  groupedRows: Record<CardCategory, EditorRow[]>;
  layout: DeckStackLayout;
  renamingCategoryId: CardCategory | null;
  visibleGroupedRows: Record<CardCategory, EditorRow[]>;
  visibleLanes: Array<{ lane: CardCategory[]; laneIndex: number }>;
  generatedView: boolean;
};

type StackLaneGridRefs = {
  categoryElements: { current: Map<CardCategory, HTMLElement> };
  laneElements: { current: Map<number, HTMLDivElement> };
};

type StackLaneGridActions = Pick<
  EditorDeckStackProps,
  | "onAdjustQuantity"
  | "onMoveCardCategory"
  | "onChangePrinting"
  | "onSetDeckCover"
  | "onMoveCategoryCards"
  | "onRemoveLane"
  | "onRemoveCategory"
  | "onCategoryChange"
  | "onRenameCategory"
> & {
  openLaneMenu: (event: MouseEvent<HTMLDivElement>) => void;
};

export function EditorDeckStack({
  categories,
  categoryDiffs,
  groupedRows,
  resultCardTotal,
  showDiffOnly,
  layout,
  cardGroupView,
  onToggleShowDiffOnly,
  onLayoutChange,
  onAdjustQuantity,
  onMoveCardCategory,
  onChangePrinting,
  onSetDeckCover,
  onMoveCategoryCards,
  onCreateCategoryInLane,
  onRemoveLane,
  onRemoveCategory,
  onCategoryChange,
  onRenameCategory,
  onAddSearchCard,
  searchToolbar,
  readOnly = false,
}: EditorDeckStackProps) {
  const previousLayout = useRef(layout);
  const generatedView = cardGroupView !== "categories";
  const laneElements = useRef<Map<number, HTMLDivElement>>(null!);
  const categoryElements = useRef<Map<CardCategory, HTMLElement>>(null!);
  laneElements.current ??= new Map<number, HTMLDivElement>();
  categoryElements.current ??= new Map<CardCategory, HTMLElement>();
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const dropPreviewRef = useRef<DropPreview | null>(null);
  const [laneMenu, setLaneMenu] = useState<{ x: number; y: number; laneIndex: number } | null>(
    null,
  );
  const [renamingCategoryId, setRenamingCategoryId] = useState<CardCategory | null>(null);
  const visibleCategoryIds = new Set<CardCategory>();
  const includedCategoryIds = new Set<CardCategory>();
  for (const category of categories) {
    if (!category.hidden) {
      visibleCategoryIds.add(category.id);
    }
    if (category.includeInDeck !== false) {
      includedCategoryIds.add(category.id);
    }
  }
  const visibleLanes: Array<{ lane: CardCategory[]; laneIndex: number }> = [];
  for (const [laneIndex, lane] of layout.lanes.entries()) {
    const visibleLane = lane.filter((category) => visibleCategoryIds.has(category));
    if (visibleLane.length > 0 || lane.length === 0) {
      visibleLanes.push({ lane: visibleLane, laneIndex });
    }
  }
  const allRows = Object.values(groupedRows).flat();
  const includedRows = allRows.filter((row) => includedCategoryIds.has(row.category));
  const visibleGroupedRows = Object.fromEntries(
    categories.map((category) => [
      category.id,
      (groupedRows[category.id] ?? []).filter(
        (row) =>
          (!showDiffOnly || row.status !== "same") &&
          (layout.showRemovedCardGhosts !== false || row.status !== "removed"),
      ),
    ]),
  ) as Record<CardCategory, EditorRow[]>;
  const visibleRows: EditorRow[] = [];
  for (const category of categories) {
    if (!category.hidden) {
      visibleRows.push(...(visibleGroupedRows[category.id] ?? []));
    }
  }
  const generatedGroups = generatedView
    ? buildGeneratedCardGroups({ categories, groupView: cardGroupView, rows: visibleRows })
    : null;
  const stackCategories = generatedGroups?.categories ?? categories;
  const stackGroupedRows = generatedGroups?.groupedRows ?? groupedRows;
  const stackVisibleGroupedRows = generatedGroups?.groupedRows ?? visibleGroupedRows;
  const stackVisibleLanes = generatedGroups
    ? generatedGroups.lanes.map((lane, laneIndex) => ({ lane, laneIndex }))
    : visibleLanes;
  const totalAdded = allRows.filter((row) => row.status === "added").length;
  const totalChanged = allRows.filter((row) => row.status === "changed").length;
  const totalRemoved = allRows.filter((row) => row.status === "removed").length;
  const totalDeckPrice = includedRows.reduce(
    (sum, row) => sum + (row.priceUsd ?? 0) * row.currentQuantity,
    0,
  );
  const laneGridData: StackLaneGridData = {
    categories: stackCategories,
    categoryDiffs,
    dropPreview,
    generatedView,
    groupedRows: stackGroupedRows,
    layout,
    renamingCategoryId,
    visibleGroupedRows: stackVisibleGroupedRows,
    visibleLanes: stackVisibleLanes,
  };
  const laneGridRefs: StackLaneGridRefs = { categoryElements, laneElements };
  const laneGridActions: StackLaneGridActions = {
    onAdjustQuantity,
    onMoveCardCategory,
    onChangePrinting,
    onSetDeckCover,
    onMoveCategoryCards,
    onRemoveLane,
    onRemoveCategory,
    onCategoryChange,
    onRenameCategory,
    openLaneMenu,
  };

  function handleDragStart() {
    previousLayout.current = layout;
    setLaneMenu(null);
  }

  function openLaneMenu(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (
      readOnly ||
      generatedView ||
      target.closest("[data-category-stack],button,input,textarea,select")
    ) {
      return;
    }

    event.preventDefault();
    const laneIndex = getPointerLaneIndex(event.clientX);
    setLaneMenu({ x: event.clientX, y: event.clientY, laneIndex });
  }

  function getPointerLaneIndex(pointerX: number) {
    let nearestLaneIndex = 0;
    let nearestLaneDistance = Number.POSITIVE_INFINITY;

    for (const [laneIndex, element] of laneElements.current) {
      const rect = element.getBoundingClientRect();

      if (pointerX >= rect.left && pointerX <= rect.right) {
        return laneIndex;
      }

      const distance = Math.abs(pointerX - (rect.left + rect.width / 2));
      if (distance < nearestLaneDistance) {
        nearestLaneDistance = distance;
        nearestLaneIndex = laneIndex;
      }
    }

    return nearestLaneIndex;
  }

  function createCategoryInLane(laneIndex: number) {
    const category: DeckCategory = {
      id: createCategoryId("New category", categories),
      name: "New category",
      kind: "custom",
    };

    onCreateCategoryInLane?.(laneIndex, category);
    setRenamingCategoryId(category.id);
    setLaneMenu(null);
  }

  function setDropPreviewValue(preview: DropPreview | null) {
    dropPreviewRef.current = preview;
    setDropPreview(preview);
  }

  function updateCategoryDropPreview(
    operation: DragMoveEvent["operation"] | DragOverEvent["operation"],
  ) {
    const { source } = operation;

    if (readOnly || generatedView || source?.type !== "category") {
      return;
    }

    const category = source.id as CardCategory;
    if (!categories.some((item) => item.id === category)) {
      return;
    }

    const placement = getDropPlacement(
      layout,
      category,
      operation.position.current.x,
      operation.position.current.y,
      laneElements.current,
      categoryElements.current,
    );
    const height = categoryElements.current.get(category)?.offsetHeight ?? 96;

    const nextPreview = { category, height, ...placement };
    const current = dropPreviewRef.current;
    if (
      current?.category === nextPreview.category &&
      current.laneIndex === nextPreview.laneIndex &&
      current.insertIndex === nextPreview.insertIndex &&
      current.height === nextPreview.height
    ) {
      return;
    }

    setDropPreviewValue(nextPreview);
  }

  function handleDragMove(event: DragMoveEvent) {
    updateCategoryDropPreview(event.operation);
  }

  function handleDragOver(event: DragOverEvent) {
    updateCategoryDropPreview(event.operation);
  }

  function handleDragEnd(event: DragEndEvent) {
    finishDrag({
      categories,
      categoryElements: categoryElements.current,
      event,
      laneElements: laneElements.current,
      layout,
      onAddSearchCard,
      onLayoutChange,
      onMoveCardCategory,
      previousLayout: previousLayout.current,
      readOnly,
      setDropPreview: setDropPreviewValue,
    });
  }

  return (
    <div>
      <DragDropProvider
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {searchToolbar}
        <SearchCardDragOverlayHost />
        {generatedView ? null : (
          <LaneMenu
            laneMenu={laneMenu}
            onOpenChange={(open) => {
              if (!open) setLaneMenu(null);
            }}
            onCreateCategory={createCategoryInLane}
          />
        )}
        <div className="space-y-4 px-5 pb-5 pt-5">
          <StackSummary
            resultCardTotal={resultCardTotal}
            showDiffOnly={showDiffOnly}
            totalDeckPrice={totalDeckPrice}
            totalAdded={totalAdded}
            totalChanged={totalChanged}
            totalRemoved={totalRemoved}
            visibleRowsCount={visibleRows.length}
            onToggleShowDiffOnly={onToggleShowDiffOnly}
          />
          <StackLaneGrid
            data={laneGridData}
            refs={laneGridRefs}
            actions={laneGridActions}
            readOnly={readOnly}
          />
        </div>
      </DragDropProvider>
    </div>
  );
}

function StackLaneGrid({
  data,
  refs,
  actions,
  readOnly,
}: {
  data: StackLaneGridData;
  refs: StackLaneGridRefs;
  actions: StackLaneGridActions;
  readOnly: boolean;
}) {
  const {
    categories,
    categoryDiffs,
    dropPreview,
    generatedView,
    groupedRows,
    layout,
    renamingCategoryId,
    visibleGroupedRows,
    visibleLanes,
  } = data;
  const { categoryElements, laneElements } = refs;

  return (
    <div
      className="grid select-none items-start gap-0 pb-2"
      onContextMenu={actions.openLaneMenu}
      style={
        {
          gridTemplateColumns: `repeat(${Math.max(visibleLanes.length, 1)}, minmax(0, 1fr))`,
        } as CSSProperties
      }
    >
      {visibleLanes.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 px-5 py-12 text-center text-sm font-semibold text-zinc-500">
          All categories are hidden. Re-enable one from Settings.
        </div>
      ) : null}
      {visibleLanes.map(({ lane, laneIndex }) => (
        <CategoryLane
          key={laneIndex}
          laneIndex={laneIndex}
          categories={lane}
          hasPreview={dropPreview?.laneIndex === laneIndex}
          onLaneRef={(element) => {
            if (element) {
              laneElements.current.set(laneIndex, element);
            } else {
              laneElements.current.delete(laneIndex);
            }
          }}
          onRemoveLane={readOnly || generatedView ? undefined : actions.onRemoveLane}
        >
          {lane.map((category, categoryIndex) => {
            const placeholderIndex = getPlaceholderRenderIndex(lane, laneIndex, dropPreview);

            return (
              <Fragment key={category}>
                {placeholderIndex === categoryIndex ? (
                  <DropPlaceholder height={dropPreview?.height ?? 96} />
                ) : null}
                <CategoryStack
                  category={category}
                  categoryName={categories.find((item) => item.id === category)?.name ?? category}
                  categoryDiff={categoryDiffs[category]}
                  categories={categories}
                  cardCount={
                    (groupedRows[category] ?? []).filter((row) => row.currentQuantity > 0).length
                  }
                  cardSort={layout.cardSort ?? "manaValue"}
                  cardSortDirection={layout.cardSortDirection ?? "desc"}
                  diffCounts={getCategoryDiffCounts(groupedRows[category] ?? [])}
                  shouldStartRenaming={renamingCategoryId === category}
                  rows={visibleGroupedRows[category] ?? []}
                  onAdjustQuantity={actions.onAdjustQuantity}
                  onMoveCardCategory={actions.onMoveCardCategory}
                  onChangePrinting={actions.onChangePrinting}
                  onSetDeckCover={actions.onSetDeckCover}
                  onMoveCategoryCards={generatedView ? undefined : actions.onMoveCategoryCards}
                  onRemoveCategory={generatedView ? undefined : actions.onRemoveCategory}
                  onCategoryChange={generatedView ? undefined : actions.onCategoryChange}
                  onRenameCategory={generatedView ? undefined : actions.onRenameCategory}
                  generatedView={generatedView}
                  readOnly={readOnly}
                  onCategoryRef={(element) => {
                    if (element) {
                      categoryElements.current.set(category, element);
                    } else {
                      categoryElements.current.delete(category);
                    }
                  }}
                />
              </Fragment>
            );
          })}
          {getPlaceholderRenderIndex(lane, laneIndex, dropPreview) === lane.length ? (
            <DropPlaceholder height={dropPreview?.height ?? 96} />
          ) : null}
        </CategoryLane>
      ))}
    </div>
  );
}

function LaneMenu({
  laneMenu,
  onOpenChange,
  onCreateCategory,
}: {
  laneMenu: { x: number; y: number; laneIndex: number } | null;
  onOpenChange: (open: boolean) => void;
  onCreateCategory: (laneIndex: number) => void;
}) {
  return (
    <ContextMenu
      open={Boolean(laneMenu)}
      onOpenChange={onOpenChange}
      position={laneMenu}
      widthClassName="w-44"
    >
      <ContextMenuItem onSelect={() => laneMenu && onCreateCategory(laneMenu.laneIndex)}>
        New category
      </ContextMenuItem>
    </ContextMenu>
  );
}

function StackSummary({
  resultCardTotal,
  showDiffOnly,
  totalDeckPrice,
  totalAdded,
  totalChanged,
  totalRemoved,
  visibleRowsCount,
  onToggleShowDiffOnly,
}: {
  resultCardTotal: number;
  showDiffOnly: boolean;
  totalDeckPrice: number;
  totalAdded: number;
  totalChanged: number;
  totalRemoved: number;
  visibleRowsCount: number;
  onToggleShowDiffOnly: () => void;
}) {
  const shownCount = showDiffOnly ? visibleRowsCount : resultCardTotal;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="font-mono text-sm font-medium uppercase tracking-[0.08em] text-zinc-500">
        {shownCount} {showDiffOnly ? "diff card" : "total card"}
        {shownCount === 1 ? "" : "s"}
        <span className="mx-2">|</span>
        <span>{formatPrice(totalDeckPrice)}</span>
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 font-mono text-sm font-medium uppercase tracking-[0.08em]">
          <span className="text-emerald-300">+{totalAdded}</span>
          <span className="text-amber-300">~{totalChanged}</span>
          <span className="text-rose-300">-{totalRemoved}</span>
        </div>
        <IconButton
          onClick={onToggleShowDiffOnly}
          aria-pressed={showDiffOnly}
          aria-label={showDiffOnly ? "Show all cards" : "Show differences only"}
          title={showDiffOnly ? "Show all cards" : "Show differences only"}
          variant={showDiffOnly ? "active" : "secondary"}
          size="sm"
          className="relative rounded-md bg-zinc-900 hover:bg-zinc-800"
        >
          <Minus className="size-3.5 translate-y-[2px]" strokeWidth={2} />
          <Plus className="absolute size-3.5 -translate-y-[2px]" strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  );
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`;
}

function SearchCardDragOverlayHost() {
  const { source } = useDragOperation();

  if (source?.type !== "search-card") {
    return null;
  }

  return (
    <DragOverlay dropAnimation={null}>
      <SearchCardDragOverlay card={source.data.card as SearchCardResult} />
    </DragOverlay>
  );
}

function SearchCardDragOverlay({ card }: { card: SearchCardResult }) {
  const imageUrl = card.imageUrl ?? card.smallImageUrl;

  return (
    <div className="pointer-events-none w-64 rotate-1 overflow-hidden rounded-xl bg-zinc-900 shadow-2xl shadow-cyan-950/50 ring-2 ring-cyan-200">
      <div className="relative aspect-[488/680]">
        {imageUrl ? (
          <img src={imageUrl} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-start justify-center bg-zinc-900 px-3 pt-8 text-center text-sm font-semibold text-zinc-400">
            {card.name}
          </div>
        )}
        <div className="absolute left-0 top-0 rounded-br-lg bg-zinc-950/75 px-2 py-1 font-mono text-sm font-semibold text-zinc-100 shadow-lg shadow-black/30">
          1
        </div>
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent opacity-80" />
      </div>
    </div>
  );
}

type CategoryDiffCounts = {
  added: number;
  changed: number;
  removed: number;
};

function finishDrag({
  categories,
  categoryElements,
  event,
  laneElements,
  layout,
  onAddSearchCard,
  onLayoutChange,
  onMoveCardCategory,
  previousLayout,
  readOnly,
  setDropPreview,
}: {
  categories: DeckCategory[];
  categoryElements: Map<CardCategory, HTMLElement>;
  event: DragEndEvent;
  laneElements: Map<number, HTMLDivElement>;
  layout: DeckStackLayout;
  onAddSearchCard?: (card: SearchCardResult, category: CardCategory) => void;
  onLayoutChange: (layout: DeckStackLayout) => void;
  onMoveCardCategory?: (row: EditorRow, category: CardCategory) => void;
  previousLayout: DeckStackLayout;
  readOnly: boolean;
  setDropPreview: (preview: DropPreview | null) => void;
}) {
  const { source, target } = event.operation;
  const targetCategory = target?.data.category as CardCategory | undefined;
  const isKnownCategory = targetCategory && categories.some((item) => item.id === targetCategory);

  if (readOnly) {
    setDropPreview(null);
    return;
  }

  if (source?.type === "card") {
    const row = source.data.row as EditorRow | undefined;
    if (!event.operation.canceled && row && isKnownCategory) {
      onMoveCardCategory?.(row, targetCategory!);
    }
    setDropPreview(null);
    return;
  }

  if (source?.type === "search-card") {
    const card = source.data.card as SearchCardResult | undefined;
    if (!event.operation.canceled && card && isKnownCategory) {
      onAddSearchCard?.(card, targetCategory!);
    }
    setDropPreview(null);
    return;
  }

  if (source?.type !== "category") {
    setDropPreview(null);
    return;
  }

  if (event.operation.canceled) {
    onLayoutChange(previousLayout);
  } else {
    onLayoutChange(
      moveLayoutByPointer(
        layout,
        source.id,
        event.operation.position.current.x,
        event.operation.position.current.y,
        laneElements,
        categoryElements,
      ),
    );
  }

  setDropPreview(null);
}

function getCategoryDiffCounts(rows: EditorRow[]): CategoryDiffCounts {
  return rows.reduce<CategoryDiffCounts>(
    (counts, row) => {
      if (row.status === "added") counts.added += 1;
      if (row.status === "changed") counts.changed += 1;
      if (row.status === "removed") counts.removed += 1;
      return counts;
    },
    { added: 0, changed: 0, removed: 0 },
  );
}
