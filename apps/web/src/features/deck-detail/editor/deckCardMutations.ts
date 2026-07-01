import { deckCardEntryKey, type CardCategory, type ValidatedDeckCard } from "#/lib/decklist";
import type { CardPrintingOption, SearchCardResult } from "#/lib/scryfall";
import type { EditorRow } from "./types";

export function appendSearchCard(
  cards: ValidatedDeckCard[],
  card: SearchCardResult,
  categoryId: CardCategory,
) {
  const existingIndex = cards.findIndex(
    (existingCard) =>
      existingCard.oracleId === card.oracleId && existingCard.categoryId === categoryId,
  );

  if (existingIndex !== -1) {
    return cards.map((existingCard, index) =>
      index === existingIndex
        ? { ...existingCard, quantity: existingCard.quantity + 1, categoryId }
        : existingCard,
    );
  }

  return [
    ...cards,
    {
      oracleId: card.oracleId,
      name: card.name,
      quantity: 1,
      typeLine: card.typeLine,
      categoryId,
      manaCost: card.manaCost,
      manaValue: card.manaValue,
      producedMana: card.producedMana,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber,
      smallImageUrl: card.smallImageUrl,
      imageUrl: card.imageUrl,
      faces: card.faces,
      priceUsd: card.priceUsd,
      edhrecRank: card.edhrecRank,
    },
  ];
}

export function adjustCardQuantity(cards: ValidatedDeckCard[], row: EditorRow, delta: number) {
  const rowKey = editorRowEntryKey(row);
  const currentIndex = cards.findIndex((card) => deckCardEntryKey(card) === rowKey);

  if (currentIndex === -1) {
    return delta <= 0
      ? cards
      : [
          ...cards,
          {
            oracleId: row.oracleId,
            name: row.name,
            quantity: 1,
            typeLine: row.typeLine,
            categoryId: row.category,
            manaCost: row.manaCost,
            manaValue: row.manaValue,
            producedMana: row.producedMana,
            setCode: row.setCode,
            collectorNumber: row.collectorNumber,
            smallImageUrl: row.smallImageUrl,
            imageUrl: row.imageUrl,
            faces: row.faces,
            priceUsd: row.priceUsd,
            edhrecRank: row.edhrecRank,
          },
        ];
  }

  return cards.flatMap((card, index) => {
    const nextCard =
      index === currentIndex
        ? {
            ...card,
            quantity: card.quantity + delta,
          }
        : card;

    return nextCard.quantity > 0 ? [nextCard] : [];
  });
}

export function changeCardPrinting(
  cards: ValidatedDeckCard[],
  row: EditorRow,
  printing: CardPrintingOption,
) {
  const rowKey = editorRowEntryKey(row);

  return cards.map((card) =>
    deckCardEntryKey(card) === rowKey
      ? {
          ...card,
          name: printing.name,
          manaCost: printing.manaCost,
          producedMana: printing.producedMana,
          setCode: printing.setCode,
          collectorNumber: printing.collectorNumber,
          smallImageUrl: printing.smallImageUrl,
          imageUrl: printing.imageUrl,
          faces: printing.faces,
          priceUsd: printing.priceUsd,
          edhrecRank: printing.edhrecRank,
        }
      : card,
  );
}

export function moveCardToCategory(
  cards: ValidatedDeckCard[],
  row: EditorRow,
  categoryId: CardCategory,
) {
  const rowKey = editorRowEntryKey(row);
  const sourceCard = cards.find((card) => deckCardEntryKey(card) === rowKey);

  if (!sourceCard) {
    return cards;
  }

  const targetKey = deckCardEntryKey({ ...sourceCard, categoryId });
  let mergedIntoTarget = false;

  return cards
    .flatMap((card) => {
      const cardKey = deckCardEntryKey(card);

      if (cardKey === rowKey) {
        return targetKey === rowKey ? [card] : [];
      }

      if (cardKey === targetKey) {
        mergedIntoTarget = true;
        return [{ ...card, quantity: card.quantity + sourceCard.quantity }];
      }

      return [card];
    })
    .concat(mergedIntoTarget || targetKey === rowKey ? [] : [{ ...sourceCard, categoryId }]);
}

function editorRowEntryKey(row: EditorRow) {
  return deckCardEntryKey({ oracleId: row.oracleId, categoryId: row.category });
}
