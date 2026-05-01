import { Children, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { DropTarget } from "../types.js";
import { DropZone } from "../drag/DropZone.js";
import { handCardLeft } from "./handLayout.js";

export function HandZone({
  target,
  count,
  cardObjectIds,
  previewInsertIndex = null,
  onCardsRectChange,
  children,
}: {
  target: DropTarget;
  count: number;
  cardObjectIds: string[];
  previewInsertIndex?: number | null;
  onCardsRectChange?: (rect: DOMRectReadOnly | null) => void;
  children: ReactNode;
}) {
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const [cardsWidth, setCardsWidth] = useState(0);
  const cards = Children.toArray(children).map((node, index) => ({
    objectId: cardObjectIds[index] ?? "",
    node,
  }));

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
  const layoutCards = cards;
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
              key={child.objectId || index}
              className="hand-card-position"
              style={{ left: handCardLeft(slotIndex, slotCount, cardsWidth) } as CSSProperties}
            >
              {child.node}
            </div>
          );
        })}
      </div>
    </DropZone>
  );
}
