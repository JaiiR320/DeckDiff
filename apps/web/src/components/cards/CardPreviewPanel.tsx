import { Pin } from "lucide-react";
import { CardSymbolText } from "./CardSymbolText";
import type { CardPreviewResult } from "../../lib/scryfall";

type CardPreviewPanelProps = {
  preview: CardPreviewResult | null;
  status: "idle" | "loading" | "ready" | "error";
  requestedName?: string | null;
  isPinned: boolean;
  onTogglePinned: () => void;
};

export function CardPreviewPanel({
  preview,
  status,
  requestedName,
  isPinned,
  onTogglePinned,
}: CardPreviewPanelProps) {
  const hasPreview = preview !== null;

  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] lg:sticky lg:top-24">
      {hasPreview ? (
        <>
          <div className="relative group">
            <img
              src={preview.imageUrl}
              alt={preview.name}
              className="block w-full rounded-xl border border-zinc-800 bg-zinc-900"
            />
            <button
              type="button"
              onClick={onTogglePinned}
              aria-pressed={isPinned}
              aria-label={isPinned ? "Unpin card preview" : "Pin card preview"}
              title={isPinned ? "Unpin card preview" : "Pin card preview"}
              className={
                isPinned
                  ? "absolute left-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-400/50 text-zinc-950 shadow-lg shadow-cyan-500/20 transition opacity-60 group-hover:opacity-100"
                  : "absolute left-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700/70 bg-zinc-950/45 text-zinc-300 shadow-lg shadow-black/25 transition opacity-0 group-hover:opacity-100 hover:border-zinc-500/80 hover:bg-zinc-950/60 hover:text-zinc-100"
              }
            >
              <Pin
                className={isPinned ? "h-4.5 w-4.5 fill-current" : "h-4.5 w-4.5"}
                strokeWidth={2}
              />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-100">{preview.name}</h2>
                {preview.manaCost ? (
                  <CardSymbolText
                    text={preview.manaCost}
                    className="shrink-0 text-xs font-medium text-cyan-300"
                    symbolClassName="mx-[1px] inline-block h-4 w-4 align-[-0.2em]"
                  />
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{preview.typeLine}</p>
              {preview.setCode ? (
                <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-zinc-600">
                  {preview.setCode}
                  {preview.collectorNumber ? ` · ${preview.collectorNumber}` : ""}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm leading-6 text-zinc-300">
              {preview.oracleText ? (
                <CardSymbolText
                  as="div"
                  text={preview.oracleText}
                  className="whitespace-pre-line"
                  symbolClassName="mx-[1px] inline-block h-[0.95em] w-[0.95em] align-[-0.15em]"
                />
              ) : (
                "No oracle text available."
              )}
            </div>

            {status === "loading" ? (
              <p className="text-xs text-zinc-500">Updating preview...</p>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex min-h-105 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 px-5 text-center">
          <p className="max-w-[18rem] text-sm leading-6 text-zinc-500">
            {status === "loading" && requestedName
              ? `Loading ${requestedName}...`
              : status === "error" && requestedName
                ? `Could not load ${requestedName}.`
                : "Hover a card in the deck list or search results to pin its preview here."}
          </p>
        </div>
      )}
    </aside>
  );
}
