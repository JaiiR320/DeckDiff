import { useDroppable } from "@dnd-kit/react";
import type { PointerEvent, ReactNode } from "react";
import type { DropTarget } from "../types.js";
import { zoneTargetId } from "./targets.js";

export function DropZone({
  target,
  className,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  target: DropTarget;
  className: string;
  children: ReactNode;
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void;
}) {
  const { ref } = useDroppable({ id: zoneTargetId(target) });

  return (
    <section
      ref={ref}
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {children}
    </section>
  );
}
