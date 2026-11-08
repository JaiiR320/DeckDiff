import { useDragDropMonitor } from "@dnd-kit/react";
import { ArrowDown, ArrowUp, Download, Import, Redo2, Undo2 } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@jaiir320/design-system/components/button";
import { Input } from "@jaiir320/design-system/components/input";
import { Popover, PopoverContent } from "@jaiir320/design-system/components/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jaiir320/design-system/components/select";
import { Separator } from "@jaiir320/design-system/components/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@jaiir320/design-system/components/tooltip";
import type { DeckCardSort, DeckCardSortDirection } from "#/lib/deck";
import { searchCards, type SearchCardResult } from "#/lib/scryfall";
import type { EditorRow } from "../editor/types";
import { CARD_GROUP_VIEW_OPTIONS, type CardGroupView } from "../stack/cardGroupView";
import { StackCard } from "../stack/StackCard";

type EditorHeaderProps = {
  onImport: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  canRedo: boolean;
  canUndo: boolean;
  onRedo: () => void;
  onUndo: () => void;
  cardSort: DeckCardSort;
  cardSortDirection: DeckCardSortDirection;
  cardGroupView: CardGroupView;
  onCardSortChange: (sort: DeckCardSort) => void;
  onCardGroupViewChange: (groupView: CardGroupView) => void;
  onReverseCardSortDirection: () => void;
  onPreviewCard: (card: SearchCardResult) => void;
};

const SEARCH_RESULTS_IDLE_CLOSE_MS = 10000;
const CARD_SORT_OPTIONS = [
  { value: "manaValue", label: "Mana value" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "price", label: "Price" },
  { value: "edhrecRank", label: "EDHREC rank" },
] satisfies Array<{ value: DeckCardSort; label: string }>;

type SearchState = {
  results: SearchCardResult[];
  isSearching: boolean;
  isResultsOpen: boolean;
};

type SearchAction =
  | { type: "clear" }
  | { type: "close" }
  | { type: "open" }
  | { type: "openLoading" }
  | { type: "results"; results: SearchCardResult[] };

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "clear":
      return { results: [], isSearching: false, isResultsOpen: false };
    case "close":
      return { ...state, isResultsOpen: false };
    case "open":
      return { ...state, isResultsOpen: true };
    case "openLoading":
      return { ...state, isSearching: true, isResultsOpen: true };
    case "results":
      return { ...state, results: action.results, isSearching: false };
  }
}

export function EditorHeader({
  onImport,
  onExport,
  exportDisabled,
  canRedo,
  canUndo,
  onRedo,
  onUndo,
  cardSort,
  cardSortDirection,
  cardGroupView,
  onCardSortChange,
  onCardGroupViewChange,
  onReverseCardSortDirection,
  onPreviewCard,
}: EditorHeaderProps) {
  return (
    <div className="border-b border-border p-5">
      <div className="flex items-center gap-3">
        <CardSearch onPreviewCard={onPreviewCard} />

        <Separator orientation="vertical" className="mx-1 h-10" />
        <div className="flex shrink-0 items-center gap-2">
          <Select
            items={CARD_GROUP_VIEW_OPTIONS}
            value={cardGroupView}
            onValueChange={(value) => {
              if (value !== null) {
                onCardGroupViewChange(value);
              }
            }}
          >
            <SelectTrigger aria-label="Group cards" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARD_GROUP_VIEW_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Separator orientation="vertical" className="mx-1 h-10" />
          <Select
            items={CARD_SORT_OPTIONS}
            value={cardSort}
            onValueChange={(value) => {
              if (value !== null) {
                onCardSortChange(value);
              }
            }}
          >
            <SelectTrigger aria-label="Sort cards" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CARD_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  onClick={onReverseCardSortDirection}
                  aria-label="Reverse card sort direction"
                />
              }
            >
              {cardSortDirection === "asc" ? (
                <ArrowUp className="size-4" strokeWidth={1.75} />
              ) : (
                <ArrowDown className="size-4" strokeWidth={1.75} />
              )}
            </TooltipTrigger>
            <TooltipContent>
              {`Reverse to ${cardSortDirection === "asc" ? "descending" : "ascending"}`}
            </TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-10" />
          <Tooltip>
            <TooltipTrigger
              render={<Button size="icon" onClick={onUndo} disabled={!canUndo} aria-label="Undo" />}
            >
              <Undo2 className="size-4" strokeWidth={1.75} />
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={<Button size="icon" onClick={onRedo} disabled={!canRedo} aria-label="Redo" />}
            >
              <Redo2 className="size-4" strokeWidth={1.75} />
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-10" />
          <Button onClick={onExport} disabled={exportDisabled} size="sm">
            <Download className="size-4" strokeWidth={1.75} />
            Export
          </Button>
          <Button onClick={onImport} size="sm">
            <Import className="size-4" strokeWidth={1.75} />
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardSearch({ onPreviewCard }: Pick<EditorHeaderProps, "onPreviewCard">) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Escape from a result moves focus back to the input; that focus must not reopen the results.
  const skipFocusReopenRef = useRef(false);
  const inactivityTimeoutRef = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const [isDraggingSearchCard, setIsDraggingSearchCard] = useState(false);
  const [{ results, isSearching, isResultsOpen }, dispatchSearch] = useReducer(searchReducer, {
    results: [],
    isSearching: false,
    isResultsOpen: false,
  });

  function clearInactivityTimer() {
    if (inactivityTimeoutRef.current !== null) {
      window.clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  }

  function resetInactivityTimer() {
    clearInactivityTimer();

    inactivityTimeoutRef.current = window.setTimeout(() => {
      const active = document.activeElement;
      // Idle close is suspended while the user is in the input or the results.
      if (containerRef.current?.contains(active) || popupRef.current?.contains(active)) {
        resetInactivityTimer();
        return;
      }
      dispatchSearch({ type: "close" });
    }, SEARCH_RESULTS_IDLE_CLOSE_MS);
  }

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 3) {
      dispatchSearch({ type: "clear" });
      clearInactivityTimer();
      return;
    }

    let isCancelled = false;
    dispatchSearch({ type: "openLoading" });
    resetInactivityTimer();

    const timeoutId = window.setTimeout(() => {
      void searchCards(trimmedQuery).then((nextResults) => {
        if (isCancelled) {
          return;
        }

        dispatchSearch({ type: "results", results: nextResults });
      });
    }, 300);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    if (!isResultsOpen) {
      clearInactivityTimer();
    }
  }, [isResultsOpen]);

  useEffect(() => {
    return () => {
      clearInactivityTimer();
    };
  }, []);

  useDragDropMonitor({
    onDragStart(event) {
      if (event.operation.source?.type !== "search-card") {
        return;
      }

      clearInactivityTimer();
      setIsDraggingSearchCard(true);
    },
    onDragEnd(event) {
      if (event.operation.source?.type !== "search-card") {
        return;
      }

      setIsDraggingSearchCard(false);
      dispatchSearch({ type: "close" });
    },
  });

  const isPopoverOpen = query.trim().length >= 3 && isResultsOpen;
  return (
    <>
      <div
        ref={containerRef}
        className="relative min-w-0 flex-1"
        onMouseEnter={resetInactivityTimer}
        onMouseMove={resetInactivityTimer}
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Focus stays in the input, so the popover never sees this Escape itself.
            if (event.key === "Escape") {
              dispatchSearch({ type: "close" });
              clearInactivityTimer();
            }
          }}
          onFocus={() => {
            if (skipFocusReopenRef.current) {
              skipFocusReopenRef.current = false;
              return;
            }
            if (query.trim().length >= 3) {
              dispatchSearch({ type: "open" });
              resetInactivityTimer();
            }
          }}
          aria-label="Add card"
          autoComplete="off"
          placeholder="Add card"
          inputSize="sm"
          className="py-2.5"
        />
      </div>

      <Popover
        open={isPopoverOpen}
        onOpenChange={(open, details) => {
          if (open) {
            return;
          }
          // The source of an active search drag must stay mounted until the drop completes.
          if (isDraggingSearchCard) {
            return;
          }
          // Pressing the anchored input is not an outside press.
          const target = details.event.target;
          if (target instanceof Node && containerRef.current?.contains(target)) {
            return;
          }
          skipFocusReopenRef.current = details.reason === "escape-key";
          dispatchSearch({ type: "close" });
        }}
      >
        <PopoverContent
          ref={popupRef}
          anchor={containerRef}
          align="start"
          initialFocus={false}
          // Escape from a focused result returns to the input; pointer closes leave focus alone.
          finalFocus={(closeType) => (closeType === "keyboard" ? inputRef.current : false)}
          aria-label="Search results"
          onMouseEnter={resetInactivityTimer}
          onMouseMove={resetInactivityTimer}
          className={`w-(--anchor-width) overflow-hidden p-0 shadow-black/40 ${isDraggingSearchCard ? "pointer-events-none opacity-0" : ""}`}
        >
          {isSearching ? (
            <div role="status" className="px-4 py-3 text-sm text-muted-foreground">
              Searching cards…
            </div>
          ) : results.length > 0 ? (
            <section aria-label="Results" className="flex gap-3 overflow-x-auto p-4">
              {results.map((card, index) => (
                <SearchResultCard
                  key={`${card.oracleId}-${card.name}`}
                  card={card}
                  index={index}
                  onPreview={() => {
                    resetInactivityTimer();
                    onPreviewCard(card);
                  }}
                />
              ))}
            </section>
          ) : (
            <div role="status" className="px-4 py-3 text-sm text-muted-foreground">
              No cards found.
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

function SearchResultCard({
  card,
  index,
  onPreview,
}: {
  card: SearchCardResult;
  index: number;
  onPreview: () => void;
}) {
  const row: EditorRow = {
    oracleId: card.oracleId,
    name: card.name,
    category: card.categoryId,
    typeLine: card.typeLine,
    manaCost: card.manaCost,
    manaValue: card.manaValue,
    producedMana: card.producedMana,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    smallImageUrl: card.smallImageUrl,
    imageUrl: card.imageUrl,
    edhrecRank: card.edhrecRank,
    baselineQuantity: 0,
    currentQuantity: 1,
    status: "same",
  };

  return (
    <div onMouseEnter={onPreview} onFocus={onPreview}>
      <StackCard
        row={row}
        index={index}
        onHover={onPreview}
        dragId={`search-card:${card.oracleId}:${card.setCode ?? ""}:${card.collectorNumber ?? ""}`}
        dragType="search-card"
        dragData={{ card }}
        layout="inline"
        readOnly={false}
        viewState={{
          hovered: false,
          shifted: false,
          showControls: false,
          showEdhrecRank: false,
        }}
      />
    </div>
  );
}
