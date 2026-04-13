# Glossary

## Folder
The top-level container for a user's deck editing work.

## Baseline Deck
The imported original deck snapshot. It is the reference point for all diff states in the editor.

## Working Deck
The current editable deck state in the editor.

## Result Deck
The export-ready form of the working deck. In practice, this is the same logical deck as the working deck viewed as output.

## Deck List
A text deck list in imported or exported form.

## Deck Entry
One parsed line from a deck list. Quantity is optional on import and defaults to `1`.

## Editor Row
A single card row in the deck editor UI.

## Editor Row State
The status of an editor row relative to the baseline deck: `same`, `added`, `removed`, or `changed`.

## Card Category
The high-level bucket used to organize cards in the on-screen UI, such as Land, Creature, Artifact, Instant, or Sorcery. Categories are for the editor UI only and are not included in export output.

## Validation
The step where imported or added card names are checked against Scryfall and resolved to canonical card data.

## Canonical Card
The normalized Scryfall-backed card record the app uses for display, validation, and export metadata.

## Add Card Search
The search flow used to find and insert new cards into the working deck.

## Export Modal
The export UI for generating a deck list from the working deck, including toggles for quantity, set code, and collector number.

## Export Format
The generated deck list output. Cards are exported in one global alphabetical list with no category headers.

## Split / Double-Faced Card Normalization
The lookup rule used for split and double-faced cards: use the front face name for Scryfall collection lookup while preserving the canonical full printed name for display and export.
