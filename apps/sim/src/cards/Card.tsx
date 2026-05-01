import { useDraggable, useDroppable } from "@dnd-kit/react";
import { memo, useCallback, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";
import type { GameObject } from "@deckdiff/schemas";
import cardBackUrl from "../assets/CardBack.png";
import { cardTargetId } from "../drag/targets.js";
import { doubleClickMs } from "../types.js";
import type { SimCardImage } from "./cardImages.js";
import { useSimUiStore } from "../store.js";

export function CardVisual({
  object,
  image,
  isFaceDown = false,
}: {
  object: GameObject;
  image?: SimCardImage | null;
  isFaceDown?: boolean;
}) {
  const showCardBack = isFaceDown || object.status.faceDown;
  const imageUrl = object.status.flipped ? image?.alternateImageUrl : image?.frontImageUrl;

  return (
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
  );
}

export const Card = memo(function Card({
  object,
  image,
  isFaceDown = false,
  isSelectable = true,
  onToggleTapped,
}: {
  object: GameObject;
  image?: SimCardImage | null;
  isFaceDown?: boolean;
  isSelectable?: boolean;
  onToggleTapped: (objectId: string) => void;
}) {
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
    if (event.ctrlKey && isSelectable) {
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

  return (
    <div
      ref={setCardElement}
      className={["card-frame", isSelectable && isSelected ? "card-frame-selected" : ""]
        .filter(Boolean)
        .join(" ")}
      onPointerDownCapture={handlePointerDownCapture}
      onClick={handleClick}
      onMouseEnter={handleHover}
      onMouseLeave={() => setHoveredObjectId(null)}
    >
      <CardVisual object={object} image={image} isFaceDown={isFaceDown} />
    </div>
  );
});
