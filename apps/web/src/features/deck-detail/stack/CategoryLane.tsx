import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";
import { Button } from "@jaiir320/design-system/components/button";
import { Empty } from "@jaiir320/design-system/components/empty";
import type { ReactNode } from "react";
import type { CardCategory } from "#/lib/decklist";
import { laneId } from "./stackIds";

type CategoryLaneProps = {
  laneIndex: number;
  categories: CardCategory[];
  hasPreview: boolean;
  /** Writable lanes take focus so Shift+F10 / the ContextMenu key can open the lane menu. */
  focusable?: boolean;
  onLaneRef: (element: HTMLDivElement | null) => void;
  onRemoveLane?: (laneIndex: number) => void;
  children: ReactNode;
};

export function CategoryLane({
  laneIndex,
  categories,
  hasPreview,
  focusable = false,
  onLaneRef,
  onRemoveLane,
  children,
}: CategoryLaneProps) {
  const { ref } = useDroppable({
    id: laneId(laneIndex),
    type: "lane",
    accept: "category",
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <div
      ref={(element) => {
        ref(element);
        onLaneRef(element);
      }}
      {...(focusable && {
        "data-stack-lane": "",
        "data-lane-index": laneIndex,
        tabIndex: 0,
        "aria-label": `Lane ${laneIndex + 1}`,
      })}
      className={`flex min-h-80 min-w-0 flex-col gap-3 p-1 ${
        focusable
          ? "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          : ""
      }`}
    >
      {categories.length === 0 && !hasPreview ? (
        <Empty className="min-h-64 gap-3 rounded-xl bg-surface/25 px-4 font-semibold text-faint-foreground">
          <span>Empty lane</span>
          {onRemoveLane ? (
            <Button
              size="xs"
              onClick={() => onRemoveLane(laneIndex)}
              className="bg-background hover:bg-background hover:text-foreground"
            >
              Remove lane
            </Button>
          ) : null}
        </Empty>
      ) : (
        children
      )}
    </div>
  );
}
