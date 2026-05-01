import type { ReactNode } from "react";
import type { DropTarget } from "../types.js";
import { DropZone } from "../drag/DropZone.js";

export function PileZone({
  target,
  label,
  count,
  children,
}: {
  target: DropTarget;
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <DropZone target={target} className="pile-zone">
      <div className="zone-label">
        {label} ({count})
      </div>
      {children}
    </DropZone>
  );
}
