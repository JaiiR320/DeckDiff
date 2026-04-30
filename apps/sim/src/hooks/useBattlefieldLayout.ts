import { useMemo, useState } from "react";
import type { GameObject } from "@deckdiff/schemas";
import type { CardPosition, PositionMap } from "../sim/types.js";
import { gridSize } from "../sim/types.js";
import { isWithinBattlefield, snapPosition } from "../sim/geometry.js";

/** Returns the starting battlefield layout. */
function defaultPositions(objects: GameObject[]): PositionMap {
  return Object.fromEntries(
    objects.map((object, index) => [
      object.objectId,
      {
        x: 48 + (index % 4) * 168,
        y: 72 + Math.floor(index / 4) * 224,
      },
    ]),
  );
}

/** Returns staggered grid positions for a dropped group. */
export function staggeredPositions(origin: CardPosition, count: number): CardPosition[] {
  return Array.from({ length: count }, (_, index) =>
    snapPosition({
      x: origin.x + index * gridSize,
      y: origin.y + index * gridSize,
    }),
  );
}

/** Manages local battlefield card positions. */
export function useBattlefieldLayout(initialObjects: GameObject[]) {
  const [positions, setPositions] = useState(() => defaultPositions(initialObjects));

  /** Checks whether a group can be dropped onto the battlefield. */
  function canPlaceOnBattlefield(origin: CardPosition, count: number): boolean {
    return staggeredPositions(origin, count).every((position) => isWithinBattlefield(position));
  }

  /** Moves existing battlefield cards by a drag delta. */
  function moveBattlefieldObjects(objectIds: string[], delta: CardPosition) {
    setPositions((currentPositions) => {
      const nextPositions = Object.fromEntries(
        objectIds.map((objectId) => {
          const current = currentPositions[objectId] ?? { x: 0, y: 0 };
          return [objectId, snapPosition({ x: current.x + delta.x, y: current.y + delta.y })];
        }),
      ) as PositionMap;

      if (Object.values(nextPositions).some((position) => !isWithinBattlefield(position))) {
        return currentPositions;
      }

      return {
        ...currentPositions,
        ...nextPositions,
      };
    });
  }

  /** Removes cards from the local battlefield layout. */
  function removeObjects(objectIds: string[]) {
    setPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      for (const objectId of objectIds) delete nextPositions[objectId];
      return nextPositions;
    });
  }

  /** Assigns positions for cards that just entered the battlefield. */
  function syncAfterBattlefieldEntry(
    movedObjectIds: string[],
    battlefieldObjects: GameObject[],
    dropPosition: CardPosition,
  ) {
    setPositions((currentPositions) => {
      const nextPositions = { ...currentPositions };
      const missingObjects = battlefieldObjects.filter(
        (object) => nextPositions[object.objectId] === undefined,
      );

      for (const movedObjectId of movedObjectIds) delete nextPositions[movedObjectId];
      missingObjects.forEach((object, index) => {
        nextPositions[object.objectId] = snapPosition({
          x: dropPosition.x + index * gridSize,
          y: dropPosition.y + index * gridSize,
        });
      });

      return nextPositions;
    });
  }

  const zIndexByObjectId = useMemo(
    () => new Map(Object.keys(positions).map((objectId, index) => [objectId, index + 1])),
    [positions],
  );

  return {
    positions,
    zIndexByObjectId,
    canPlaceOnBattlefield,
    moveBattlefieldObjects,
    removeObjects,
    syncAfterBattlefieldEntry,
  };
}
