import { ChevronDown, ChevronsDownUp, ChevronsUpDown, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { CARD_CATEGORIES, type CardCategory } from '../../lib/decklist'
import { QuantityStepper } from './list/QuantityStepper'
import type { EditorRow } from './types'

type EditorDeckListProps = {
  groupedRows: Record<CardCategory, EditorRow[]>
  emptyMessage: string
  resultCardTotal: number
  onAdjustQuantity?: (row: EditorRow, delta: number) => void
  onRestoreCard?: (row: EditorRow) => void
  readOnly?: boolean
}

export function EditorDeckList({
  groupedRows,
  emptyMessage,
  resultCardTotal,
  onAdjustQuantity,
  onRestoreCard,
  readOnly = false,
}: EditorDeckListProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Partial<Record<CardCategory, boolean>>>({})
  const categoriesWithRows = CARD_CATEGORIES.filter((category) => groupedRows[category].length > 0)
  const areAllCollapsed =
    categoriesWithRows.length > 0 && categoriesWithRows.every((category) => collapsedCategories[category])

  function toggleCategory(category: CardCategory) {
    setCollapsedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }))
  }

  function setAllCategoriesCollapsed(isCollapsed: boolean) {
    setCollapsedCategories(
      Object.fromEntries(categoriesWithRows.map((category) => [category, isCollapsed])) as Partial<
        Record<CardCategory, boolean>
      >,
    )
  }

  if (categoriesWithRows.length === 0) {
    return (
      <div className="p-5">
        <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 text-center">
          <p className="max-w-sm text-sm text-zinc-500">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-5 pb-5 pt-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm font-medium uppercase tracking-[0.08em] text-zinc-500">
          {resultCardTotal} total card{resultCardTotal === 1 ? '' : 's'}
        </p>
        <button
          type="button"
          onClick={() => setAllCategoriesCollapsed(!areAllCollapsed)}
          aria-label={areAllCollapsed ? 'Expand all categories' : 'Collapse all categories'}
          title={areAllCollapsed ? 'Expand all categories' : 'Collapse all categories'}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800"
        >
          {areAllCollapsed ? <ChevronsUpDown className="h-3.5 w-3.5" /> : <ChevronsDownUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {categoriesWithRows.map((category) => {
        const rows = groupedRows[category]
        const addedCount = rows.filter((row) => row.status === 'added').length
        const changedCount = rows.filter((row) => row.status === 'changed').length
        const removedCount = rows.filter((row) => row.status === 'removed').length

        return (
          <section key={category} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/80">
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className={`flex w-full items-center justify-between gap-3 bg-zinc-900/80 px-4 py-3 text-left ${collapsedCategories[category] ? '' : 'border-b border-zinc-800'}`}
            >
              <div>
                <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.08em] text-zinc-400">{category}</h3>
                <p className="mt-1 font-mono text-sm text-zinc-600">
                  {rows.length} card{rows.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 font-mono text-sm font-medium uppercase tracking-[0.08em]">
                  <span className="text-emerald-300">+{addedCount}</span>
                  <span className="text-amber-300">~{changedCount}</span>
                  <span className="text-rose-300">-{removedCount}</span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-zinc-500 transition ${collapsedCategories[category] ? '-rotate-90' : 'rotate-0'}`}
                />
              </div>
            </button>

            {collapsedCategories[category] ? null : (
              <div>
                {rows.map((row, index) => {
                  const toneClass =
                    row.status === 'added'
                      ? 'bg-emerald-950/20'
                      : row.status === 'removed'
                        ? 'bg-rose-950/20'
                        : row.status === 'changed'
                          ? 'bg-amber-950/20'
                          : ''
                  const diffBorderClass = row.status === 'same' ? '' : 'shadow-[inset_3px_0_0_rgba(39,39,42,0.9)]'
                  return (
                    <div
                      key={row.oracleId}
                      className={`grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-sm ${index > 0 ? 'border-t border-zinc-800/90' : ''} ${toneClass} ${diffBorderClass}`}
                    >
                      <span className="text-zinc-100">{row.name}</span>
                      <div className="flex items-center gap-1.5">
                        {readOnly ? (
                          <span className="font-mono text-sm text-zinc-400">{row.currentQuantity}</span>
                        ) : (
                          <>
                            <QuantityStepper
                              quantity={row.currentQuantity}
                              baselineQuantity={row.baselineQuantity}
                              tone={row.status}
                              decrementLabel={`Decrease ${row.name} quantity`}
                              incrementLabel={`Increase ${row.name} quantity`}
                              onDecrement={() => onAdjustQuantity?.(row, -1)}
                              onIncrement={() => onAdjustQuantity?.(row, 1)}
                            />
                            <button
                              type="button"
                              aria-label={`Restore ${row.name}`}
                              title={`Restore ${row.name}`}
                              onClick={() => onRestoreCard?.(row)}
                              disabled={row.status === 'same'}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
