export type CardPosition = {
  x: number;
  y: number;
};

export type PositionMap = Record<string, CardPosition>;

export type SelectionBox = {
  start: CardPosition;
  current: CardPosition;
};

export type Rectangle = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SimZone =
  | "battlefield"
  | "hand"
  | "library"
  | "graveyard"
  | "exile"
  | "command"
  | "stack";

export type DropTarget = {
  zone: SimZone;
  playerId?: string;
};

export type BattlefieldBounds = {
  width: number;
  height: number;
};

export const gridSize = 24;
export const cardWidth = 120;
export const cardHeight = 168;
export const zoneTrayHeight = 252;
export const battlefieldPadding = 8;
export const doubleClickMs = 320;
