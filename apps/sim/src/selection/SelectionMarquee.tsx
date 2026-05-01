import type { CSSProperties } from "react";
import type { SelectionBox } from "../types.js";
import { toRectangle } from "../battlefield/geometry.js";

export function SelectionMarquee({ box }: { box: SelectionBox }) {
  const rect = toRectangle(box);
  const style = {
    left: rect.left,
    top: rect.top,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
  } as CSSProperties;

  return <div className="selection-marquee" style={style} />;
}
