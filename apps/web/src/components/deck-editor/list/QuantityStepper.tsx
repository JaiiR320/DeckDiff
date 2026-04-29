import type { EditorRow } from "../types";

type QuantityStepperProps = {
  quantity: number;
  baselineQuantity: number;
  tone: EditorRow["status"];
  decrementLabel: string;
  incrementLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
};

export function QuantityStepper({
  quantity,
  baselineQuantity,
  tone,
  decrementLabel,
  incrementLabel,
  onDecrement,
  onIncrement,
}: QuantityStepperProps) {
  const badgeClass =
    tone === "added"
      ? "border-emerald-900 bg-emerald-950/40 text-emerald-300"
      : tone === "removed"
        ? "border-rose-900 bg-rose-950/40 text-rose-300"
        : tone === "changed"
          ? "border-amber-900 bg-amber-950/40 text-amber-300"
          : "border-zinc-800 bg-zinc-900 text-zinc-400";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={decrementLabel}
        onClick={onDecrement}
        disabled={quantity === 0 && baselineQuantity === 0}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-[10px] font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        -
      </button>
      <span
        className={`inline-flex h-7 min-w-8 items-center justify-center rounded-md border px-2 text-center text-[10px] font-medium ${badgeClass}`}
      >
        {quantity}
      </span>
      <button
        type="button"
        aria-label={incrementLabel}
        onClick={onIncrement}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-[10px] font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
      >
        +
      </button>
    </div>
  );
}
