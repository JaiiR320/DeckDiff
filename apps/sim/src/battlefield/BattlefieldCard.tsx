import { memo } from "react";
import type { CSSProperties } from "react";
import type { GameObject } from "@deckdiff/schemas";
import type { CardPosition } from "../types.js";
import type { SimCardImage } from "../cards/cardImages.js";
import { Card } from "../cards/Card.js";

export const BattlefieldCard = memo(function BattlefieldCard({
  object,
  image,
  position,
  zIndex,
  onToggleTapped,
}: {
  object: GameObject;
  image?: SimCardImage | null;
  position: CardPosition;
  zIndex: number;
  onToggleTapped: (objectId: string) => void;
}) {
  const style = {
    left: position.x,
    top: position.y,
    zIndex,
  } as CSSProperties;

  return (
    <div className="battlefield-card" style={style}>
      <Card object={object} image={image} isDropTarget={false} onToggleTapped={onToggleTapped} />
    </div>
  );
});
