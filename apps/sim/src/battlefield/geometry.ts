import type { BattlefieldBounds, CardPosition, Rectangle, SelectionBox } from "../types.js";
import { battlefieldPadding, cardHeight, cardWidth, gridSize, zoneTrayHeight } from "../types.js";

/** Snaps a number to the table grid. */
export function snap(value: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Snaps a point to the table grid. */
export function snapPosition(position: CardPosition): CardPosition {
  return { x: snap(position.x), y: snap(position.y) };
}

/** Converts a drag-selection box into rectangle bounds. */
export function toRectangle(box: SelectionBox): Rectangle {
  return {
    left: Math.min(box.start.x, box.current.x),
    top: Math.min(box.start.y, box.current.y),
    right: Math.max(box.start.x, box.current.x),
    bottom: Math.max(box.start.y, box.current.y),
  };
}

/** Returns a card-sized rectangle at a position. */
export function cardRectangle(position: CardPosition): Rectangle {
  return {
    left: position.x,
    top: position.y,
    right: position.x + cardWidth,
    bottom: position.y + cardHeight,
  };
}

/** Checks whether two rectangles overlap. */
export function intersects(a: Rectangle, b: Rectangle): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

/** Checks whether a card fits inside the battlefield. */
export function isWithinBattlefield(
  position: CardPosition,
  bounds: BattlefieldBounds = { width: window.innerWidth, height: window.innerHeight },
): boolean {
  return (
    position.x >= battlefieldPadding &&
    position.y >= battlefieldPadding &&
    position.x + cardWidth <= bounds.width - battlefieldPadding &&
    position.y + cardHeight <= bounds.height - zoneTrayHeight - battlefieldPadding
  );
}
