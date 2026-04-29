type ToggleChipProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

export function ToggleChip({ label, checked, onToggle }: ToggleChipProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 text-sm transition ${checked ? "border-cyan-800 bg-cyan-950/40 text-cyan-200" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800"}`}
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-cyan-500/80" : "bg-zinc-800"}`}
      >
        <span
          className={`h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-1"}`}
        />
      </span>
      {label}
    </button>
  );
}
