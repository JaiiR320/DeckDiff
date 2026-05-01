import { Children, isValidElement, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { DropTarget } from "../sim.js";
import { DropZone } from "./DropZone.js";

export const handCardWidth = 120;
const cardAreaPadding = 4;
const naturalCardGap = 12;

export function handCardLeft(index: number, count: number, width: number): number {
  const availableWidth = Math.max(0, width - cardAreaPadding * 2);
  const maxLeft = Math.max(0, availableWidth - handCardWidth);
  if (count <= 1) return cardAreaPadding + maxLeft / 2;

  const naturalSpan = (count - 1) * (handCardWidth + naturalCardGap);
  if (naturalSpan <= maxLeft)
    return cardAreaPadding + (maxLeft - naturalSpan) / 2 + index * (handCardWidth + naturalCardGap);

  return cardAreaPadding + (index * maxLeft) / (count - 1);
}

export function handCardCenter(index: number, count: number, width: number): number {
  return handCardLeft(index, count, width) + handCardWidth / 2;
}

function cardKeyObjectId(card: ReactNode): string | null {
  if (!isValidElement(card)) return null;
  if (card.key === null) return null;
  return String(card.key).replace(/^\.\$/, "").replace(/^\./, "");
}

export function HandZone({
  target,
  count,
  previewInsertIndex = null,
  previewMovedObjectIds = [],
  onCardsRectChange,
  children,
}: {
  target: DropTarget;
  count: number;
  previewInsertIndex?: number | null;
  previewMovedObjectIds?: string[];
  onCardsRectChange?: (rect: DOMRectReadOnly | null) => void;
  children: ReactNode;
}) {
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const [cardsWidth, setCardsWidth] = useState(0);
  const cards = Children.toArray(children);

  useLayoutEffect(() => {
    const element = cardsRef.current;
    if (!element) return;

    const updateWidth = () => {
      setCardsWidth(element.clientWidth);
      onCardsRectChange?.(element.getBoundingClientRect());
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => {
      observer.disconnect();
      onCardsRectChange?.(null);
    };
  }, [onCardsRectChange]);

  const showPreview = previewInsertIndex !== null;
  const movedObjectIdSet = new Set(previewMovedObjectIds);
  const layoutCards = cards.filter((card) => !movedObjectIdSet.has(cardKeyObjectId(card) ?? ""));
  const movingCards = cards.filter((card) => movedObjectIdSet.has(cardKeyObjectId(card) ?? ""));
  const clampedPreviewIndex = showPreview
    ? Math.min(Math.max(previewInsertIndex, 0), layoutCards.length)
    : null;
  const slotCount = layoutCards.length + (showPreview ? 1 : 0);

  return (
    <DropZone target={target} className="hand-zone">
      <div className="zone-label">Hand ({count})</div>
      <div ref={cardsRef} className="hand-cards">
        {showPreview && clampedPreviewIndex !== null ? (
          <div
            className="hand-card-position hand-card-preview-slot"
            style={
              {
                left: handCardLeft(clampedPreviewIndex, slotCount, cardsWidth),
              } as CSSProperties
            }
          />
        ) : null}
        {layoutCards.map((child, index) => {
          const slotIndex =
            showPreview && clampedPreviewIndex !== null && index >= clampedPreviewIndex
              ? index + 1
              : index;

          return (
            <div
              key={isValidElement(child) ? child.key : index}
              className="hand-card-position"
              style={{ left: handCardLeft(slotIndex, slotCount, cardsWidth) } as CSSProperties}
            >
              {child}
            </div>
          );
        })}
        {movingCards.map((child) => (
          <div
            key={isValidElement(child) ? `moving-${child.key}` : "moving"}
            className="hand-card-position hand-card-moving-source"
            style={
              {
                left: handCardLeft(cards.indexOf(child), cards.length, cardsWidth),
              } as CSSProperties
            }
          >
            {child}
          </div>
        ))}
      </div>
    </DropZone>
  );
}
