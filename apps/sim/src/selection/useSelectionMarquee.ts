import { useState } from "react";
import type { PointerEvent } from "react";
import type { GameObject } from "@deckdiff/schemas";
import { cardRectangle, intersects, toRectangle } from "../battlefield/geometry.js";
import type { CardPosition, PositionMap, SelectionBox } from "../types.js";
import { useSimUiStore } from "../store.js";

/** Converts a pointer event into battlefield-local coordinates. */
function getBattlefieldPoint(event: PointerEvent<HTMLElement>): CardPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

/** Handles drag-box selection on the battlefield. */
export function useSelectionMarquee({
  objects,
  positions,
}: {
  objects: GameObject[];
  positions: PositionMap;
}) {
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 || !event.isPrimary || event.target !== event.currentTarget) return;

    const point = getBattlefieldPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionBox({ start: point, current: point });
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (!selectionBox) return;

    const point = getBattlefieldPoint(event);
    setSelectionBox((currentBox) => (currentBox ? { ...currentBox, current: point } : null));
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    if (!selectionBox) return;

    const box = toRectangle(selectionBox);
    event.currentTarget.releasePointerCapture(event.pointerId);
    setSelectionBox(null);

    if (box.right - box.left < 4 && box.bottom - box.top < 4) {
      useSimUiStore.getState().clearSelection();
      return;
    }

    useSimUiStore
      .getState()
      .setSelectedObjectIds(
        objects
          .filter((object) =>
            intersects(box, cardRectangle(positions[object.objectId] ?? { x: 24, y: 24 })),
          )
          .map((object) => object.objectId),
      );
  }

  return {
    selectionBox,
    battlefieldPointerHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}
