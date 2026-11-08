import { useDraggable, useDroppable } from "@dnd-kit/react";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { Badge } from "@jaiir320/design-system/components/badge";
import { Button } from "@jaiir320/design-system/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@jaiir320/design-system/components/dropdown-menu";
import { Empty } from "@jaiir320/design-system/components/empty";
import { Field, FieldLabel } from "@jaiir320/design-system/components/field";
import { Input } from "@jaiir320/design-system/components/input";
import { Popover, PopoverContent } from "@jaiir320/design-system/components/popover";
import type { DeckCardSort, DeckCardSortDirection } from "#/lib/deck";
import type { DeckTileCover } from "#/lib/deck";
import type { CardCategory, DeckCategory } from "#/lib/decklist";
import type { CategoryDiff, EditorRow } from "../editor/types";
import { cardLayoutToCssVars, type CardLayout } from "./cardLayout";
import { applySortDirection, compareEdhrecRanks, comparePrices } from "./categoryStackSort";
import { StackCard } from "./StackCard";
import { cardCategoryDropId } from "./stackIds";
import { buttonLooks } from "#/components/buttonLooks";

type CategoryStackProps = {
  category: CardCategory;
  categoryName: string;
  categoryDiff?: CategoryDiff;
  diffCounts: CategoryDiffCounts;
  categories: DeckCategory[];
  cardCount: number;
  rows: EditorRow[];
  cardSort: DeckCardSort;
  cardSortDirection: DeckCardSortDirection;
  onAdjustQuantity?: (row: EditorRow, delta: number) => void;
  onMoveCardCategory?: (row: EditorRow, category: CardCategory) => void;
  onChangePrinting?: (row: EditorRow) => void;
  onSetDeckCover?: (cover: DeckTileCover) => void;
  onMoveCategoryCards?: (category: CardCategory, targetCategory: CardCategory) => void;
  onRemoveCategory?: (category: CardCategory) => void;
  onCategoryChange?: (category: CardCategory, patch: Partial<DeckCategory>) => void;
  onRenameCategory?: (category: CardCategory, name: string) => void;
  shouldStartRenaming?: boolean;
  generatedView?: boolean;
  readOnly: boolean;
  onCategoryRef: (element: HTMLElement | null) => void;
};

type MenuState = {
  isMenuOpen: boolean;
  isMovingCards: boolean;
  isRenaming: boolean;
  renameDraft: string;
};

type CategoryDiffCounts = {
  added: number;
  changed: number;
  removed: number;
};

const initialMenuState: MenuState = {
  isMenuOpen: false,
  isMovingCards: false,
  isRenaming: false,
  renameDraft: "",
};

export function CategoryStack({
  category,
  categoryName,
  categoryDiff,
  diffCounts,
  categories,
  cardCount,
  rows,
  cardSort,
  cardSortDirection,
  onAdjustQuantity,
  onMoveCardCategory,
  onChangePrinting,
  onSetDeckCover,
  onMoveCategoryCards,
  onRemoveCategory,
  onCategoryChange,
  onRenameCategory,
  shouldStartRenaming = false,
  generatedView = false,
  readOnly,
  onCategoryRef,
}: CategoryStackProps) {
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const handledStartRenameRef = useRef(false);
  const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [menuState, setMenuState] = useReducer(
    (current: MenuState, next: Partial<MenuState>) => ({ ...current, ...next }),
    initialMenuState,
  );
  const { isMenuOpen, isMovingCards, isRenaming, renameDraft } = menuState;
  const sortedRows = rows.slice().sort((left, right) => {
    if (cardSort === "alphabetical") {
      const nameComparison = left.name.localeCompare(right.name);
      return (
        applySortDirection(nameComparison, cardSortDirection) || right.manaValue - left.manaValue
      );
    }

    if (cardSort === "price") {
      const priceComparison = comparePrices(left.priceUsd, right.priceUsd, cardSortDirection);
      return priceComparison || left.name.localeCompare(right.name);
    }

    if (cardSort === "edhrecRank") {
      const rankComparison = compareEdhrecRanks(
        left.edhrecRank,
        right.edhrecRank,
        cardSortDirection,
      );
      return rankComparison || left.name.localeCompare(right.name);
    }

    const manaValueComparison = left.manaValue - right.manaValue;
    return (
      applySortDirection(manaValueComparison, cardSortDirection) ||
      left.name.localeCompare(right.name)
    );
  });
  const lastCardOffset = Math.max(0, sortedRows.length - 1);
  const totalQuantity = sortedRows.reduce((sum, row) => sum + row.currentQuantity, 0);
  const totalPrice = sortedRows.reduce(
    (sum, row) => sum + (row.priceUsd ?? 0) * row.currentQuantity,
    0,
  );
  const {
    isDragging,
    ref: draggableRef,
    handleRef,
  } = useDraggable({ id: category, type: "category", disabled: readOnly || generatedView });
  const { isDropTarget: isCardDropTarget, ref: droppableRef } = useDroppable({
    id: cardCategoryDropId(category),
    type: "card-category",
    accept: ["card", "search-card"],
    disabled: readOnly || generatedView,
    data: { category },
  });

  function saveRename() {
    const nextName = renameDraft.trim();
    if (!nextName) return;
    onRenameCategory?.(category, nextName);
    setMenuState({ isRenaming: false, isMenuOpen: false });
  }

  const handleCardLayout = useCallback((nextLayout: CardLayout) => {
    setCardLayout((current) => (areCardLayoutsEqual(current, nextLayout) ? current : nextLayout));
  }, []);

  useEffect(() => {
    if (!shouldStartRenaming) {
      handledStartRenameRef.current = false;
      return;
    }

    if (handledStartRenameRef.current) {
      return;
    }

    handledStartRenameRef.current = true;
    setMenuState({
      isMenuOpen: false,
      isMovingCards: false,
      isRenaming: true,
      renameDraft: categoryName,
    });
  }, [categoryName, shouldStartRenaming]);

  return (
    <section
      data-category-stack="true"
      ref={(element) => {
        draggableRef(element);
        droppableRef(element);
        onCategoryRef(element);
      }}
      className={`relative isolate select-none overflow-visible rounded-xl border bg-surface-glass/80 transition ${
        isDragging ? "scale-[1.02] shadow-2xl shadow-info-surface/30" : ""
      } ${
        isCardDropTarget
          ? "border-highlight/80 bg-info-surface/20 shadow-2xl shadow-info-surface/40"
          : "border-border"
      }`}
    >
      <div className="overflow-hidden rounded-xl">
        <div className="border-b border-border bg-surface/80 px-3 py-1.5">
          <div className="flex items-start justify-between gap-3">
            <div
              ref={handleRef}
              className={`min-w-0 flex-1 ${readOnly ? "" : "cursor-grab active:cursor-grabbing"}`}
            >
              <h3 className="truncate font-mono text-sm font-semibold uppercase tracking-label text-secondary-foreground">
                {categoryName}
              </h3>
            </div>
            {generatedView ? null : (
              <CategoryStackMenu
                menu={{
                  cardCount,
                  categories,
                  category,
                  categoryName,
                  isMenuOpen,
                  isMovingCards,
                  isRenaming,
                  menuButtonRef,
                  onMoveCategoryCards,
                  onRemoveCategory,
                  onCategoryChange,
                  onRenameCategory,
                  readOnly,
                  renameDraft,
                  renameInputRef,
                  rowCount: rows.length,
                  saveRename,
                  setMenuState,
                }}
              />
            )}
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-3 font-mono text-xs text-faint-foreground">
            <p className="min-w-0 truncate">
              Qty: {totalQuantity}
              <span className="ml-2 text-success-text">+{diffCounts.added}</span>
              <span className="ml-1 text-warning-text">~{diffCounts.changed}</span>
              <span className="ml-1 text-destructive-muted-foreground">-{diffCounts.removed}</span>
              {categoryDiff?.previousName ? (
                <span className="ml-2 uppercase tracking-label text-warning-text/80">
                  was: {categoryDiff.previousName}
                </span>
              ) : null}
            </p>
            <span className="shrink-0 text-subtle-foreground">{formatPrice(totalPrice)}</span>
          </div>
        </div>

        {isCardDropTarget ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-start justify-center rounded-xl bg-primary/5 p-3">
            <Badge
              variant={null}
              className="rounded-full border border-highlight/50 bg-surface-glass/90 px-3 py-1 font-mono text-xs font-semibold tracking-label text-selected-foreground uppercase shadow-xl shadow-black/30"
            >
              Move to {categoryName}
            </Badge>
          </div>
        ) : null}

        {sortedRows.length === 0 ? (
          <Empty variant="inset" className="min-h-64 px-5 font-semibold text-muted-foreground">
            Empty stack
          </Empty>
        ) : (
          <div
            className="relative min-h-64 overflow-hidden px-3 pb-3"
            style={cardLayout ? (cardLayoutToCssVars(cardLayout) as CSSProperties) : undefined}
            onPointerLeave={() => setHoveredIndex(null)}
          >
            {sortedRows.map((row, index) => (
              <StackCard
                key={row.oracleId}
                row={row}
                index={index}
                onHover={() => setHoveredIndex(index)}
                onAdjustQuantity={onAdjustQuantity}
                onCardLayout={handleCardLayout}
                categories={generatedView ? [] : categories}
                onMoveCardCategory={generatedView ? undefined : onMoveCardCategory}
                onChangePrinting={onChangePrinting}
                onSetDeckCover={onSetDeckCover}
                readOnly={readOnly}
                viewState={{
                  hovered: hoveredIndex === index,
                  shifted: hoveredIndex !== null && index > hoveredIndex,
                  showControls: true,
                  showEdhrecRank: cardSort === "edhrecRank",
                }}
              />
            ))}
            <div
              aria-hidden="true"
              className="pointer-events-none invisible aspect-488/680"
              style={{
                marginTop: `calc(${lastCardOffset} * var(--stack-card-peek) + var(--stack-card-top-inset))`,
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function formatPrice(price: number) {
  return `$${price.toFixed(2)}`;
}

function areCardLayoutsEqual(left: CardLayout | null, right: CardLayout) {
  return (
    left !== null &&
    left.badgeFontSize === right.badgeFontSize &&
    left.badgePaddingX === right.badgePaddingX &&
    left.badgePaddingY === right.badgePaddingY &&
    left.controlIconSize === right.controlIconSize &&
    left.controlRight === right.controlRight &&
    left.controlSize === right.controlSize &&
    left.controlTop === right.controlTop &&
    left.stackHoverGap === right.stackHoverGap &&
    left.stackPeek === right.stackPeek &&
    left.stackTopInset === right.stackTopInset
  );
}

type CategoryStackMenuModel = {
  cardCount: number;
  categories: DeckCategory[];
  category: CardCategory;
  categoryName: string;
  isMenuOpen: boolean;
  isMovingCards: boolean;
  isRenaming: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMoveCategoryCards?: (category: CardCategory, targetCategory: CardCategory) => void;
  onRemoveCategory?: (category: CardCategory) => void;
  onCategoryChange?: (category: CardCategory, patch: Partial<DeckCategory>) => void;
  onRenameCategory?: (category: CardCategory, name: string) => void;
  readOnly: boolean;
  renameDraft: string;
  renameInputRef: RefObject<HTMLInputElement | null>;
  rowCount: number;
  saveRename: () => void;
  setMenuState: (state: Partial<MenuState>) => void;
};

function CategoryStackMenu({ menu }: { menu: CategoryStackMenuModel }) {
  const {
    cardCount,
    categories,
    category,
    categoryName,
    isMenuOpen,
    isMovingCards,
    isRenaming,
    menuButtonRef,
    onMoveCategoryCards,
    onRemoveCategory,
    onCategoryChange,
    onRenameCategory,
    readOnly,
    renameDraft,
    renameInputRef,
    rowCount,
    saveRename,
    setMenuState,
  } = menu;
  const removeReasonId = useId();
  const removeBlocked = rowCount > 0;

  return (
    <div>
      <DropdownMenu
        open={isMenuOpen}
        onOpenChange={(open) => setMenuState({ isMenuOpen: open, isMovingCards: false })}
      >
        <DropdownMenuTrigger
          ref={menuButtonRef}
          aria-label={`${categoryName} actions`}
          title={`${categoryName} actions`}
          render={
            <Button
              variant={null}
              size="icon-sm"
              className={`${buttonLooks.iconGhost} rounded-md`}
            />
          }
        >
          <MoreHorizontal className="size-3.5" />
        </DropdownMenuTrigger>
        {/* Like the old menu: shift to fit the viewport instead of flipping, so the move page stays whole. */}
        <DropdownMenuContent
          finalFocus={!isRenaming}
          positionerProps={{ collisionAvoidance: { side: "shift", align: "shift" } }}
        >
          {isMovingCards ? (
            <DropdownMenuGroup className="space-y-2">
              <DropdownMenuLabel>Move cards to</DropdownMenuLabel>
              {categories.map((targetCategory) =>
                targetCategory.id === category ? null : (
                  <DropdownMenuItem
                    key={targetCategory.id}
                    onClick={() => onMoveCategoryCards?.(category, targetCategory.id)}
                  >
                    {targetCategory.name}
                  </DropdownMenuItem>
                ),
              )}
              <DropdownMenuItem
                variant="muted"
                closeOnClick={false}
                onClick={() => setMenuState({ isMovingCards: false })}
              >
                Back
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : (
            <>
              <DropdownMenuItem
                disabled={readOnly || cardCount === 0 || !onMoveCategoryCards}
                closeOnClick={false}
                onClick={() => setMenuState({ isMovingCards: true })}
              >
                Move all cards
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={readOnly || !onRenameCategory}
                onClick={() => setMenuState({ renameDraft: categoryName, isRenaming: true })}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={readOnly || !onCategoryChange}
                onClick={() => onCategoryChange?.(category, { hidden: true })}
              >
                Hide category
              </DropdownMenuItem>
              {/* Disabled items ignore the pointer, so the wrapper carries the hover reason. */}
              <div title={removeBlocked ? "Move cards out before removing." : "Remove category"}>
                <DropdownMenuItem
                  disabled={readOnly || removeBlocked || !onRemoveCategory}
                  aria-describedby={removeBlocked ? removeReasonId : undefined}
                  variant="destructive"
                  onClick={() => onRemoveCategory?.(category)}
                >
                  Remove
                </DropdownMenuItem>
                {removeBlocked ? (
                  <span id={removeReasonId} className="sr-only">
                    Move cards out before removing.
                  </span>
                ) : null}
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover
        open={isRenaming}
        onOpenChange={(open) => {
          if (!open) setMenuState({ renameDraft: categoryName, isRenaming: false });
        }}
        onOpenChangeComplete={(open) => {
          if (open) renameInputRef.current?.select();
        }}
      >
        <PopoverContent
          anchor={menuButtonRef}
          initialFocus={renameInputRef}
          finalFocus={menuButtonRef}
          aria-label="Rename category"
        >
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveRename();
            }}
          >
            <Field>
              <FieldLabel size="sm">Rename category</FieldLabel>
              <Input
                ref={renameInputRef}
                inputSize="sm"
                value={renameDraft}
                onChange={(event) => setMenuState({ renameDraft: event.target.value })}
                className="rounded-lg select-text"
              />
            </Field>
            <div className="flex gap-2">
              <Button
                size="xs"
                className="flex-1 rounded-lg"
                onClick={() => setMenuState({ renameDraft: categoryName, isRenaming: false })}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" size="xs" className="flex-1 rounded-lg">
                Save
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
