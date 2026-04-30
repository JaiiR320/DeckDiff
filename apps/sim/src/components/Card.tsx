import { useDraggable, useDroppable } from "@dnd-kit/react";
import { memo, useCallback, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";
import type { GameObject } from "@deckdiff/schemas";
import cardBackUrl from "../assets/CardBack.png";
import { cardTargetId, doubleClickMs } from "../sim.js";
import type { SimCardImage } from "../sim/cardImages.js";
import { useSimUiStore } from "../simUiStore.js";

export const Card = memo(function Card({
  object,
  image,
  isFaceDown = false,
  onToggleTapped,
}: {
  object: GameObject;
  image?: SimCardImage | null;
  isFaceDown?: boolean;
  onToggleTapped: (objectId: string) => void;
}) {
  const isHovered = useSimUiStore((state) => state.hoveredObjectId === object.objectId);
  const isSelected = useSimUiStore((state) => state.selectedObjectIds.includes(object.objectId));
  const setHoveredObjectId = useSimUiStore((state) => state.setHoveredObjectId);
  const toggleSelected = useSimUiStore((state) => state.toggleSelected);
  const { ref, handleRef } = useDraggable({ id: object.objectId });
  const lastPointerDown = useRef(0);
  const { ref: droppableRef } = useDroppable({ id: cardTargetId(object.objectId) });

  const setCardElement = useCallback(
    (element: HTMLDivElement | null) => {
      ref(element);
      handleRef(element);
      droppableRef(element);
    },
    [ref, handleRef, droppableRef],
  );

  function handlePointerDownCapture(event: PointerEvent) {
    if (event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      toggleSelected(object.objectId);
      return;
    }

    const now = Date.now();
    if (now - lastPointerDown.current < doubleClickMs) {
      lastPointerDown.current = 0;
      event.preventDefault();
      event.stopPropagation();
      onToggleTapped(object.objectId);
      return;
    }

    lastPointerDown.current = now;
  }

  function handleClick(event: MouseEvent) {
    event.stopPropagation();
  }

  function handleHover(event: MouseEvent) {
    setHoveredObjectId(object.objectId, event.clientX);
  }

  const showCardBack = isFaceDown || object.status.faceDown;
  const imageUrl = object.status.flipped ? image?.alternateImageUrl : image?.frontImageUrl;

  return (
    <div
      ref={setCardElement}
      className={[
        "card-frame",
        isHovered ? "card-frame-hovered" : "",
        isSelected ? "card-frame-selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDownCapture={handlePointerDownCapture}
      onClick={handleClick}
      onMouseEnter={handleHover}
      onMouseMove={handleHover}
      onMouseLeave={() => setHoveredObjectId(null)}
    >
      <div
        role="button"
        tabIndex={0}
        className={[
          "card",
          object.status.tapped ? "card-tapped" : "",
          showCardBack ? "card-face-down" : "",
          imageUrl && !showCardBack ? "card-with-image" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showCardBack ? (
          <img
            className="card-image card-back-image"
            src={cardBackUrl}
            alt="Magic card back"
            draggable={false}
          />
        ) : imageUrl ? (
          <img className="card-image" src={imageUrl} alt={object.name} draggable={false} />
        ) : (
          <>
            <span className="card-type">Permanent</span>
            <span className="card-name">{object.name}</span>
            <span className="card-status">
              Hover + T or double click to {object.status.tapped ? "untap" : "tap"}
            </span>
          </>
        )}
      </div>
    </div>
  );
});
