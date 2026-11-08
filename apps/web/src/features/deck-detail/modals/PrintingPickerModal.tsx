import { X } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { Alert } from "@jaiir320/design-system/components/alert";
import { Badge } from "@jaiir320/design-system/components/badge";
import { Button } from "@jaiir320/design-system/components/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@jaiir320/design-system/components/dialog";
import { Empty } from "@jaiir320/design-system/components/empty";
import { Field, FieldLabel } from "@jaiir320/design-system/components/field";
import { Input } from "@jaiir320/design-system/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@jaiir320/design-system/components/select";
import { getCardPrintings, type CardPrintingOption } from "#/lib/scryfall";
import type { EditorRow } from "../editor/types";
import { PRINTING_SORT_OPTIONS, sortPrintings, type PrintingSort } from "./printingSort";

type PrintingPickerModalProps = {
  row: EditorRow;
  onClose: () => void;
  onSelect: (printing: CardPrintingOption) => void;
};

type PrintingsState = {
  oracleId: string;
  printings: CardPrintingOption[];
  status: "loading" | "ready" | "error";
};

export function PrintingPickerModal({ row, onClose, onSelect }: PrintingPickerModalProps) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<PrintingSort>("date");
  const popupRef = useRef<HTMLDivElement>(null);
  const [printingsState, setPrintingsState] = useReducer(
    (current: PrintingsState, next: Partial<PrintingsState>) => ({ ...current, ...next }),
    { oracleId: "", printings: [], status: "loading" },
  );
  const isCurrentRowLoaded = printingsState.oracleId === row.oracleId;
  const printings = isCurrentRowLoaded ? printingsState.printings : [];
  const status = isCurrentRowLoaded ? printingsState.status : "loading";

  useEffect(() => {
    let isCurrent = true;
    getCardPrintings(row.oracleId)
      .then((nextPrintings) => ({ printings: nextPrintings, status: "ready" as const }))
      .catch(() => ({ printings: [], status: "error" as const }))
      .then((nextState) => {
        if (isCurrent) setPrintingsState({ oracleId: row.oracleId, ...nextState });
      });

    return () => {
      isCurrent = false;
    };
  }, [row.oracleId]);

  const visiblePrintings = sortPrintings(
    printings.filter((printing) =>
      printing.setName.toLowerCase().includes(filter.trim().toLowerCase()),
    ),
    sort,
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent ref={popupRef} tabIndex={-1} initialFocus={popupRef} size="screen">
        <DialogHeader className="mb-5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-2xl">Select a printing</DialogTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,360px)_170px]">
              <Field className="block">
                {/* Inherited 16/24 line box around the smaller label keeps the old spacing. */}
                <FieldLabel className="text-base">
                  <span className="text-sm font-semibold text-strong-foreground">
                    Search printings…
                  </span>
                </FieldLabel>
                <Input
                  id="printing-set-filter"
                  aria-label="Search printings by set name"
                  inputSize="xs"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filter set name"
                  className="mt-1 border-border-strong placeholder:text-muted-foreground"
                />
              </Field>
              <div>
                <span className="text-sm font-semibold text-strong-foreground">Order by</span>
                <Select
                  items={PRINTING_SORT_OPTIONS}
                  value={sort}
                  onValueChange={(value) => {
                    if (value) setSort(value);
                  }}
                >
                  <SelectTrigger aria-label="Order printings by" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRINTING_SORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close printing picker"
                className="rounded-lg p-2 hover:text-foreground"
              />
            }
          >
            <X className="size-5" />
          </DialogClose>
        </DialogHeader>

        <DialogBody>
          {status === "loading" ? (
            <Empty
              variant="outline"
              role="status"
              className="rounded-2xl p-8 font-semibold text-subtle-foreground"
            >
              Loading printings…
            </Empty>
          ) : status === "error" ? (
            <Alert
              role="alert"
              size="panel"
              className="rounded-2xl p-8 text-center font-semibold text-destructive-emphasis"
            >
              Could not load printings from Scryfall.
            </Alert>
          ) : visiblePrintings.length === 0 ? (
            <Empty
              variant="outline"
              className="rounded-2xl p-8 font-semibold text-subtle-foreground"
            >
              No printings match that set name.
            </Empty>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
              {visiblePrintings.map((printing) => {
                const isSelected =
                  row.setCode === printing.setCode &&
                  row.collectorNumber === printing.collectorNumber;
                return (
                  <button
                    key={printing.scryfallId}
                    type="button"
                    onClick={() => onSelect(printing)}
                    className="group min-w-0 text-left"
                  >
                    <div
                      className={`relative overflow-hidden rounded-xl bg-background shadow-xl shadow-black/30 transition group-hover:-translate-y-1 group-hover:ring-2 group-hover:ring-highlight/80 ${isSelected ? "ring-2 ring-highlight" : "ring-1 ring-border-strong"}`}
                    >
                      {isSelected ? (
                        <Badge variant="selected" className="absolute inset-x-3 top-3 z-10">
                          Selected printing
                        </Badge>
                      ) : null}
                      <div className="aspect-[488/680] bg-surface">
                        {printing.imageUrl ? (
                          <img
                            src={printing.imageUrl}
                            alt={`${printing.name} ${printing.setCode}`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-start justify-center px-3 pt-8 text-center text-sm font-semibold text-muted-foreground">
                            {printing.name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 px-1 text-sm text-strong-foreground">
                      <span className="truncate font-semibold">{printing.setCode}</span>
                      <span>{formatPrice(printing.priceUsd)}</span>
                    </div>
                    <p className="mt-1 truncate px-1 text-xs text-muted-foreground">
                      {printing.setName} · {printing.releasedAt || "Unknown date"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function formatPrice(price: number | undefined) {
  return price === undefined ? "--" : `$${price.toFixed(2)}`;
}
