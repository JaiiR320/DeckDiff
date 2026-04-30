import { Children, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { DropTarget } from "../sim.js";
import { DropZone } from "./DropZone.js";

const cardWidth = 120;
const cardAreaPadding = 4;
const naturalCardGap = 12;

function handCardLeft(index: number, count: number, width: number): number {
  const availableWidth = Math.max(0, width - cardAreaPadding * 2);
  const maxLeft = Math.max(0, availableWidth - cardWidth);
  if (count <= 1) return cardAreaPadding + maxLeft / 2;

  const naturalSpan = (count - 1) * (cardWidth + naturalCardGap);
  if (naturalSpan <= maxLeft)
    return cardAreaPadding + (maxLeft - naturalSpan) / 2 + index * (cardWidth + naturalCardGap);

  return cardAreaPadding + (index * maxLeft) / (count - 1);
}

export function HandZone({
  target,
  count,
  children,
}: {
  target: DropTarget;
  count: number;
  children: ReactNode;
}) {
  const cardsRef = useRef<HTMLDivElement | null>(null);
  const [cardsWidth, setCardsWidth] = useState(0);
  const cards = Children.toArray(children);

  useLayoutEffect(() => {
    const element = cardsRef.current;
    if (!element) return;

    const updateWidth = () => setCardsWidth(element.clientWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <DropZone target={target} className="hand-zone">
      <div className="zone-label">Hand ({count})</div>
      <div ref={cardsRef} className="hand-cards">
        {cards.map((child, index) => (
          <div
            key={index}
            className="hand-card-position"
            style={{ left: handCardLeft(index, cards.length, cardsWidth) } as CSSProperties}
          >
            {child}
          </div>
        ))}
      </div>
    </DropZone>
  );
}
