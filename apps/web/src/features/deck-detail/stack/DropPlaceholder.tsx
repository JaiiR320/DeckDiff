export function DropPlaceholder({ height }: { height: number }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-xl border border-dashed border-ring/40 bg-ring/5 transition-all duration-150"
      style={{ minHeight: `${height}px` }}
    />
  );
}
