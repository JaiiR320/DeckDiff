import { useDraggable } from "@dnd-kit/react";
import { Minus, MoreHorizontal, Plus, RotateCw } from "lucide-react";
import { Button } from "@jaiir320/design-system/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@jaiir320/design-system/components/dropdown-menu";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DeckTileCover } from "#/lib/deck";
import type { CardCategory, DeckCategory } from "#/lib/decklist";
import type { EditorRow } from "../editor/types";
import { cardLayoutToCssVars, computeCardLayout, type CardLayout } from "./cardLayout";
import { createDeckTileCover } from "./deckTileCover";
import { cardDragId } from "./stackIds";
import { useFallbackCardImage } from "./useFallbackCardImage";

const noCategories: DeckCategory[] = [];

type StackCardProps = {
  row: EditorRow;
  index: number;
  onHover: () => void;
  onAdjustQuantity?: (row: EditorRow, delta: number) => void;
  onCardLayout?: (layout: CardLayout) => void;
  categories?: DeckCategory[];
  onMoveCardCategory?: (row: EditorRow, category: CardCategory) => void;
  onChangePrinting?: (row: EditorRow) => void;
  onSetDeckCover?: (cover: DeckTileCover) => void;
  dragData?: Record<string, unknown>;
  dragId?: string;
  dragType?: "card" | "search-card";
  layout?: "stack" | "inline";
  readOnly: boolean;
  viewState: {
    hovered: boolean;
    shifted: boolean;
    showControls: boolean;
    showEdhrecRank: boolean;
  };
};

export function StackCard({
  row,
  index,
  onHover,
  onAdjustQuantity,
  onCardLayout,
  categories = noCategories,
  onMoveCardCategory,
  onChangePrinting,
  onSetDeckCover,
  dragData,
  dragId,
  dragType = "card",
  layout = "stack",
  readOnly,
  viewState,
}: StackCardProps) {
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [cardLayout, setCardLayout] = useState<CardLayout | null>(null);
  const faceIdentity = `${row.oracleId}:${row.setCode ?? ""}:${row.collectorNumber ?? ""}:${row.name}`;
  const [faceState, setFaceState] = useState({ identity: faceIdentity, index: 0 });
  const faceIndex = faceState.identity === faceIdentity ? faceState.index : 0;
  const isMoveDisabled =
    readOnly || (dragType === "card" && (!onMoveCardCategory || row.currentQuantity <= 0));
  const { isDragging, ref: draggableRef } = useDraggable({
    id: dragId ?? cardDragId(row.oracleId, row.category),
    type: dragType,
    disabled: isMoveDisabled,
    data: dragData ?? { row },
  });
  const { imageUrl: fallbackImageUrl, faces } = useFallbackCardImage(row);
  const hasMultipleFaces = !!faces && faces.length > 1;
  const moveTargetCategories = categories.filter((category) => category.id !== row.category);
  const canMoveCard = !readOnly && !!onMoveCardCategory && row.currentQuantity > 0;
  const displayFaceIndex = hasMultipleFaces ? faceIndex % faces.length : 0;
  const imageUrl = hasMultipleFaces ? faces[displayFaceIndex]?.imageUrl : fallbackImageUrl;
  const imageName = hasMultipleFaces ? (faces[displayFaceIndex]?.name ?? row.name) : row.name;
  const isChanged = row.status !== "same";
  // Measured old result: the hover/drag ring only replaces the status ring on changed cards.
  const ringColorClass =
    row.status === "added"
      ? "ring-success/40"
      : row.status === "removed"
        ? "ring-destructive-text/40 opacity-70"
        : row.status === "changed"
          ? isDragging
            ? "ring-highlight-strong"
            : viewState.hovered
              ? "ring-highlight/70"
              : "ring-warning-hover/40"
          : "ring-border-strong/80";

  useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

  const cardStyle = cardLayout ? (cardLayoutToCssVars(cardLayout) as CSSProperties) : undefined;
  const measureCardElement = useCallback(
    (element: HTMLDivElement) => {
      const { height, width } = element.getBoundingClientRect();
      if (height <= 0 || width <= 0) return;

      const nextLayout = computeCardLayout({ height, width });
      setCardLayout((current) => (areCardLayoutsEqual(current, nextLayout) ? current : nextLayout));
      onCardLayout?.(nextLayout);
    },
    [onCardLayout],
  );
  const setCardRef = useCallback(
    (element: HTMLDivElement | null) => {
      draggableRef(element);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      if (!element) return;

      measureCardElement(element);

      const observer = new ResizeObserver(() => measureCardElement(element));
      observer.observe(element);
      resizeObserverRef.current = observer;
    },
    [draggableRef, measureCardElement],
  );

  return (
    <div
      className={
        layout === "stack"
          ? `pointer-events-none absolute left-3 right-3 select-none overflow-visible transition-transform duration-500 will-change-transform ${viewState.shifted ? "translate-y-[calc(100%_-_var(--stack-card-peek,_0)_+_var(--stack-card-hover-gap,_0))]" : "translate-y-0"}`
          : "pointer-events-none w-36 shrink-0 select-none overflow-visible"
      }
      style={
        layout === "stack"
          ? {
              top: `calc(${index} * var(--stack-card-peek, 0) + var(--stack-card-top-inset, 0))`,
              zIndex: index + 1,
            }
          : undefined
      }
      onFocus={onHover}
    >
      <div
        ref={setCardRef}
        onPointerEnter={onHover}
        style={cardStyle}
        className={`pointer-events-auto relative aspect-[488/680] overflow-hidden rounded-xl bg-surface shadow-lg shadow-black/30 [container-type:inline-size] ${isChanged ? "ring-2" : "ring-1"} transition-all duration-300 ${isMoveDisabled ? "" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "scale-[1.04] rotate-1 opacity-90 shadow-2xl shadow-info-surface/50 ring-2" : ""} ${ringColorClass}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={row.name}
            draggable={false}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-start justify-center bg-surface px-3 pt-8 text-center text-sm font-semibold text-subtle-foreground">
            {row.name}
          </div>
        )}

        <div className="absolute left-0 top-0 rounded-br-lg bg-surface-glass/75 px-[var(--card-badge-padding-x)] py-[var(--card-badge-padding-y)] font-mono text-[length:var(--card-badge-font-size)] font-semibold text-on-image-foreground shadow-lg shadow-black/30">
          {row.currentQuantity}
        </div>

        {viewState.showEdhrecRank && row.edhrecRank != null ? (
          <div className="absolute right-0 top-0 rounded-bl-lg bg-surface-glass/75 px-[var(--card-badge-padding-x)] py-[var(--card-badge-padding-y)] font-mono text-[length:var(--card-badge-font-size)] font-semibold text-on-image-foreground shadow-lg shadow-black/30">
            #{row.edhrecRank}
          </div>
        ) : null}

        <div className="absolute bottom-0 left-0 rounded-tr-lg bg-surface-glass/75 px-[var(--card-badge-padding-x)] py-[var(--card-badge-padding-y)] font-mono text-[length:var(--card-badge-font-size)] font-semibold text-on-image-foreground shadow-lg shadow-black/30">
          {formatPrice(row.priceUsd)}
        </div>

        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-on-image/45 to-transparent opacity-80" />

        {viewState.showControls ? (
          <div
            className={`absolute right-[var(--card-control-right)] top-[var(--card-control-top)] z-20 flex -translate-y-1/2 flex-col rounded-lg border border-on-image-border/20 bg-surface-glass/45 shadow-xl shadow-black/30 backdrop-blur-sm transition duration-200 ${viewState.hovered ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {readOnly ? null : (
              <>
                <Button
                  variant="overlay"
                  size="none"
                  aria-label={`Increase ${row.name} quantity`}
                  onClick={() => onAdjustQuantity?.(row, 1)}
                  className={railButtonClassName}
                >
                  <Plus className="size-[var(--card-control-icon-size)]" strokeWidth={2.5} />
                </Button>
                <Button
                  variant="overlay"
                  size="none"
                  aria-label={`Decrease ${row.name} quantity`}
                  onClick={() => onAdjustQuantity?.(row, -1)}
                  disabled={row.currentQuantity === 0 && row.baselineQuantity === 0}
                  className={`${railButtonClassName} border-t border-on-image-border/20`}
                >
                  <Minus className="size-[var(--card-control-icon-size)]" strokeWidth={2.5} />
                </Button>
              </>
            )}
            {hasMultipleFaces ? (
              <Button
                variant="overlay"
                size="none"
                aria-label={`Flip ${row.name}`}
                title="Flip card"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setFaceState((current) => ({
                    identity: faceIdentity,
                    index:
                      (current.identity === faceIdentity ? current.index + 1 : 1) % faces.length,
                  }));
                }}
                className={`${railButtonClassName} border-t border-on-image-border/20`}
              >
                <RotateCw className="size-[var(--card-control-icon-size)]" strokeWidth={2.5} />
              </Button>
            ) : null}
            <div className="border-t border-on-image-border/20">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`${row.name} actions`}
                  disabled={!onChangePrinting && (!onSetDeckCover || !imageUrl)}
                  onClick={(event) => event.stopPropagation()}
                  render={<Button variant="overlay" size="none" className={railButtonClassName} />}
                >
                  <MoreHorizontal
                    className="size-[var(--card-control-icon-size)]"
                    strokeWidth={2.5}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="left" align="start" className="w-44">
                  {imageUrl && onSetDeckCover ? (
                    <DropdownMenuItem
                      onClick={() => onSetDeckCover(createDeckTileCover(row, imageUrl, imageName))}
                    >
                      Use as deck cover
                    </DropdownMenuItem>
                  ) : null}
                  {onChangePrinting ? (
                    <DropdownMenuItem onClick={() => onChangePrinting(row)}>
                      Change printing
                    </DropdownMenuItem>
                  ) : null}
                  {moveTargetCategories.length > 0 ? (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger
                        disabled={!canMoveCard}
                        title={canMoveCard ? "Move to category" : "Card cannot be moved"}
                      >
                        Move to
                      </DropdownMenuSubTrigger>
                      {/* Like the old submenu: shift up to fit instead of flipping to bottom-aligned. */}
                      <DropdownMenuSubContent
                        positionerProps={{ collisionAvoidance: { align: "shift" } }}
                      >
                        {moveTargetCategories.map((category) => (
                          <DropdownMenuItem
                            key={category.id}
                            onClick={() => onMoveCardCategory?.(row, category.id)}
                          >
                            {category.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const railButtonClassName = "size-[var(--card-control-size)]";

function formatPrice(price: number | undefined) {
  return price === undefined ? "--" : `$${price.toFixed(2)}`;
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
