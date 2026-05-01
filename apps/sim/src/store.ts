import { create } from "zustand";
import type { CardPosition } from "./types.js";

type SimUiStore = {
  hoveredObjectId: string | null;
  hoverClientX: number | null;
  selectedObjectIds: string[];
  primaryDragObjectId: string | null;
  dragObjectIds: string[];
  dragOffset: CardPosition;
  handPreview: {
    playerId: string;
    primaryObjectId: string;
    dragObjectIds: string[];
    insertIndex: number;
  } | null;
  setHoveredObjectId: (objectId: string | null, clientX?: number) => void;
  toggleSelected: (objectId: string) => void;
  setSelectedObjectIds: (objectIds: string[]) => void;
  clearSelection: () => void;
  startDrag: (primaryObjectId: string, dragObjectIds: string[]) => void;
  setDragOffset: (offset: CardPosition) => void;
  setHandPreview: (preview: SimUiStore["handPreview"]) => void;
  clearDrag: () => void;
};

const zeroPosition = { x: 0, y: 0 };

export const useSimUiStore = create<SimUiStore>((set) => ({
  hoveredObjectId: null,
  hoverClientX: null,
  selectedObjectIds: [],
  primaryDragObjectId: null,
  dragObjectIds: [],
  dragOffset: zeroPosition,
  handPreview: null,
  setHoveredObjectId: (objectId, clientX) =>
    set((state) => {
      const hoverClientX = clientX ?? null;
      if (state.hoveredObjectId === objectId && state.hoverClientX === hoverClientX) return state;
      return { hoveredObjectId: objectId, hoverClientX };
    }),
  toggleSelected: (objectId) =>
    set((state) => ({
      selectedObjectIds: state.selectedObjectIds.includes(objectId)
        ? state.selectedObjectIds.filter((selectedObjectId) => selectedObjectId !== objectId)
        : [...state.selectedObjectIds, objectId],
    })),
  setSelectedObjectIds: (objectIds) => set({ selectedObjectIds: objectIds }),
  clearSelection: () => set({ selectedObjectIds: [] }),
  startDrag: (primaryObjectId, dragObjectIds) =>
    set({
      primaryDragObjectId: primaryObjectId,
      dragObjectIds,
      dragOffset: zeroPosition,
      handPreview: null,
    }),
  setDragOffset: (offset) => set({ dragOffset: offset }),
  setHandPreview: (preview) =>
    set((state) => {
      const current = state.handPreview;
      if (current === preview) return state;
      if (
        current?.playerId === preview?.playerId &&
        current?.primaryObjectId === preview?.primaryObjectId &&
        current?.dragObjectIds.length === preview?.dragObjectIds.length &&
        current?.dragObjectIds.every(
          (objectId, index) => objectId === preview?.dragObjectIds[index],
        ) &&
        current?.insertIndex === preview?.insertIndex
      ) {
        return state;
      }

      return { handPreview: preview };
    }),
  clearDrag: () =>
    set({
      primaryDragObjectId: null,
      dragObjectIds: [],
      dragOffset: zeroPosition,
      handPreview: null,
    }),
}));
