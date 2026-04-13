# Rename Folders → Decks & Add Save History

## Context

DeckDiffer currently calls its top-level concept a "folder" — but it's really a deck. The app also has zero persistence; everything lives in React `useState` and is lost on refresh. This change renames "folder" to "deck" everywhere, adds localStorage persistence so decks survive refresh, and introduces a save-history system where each save is a snapshot of the decklist that can be loaded or diffed against any other save.

---

## Data Model

### New types — `src/lib/deck.ts` (replaces `src/lib/folders.ts`)

```typescript
type DeckSave = {
  id: string              // crypto.randomUUID()
  savedAt: string         // ISO-8601
  label: string           // "Save #N" or user-provided
  cards: ValidatedDeckCard[]
}

type DeckItem = {
  id: string
  name: string
  createdAt: string       // ISO-8601
  updatedAt: string       // ISO-8601
  saves: DeckSave[]       // oldest-first
}
```

Helpers: `createDeck(name)`, `createDeckSave(cards, label?, saveCount?)`, `getLatestSave(deck)`.

Each save stores the full `ValidatedDeckCard[]` — self-contained, trivially diffable. Saves live as an array on `DeckItem` itself (one storage key per deck list, simple).

### Persistence — `src/lib/storage.ts` (new)

localStorage under key `deckdiffer:decks`. Synchronous read/write.

Functions: `loadDecks()`, `saveDecks(decks)`, `loadDeckById(id)`, `upsertDeck(deck)`, `deleteDeck(id)`.

---

## File Changes

### Renames

| Old | New |
|-----|-----|
| `src/lib/folders.ts` | `src/lib/deck.ts` |
| `src/routes/folders.$folderId.tsx` | `src/routes/decks.$deckId.tsx` |
| `src/components/folders/FolderCard.tsx` | `src/components/decks/DeckCard.tsx` |
| `src/components/folders/CreateFolderModal.tsx` | `src/components/decks/CreateDeckModal.tsx` |

### New files

| File | Purpose |
|------|---------|
| `src/lib/deck.ts` | `DeckItem`, `DeckSave` types + factory helpers |
| `src/lib/storage.ts` | localStorage persistence layer |
| `src/components/deck-editor/modals/SaveDeckModal.tsx` | Optional label input before saving |
| `src/components/deck-editor/SaveHistoryPanel.tsx` | Saves list + load/compare UI (History tab content) |

### Delete

- `src/lib/folders.ts` — fully replaced by `deck.ts`

### Modified (import updates + minor logic)

| File | What changes |
|------|-------------|
| `src/routes/index.tsx` | Import from `deck.ts`/`storage.ts`; rename folder→deck in variables, UI text, and links (`/decks/$deckId`) |
| `src/routes/decks.$deckId.tsx` | Load deck from storage on mount; hydrate editor from latest save; add save handler; add Editor/History tab switcher |
| `src/components/decks/DeckCard.tsx` | Accept `DeckItem`; show `saves.length` count; link to `/decks/$deckId`; swap Folder icon |
| `src/components/decks/CreateDeckModal.tsx` | Rename labels (folder→deck) |
| `src/components/deck-editor/EditorHeader.tsx` | Add `onSave` prop + Save button (cyan primary style) |
| `src/components/deck-editor/EditorDeckList.tsx` | Add optional `readOnly` prop to hide QuantityStepper and restore buttons |

### Unchanged

`editorRows.ts`, `types.ts`, `DeckAlerts.tsx`, `ImportDeckModal.tsx`, `ExportDeckModal.tsx`, `QuantityStepper.tsx`, `ToggleChip.tsx`, `scryfall.ts`, `decklist.ts`, `__root.tsx`, `router.tsx`

---

## UI Design

### Home page (`/`)

- Grid of `DeckCard` components + "New Deck" button
- Each card: deck name, save count (e.g. "3 saves"), icon swap from `Folder` to `Layers` or `FileStack`
- Decks loaded from `loadDecks()` on mount
- Creating a new deck calls `createDeck(name)` + `upsertDeck()`

### Deck page (`/decks/$deckId`) — Tab switcher

A tab bar at the top of the deck section with two tabs: **Editor** and **History**.

**Editor tab** (default): The existing deck editor, unchanged except:
- On mount, if the deck has saves, hydrate `baselineDeck` and `workingCards` from the latest save
- Save button in `EditorHeader` — creates a `DeckSave` snapshot of current `workingCards`, appends to `deck.saves`, persists via `upsertDeck()`, resets baseline to the saved state

**History tab**: `SaveHistoryPanel` showing:
- Chronological list of saves (newest first) with label, timestamp
- "Load" button on each save — loads that save's cards into the editor and switches to Editor tab
- Compare mode: select two saves → renders a read-only diff using `buildEditorRows(saveA.cards, saveB.cards)` → displayed in `EditorDeckList` with `readOnly` prop (hides quantity steppers and restore buttons, same color-coded category-grouped layout)

### Save flow

1. User clicks Save in EditorHeader
2. `SaveDeckModal` opens with optional label input (defaults to "Save #N")
3. On confirm: `createDeckSave(workingCards, label, deck.saves.length)` → append to deck → `upsertDeck()` → baseline resets

### Diffing between saves

Reuses `buildEditorRows(olderSave.cards, newerSave.cards)` + `groupEditorRows()` — zero changes to diff logic. The resulting `EditorRow[]` with `status: same|added|removed|changed` renders in `EditorDeckList` with `readOnly={true}`.

---

## Implementation Order

### Phase 1 — Data model + storage (no UI)
1. Create `src/lib/deck.ts` with types and helpers
2. Create `src/lib/storage.ts` with localStorage functions
3. Verify both compile

### Phase 2 — Rename folder → deck (routing + home page)
4. Rename route file `folders.$folderId.tsx` → `decks.$deckId.tsx`; update `createFileRoute` path and param name
5. Rename `src/components/folders/` → `src/components/decks/`; rename components + props
6. Update `src/routes/index.tsx` to use new imports, deck terminology, and `loadDecks()`/`upsertDeck()`
7. Delete `src/lib/folders.ts`
8. Run dev server to regenerate `routeTree.gen.ts`; verify app works

### Phase 3 — Persistence (save/load)
9. In `decks.$deckId.tsx`: load deck from storage, hydrate from latest save
10. Add `handleSave` function
11. Add Save button to `EditorHeader` (`onSave` + `saveDisabled` props)
12. Create `SaveDeckModal`
13. Test: create deck → import → edit → save → refresh → verify persistence

### Phase 4 — Save history + diffing
14. Add Editor/History tab switcher to deck page
15. Create `SaveHistoryPanel` with saves list + Load button
16. Add `readOnly` prop to `EditorDeckList`
17. Add compare mode: select two saves → render read-only diff
18. Test: save multiple times → switch to History → load old save → compare two saves

---

## Verification

1. **Persistence**: Create a deck, import a list, save, refresh the browser — deck and save should survive
2. **Multiple saves**: Save, edit, save again — two entries in history with different card lists
3. **Load old save**: From History tab, load an earlier save — editor hydrates with those cards
4. **Diff two saves**: Select two saves in compare mode — read-only diff shows adds/removes/changes with correct color coding
5. **Route change**: Navigating to `/decks/some-id` works; old `/folders/` routes 404
6. **New deck**: Home page "New Deck" creates and persists a deck; navigating to it shows empty editor
7. **No regressions**: Import, search-add, quantity adjust, export, and restore still work exactly as before

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Data model + storage | ✅ Complete | `src/lib/deck.ts` + `src/lib/storage.ts` created |
| Phase 2 — Rename folder → deck | ✅ Complete | Routing + home page + deck actions |
| Phase 3 — Persistence (save/load) | ⏳ Pending | Save button + modal + hydration |
| Phase 4 — Save history + diffing | ⏳ Pending | History tab + compare mode |

### Phase 1 Details

**Goal**: Create `src/lib/deck.ts` with `DeckItem`/`DeckSave` types + helpers, and `src/lib/storage.ts` with localStorage functions. Verify compilation.

**Key requirement**: `DeckItem.id` = slugified deck name (e.g., "My Deck" → `my-deck`)

**Files created**:
- ✅ `src/lib/deck.ts` (new)
- ✅ `src/lib/storage.ts` (new)

**QA Checklist for Phase 1**:
- [x] `createDeck("My Commander Deck")` returns deck with id `my-commander-deck`
- [x] `createDeckSave(cards, label, count)` generates correct label
- [x] `loadDecks()` / `saveDecks()` roundtrip works
- [x] TypeScript compiles without errors

---

### Phase 2 Details

**Goal**: Rename "folder" → "deck" everywhere in the routing and home page. Update imports and regenerate route tree.

**Files to rename/move**:
1. ✅ `src/routes/folders.$folderId.tsx` → `src/routes/decks.$deckId.tsx` (updated route path + params)
2. ✅ `src/components/folders/FolderCard.tsx` → `src/components/decks/DeckCard.tsx` (renamed + added edit menu)
3. ✅ `src/components/folders/CreateFolderModal.tsx` → `src/components/decks/CreateDeckModal.tsx` (renamed labels)
4. ✅ `src/components/folders/` → `src/components/decks/` (directory rename)
5. ✅ **NEW** `src/components/decks/DeckActionsModal.tsx` — Edit, export, delete deck actions

**Files to modify**:
- ✅ `src/routes/index.tsx`: Uses `deck.ts`/`storage.ts`, deck terminology, persistence, deck actions
- ✅ `src/routes/decks.$deckId.tsx`: Updated imports and variable names from folder to deck

**Files to delete**:
- ✅ `src/lib/folders.ts` — fully replaced by `deck.ts`

**New Features Added**:
- **Deck edit menu**: Three-dot menu on each deck card (visible on hover)
- **Rename deck**: Change deck name (also updates the slug/URL)
- **Export deck**: Downloads latest save as `.txt` file
- **Delete deck**: With confirmation dialog showing save count

**QA Checklist for Phase 2**:
- [x] App builds without errors (`npm run build`)
- [x] Route tree regenerates (`routeTree.gen.ts` updated with `decks.$deckId`)
- [x] Home page loads and shows "New Deck" (not "New Folder")
- [x] Can create a new deck from home page (persisted to localStorage)
- [x] Clicking deck navigates to `/decks/$deckId`
- [x] Old `/folders/` routes return 404
- [x] Deck cards show edit menu on hover
- [x] Can rename deck, export deck, delete deck
- [x] No console errors

---

### Phase 3 Details

**Goal**: Add save functionality to the deck editor. Allow users to save snapshots of their deck that persist to localStorage.

**Files to modify**:
- `src/routes/decks.$deckId.tsx`: Add save handler, load deck from storage on mount
- `src/components/deck-editor/EditorHeader.tsx`: Add Save button (`onSave` + `saveDisabled` props)

**Files to create**:
- `src/components/deck-editor/modals/SaveDeckModal.tsx` — Optional label input before saving

**QA Checklist for Phase 3**:
- [ ] Deck page loads deck from localStorage on mount
- [ ] Save button in header opens SaveDeckModal
- [ ] Can save with default label "Save #N"
- [ ] Can save with custom label
- [ ] Save persists to localStorage
- [ ] After save, deck shows updated save count on home page
- [ ] Refresh preserves the saved cards
