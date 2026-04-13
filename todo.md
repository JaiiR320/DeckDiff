# QA Follow-Ups

- [x] Reorganize `src/components/deck-editor`
  - Move generic `ToggleChip` to shared `src/components/`.
  - Group supporting deck-editor files into clearer subfolders.
  - Keep main deck-editor components and types at the folder root.

- [x] Decouple `ExportDeckModal` from raw React state-setter shape
  - Replace `onExportOptionsChange((current) => ...)` with a simpler component API.
  - Keep the modal easier to read and less tied to parent implementation details.

- [x] Tighten `EditorDeckList` category typing
  - Replace `string` usage with `CardCategory` where applicable.
  - Keep the state and helpers aligned with the rest of the deck-editor types.
