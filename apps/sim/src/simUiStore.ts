import { create } from "zustand";
import type { CardPosition } from "./sim/types.js";

type SimUiStore = {
  hoveredObjectId: string | null;
  hoverClientX: number | null;
  selectedObjectIds: string[];
  draggedObjectId: string | null;
  dragOffset: CardPosition;
  handPreview: { playerId: string; draggedObjectId: string; insertIndex: number } | null;
  setHoveredObjectId: (objectId: string | null, clientX?: number) => void;
  toggleSelected: (objectId: string) => void;
  setSelectedObjectIds: (objectIds: string[]) => void;
  clearSelection: () => void;
  startDrag: (objectId: string) => void;
  setDragOffset: (offset: CardPosition) => void;
  setHandPreview: (preview: SimUiStore["handPreview"]) => void;
  clearDrag: () => void;
};

const zeroPosition = { x: 0, y: 0 };

export const useSimUiStore = create<SimUiStore>((set) => ({
  hoveredObjectId: null,
  hoverClientX: null,
  selectedObjectIds: [],
  draggedObjectId: null,
  dragOffset: zeroPosition,
  handPreview: null,
  setHoveredObjectId: (objectId, clientX) =>
    set({ hoveredObjectId: objectId, hoverClientX: clientX ?? null }),
  toggleSelected: (objectId) =>
    set((state) => ({
      selectedObjectIds: state.selectedObjectIds.includes(objectId)
        ? state.selectedObjectIds.filter((selectedObjectId) => selectedObjectId !== objectId)
        : [...state.selectedObjectIds, objectId],
    })),
  setSelectedObjectIds: (objectIds) => set({ selectedObjectIds: objectIds }),
  clearSelection: () => set({ selectedObjectIds: [] }),
  startDrag: (objectId) =>
    set({ draggedObjectId: objectId, dragOffset: zeroPosition, handPreview: null }),
  setDragOffset: (offset) => set({ dragOffset: offset }),
  setHandPreview: (preview) =>
    set((state) => {
      const current = state.handPreview;
      if (
        current?.playerId === preview?.playerId &&
        current?.draggedObjectId === preview?.draggedObjectId &&
        current?.insertIndex === preview?.insertIndex
      ) {
        return state;
      }

      return { handPreview: preview };
    }),
  clearDrag: () => set({ draggedObjectId: null, dragOffset: zeroPosition, handPreview: null }),
}));
