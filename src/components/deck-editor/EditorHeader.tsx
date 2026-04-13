import { Download, Import } from 'lucide-react'
import { useEffect, useState } from 'react'
import { searchCards, type SearchCardResult } from '../../lib/scryfall'

type EditorHeaderProps = {
  onImport: () => void
  onExport: () => void
  exportDisabled: boolean
  onAddCard: (card: SearchCardResult) => void
}

export function EditorHeader({
  onImport,
  onExport,
  exportDisabled,
  onAddCard,
}: EditorHeaderProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchCardResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < 3) {
      setResults([])
      setIsSearching(false)
      return
    }

    let isCancelled = false
    setIsSearching(true)

    const timeoutId = window.setTimeout(async () => {
      const nextResults = await searchCards(trimmedQuery)

      if (isCancelled) {
        return
      }

      setResults(nextResults)
      setIsSearching(false)
    }, 300)

    return () => {
      isCancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [query])

  function handleSelectCard(card: SearchCardResult) {
    onAddCard(card)
    setQuery('')
    setResults([])
    setIsSearching(false)
  }

  return (
    <div className="border-b border-zinc-800 p-5">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Add card"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500"
          />

          {query.trim().length >= 3 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/40">
              {isSearching ? (
                <div className="px-4 py-3 text-sm text-zinc-500">Searching cards...</div>
              ) : results.length > 0 ? (
                <div className="divide-y divide-zinc-800">
                  {results.map((card) => (
                    <button
                      key={`${card.oracleId}-${card.name}`}
                      type="button"
                      onClick={() => handleSelectCard(card)}
                      className="block w-full px-4 py-3 text-left transition hover:bg-zinc-900"
                    >
                      <div className="text-sm font-medium text-zinc-100">{card.name}</div>
                      <div className="mt-1 text-xs text-zinc-500">{card.typeLine}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-zinc-500">No cards found.</div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Export
          </button>
          <button
            type="button"
            onClick={onImport}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-900"
          >
            <Import className="h-4 w-4" strokeWidth={1.75} />
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
