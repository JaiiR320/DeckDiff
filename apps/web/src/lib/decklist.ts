export const CARD_CATEGORIES = [
  "Land",
  "Creature",
  "Artifact",
  "Enchantment",
  "Instant",
  "Sorcery",
  "Planeswalker",
  "Battle",
  "Other",
] as const;

export type CardCategory = (typeof CARD_CATEGORIES)[number];

export type ParsedDeckEntry = {
  lineNumber: number;
  quantity: number;
  name: string;
  setCode?: string;
  collectorNumber?: string;
};

export type ParsedDeckError = {
  lineNumber: number;
  text: string;
  reason: string;
};

export type ValidatedDeckCard = {
  oracleId: string;
  name: string;
  quantity: number;
  typeLine: string;
  category: CardCategory;
  setCode?: string;
  collectorNumber?: string;
};

export type DeckExportOptions = {
  includeQuantity: boolean;
  includeSet: boolean;
  includeCollectorNumber: boolean;
  setStyle: "brackets" | "parentheses";
};

export type InvalidDeckCard = {
  lineNumber: number;
  quantity: number;
  name: string;
  reason: string;
};

export type GroupedDeckCards = Record<CardCategory, ValidatedDeckCard[]>;

export function createEmptyGroupedDeck(): GroupedDeckCards {
  return {
    Land: [],
    Creature: [],
    Artifact: [],
    Enchantment: [],
    Instant: [],
    Sorcery: [],
    Planeswalker: [],
    Battle: [],
    Other: [],
  };
}

export function parseDecklist(rawText: string) {
  const entries: ParsedDeckEntry[] = [];
  const errors: ParsedDeckError[] = [];
  const lines = rawText.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    const text = line.trim();
    if (!text) {
      continue;
    }

    const quantityMatch = text.match(/^(?:(\d+)x?\s+)?(.*)$/i);
    const quantityText = quantityMatch?.[1];
    const remainder = quantityMatch?.[2]?.trim();

    if (!remainder) {
      errors.push({
        lineNumber: index + 1,
        text,
        reason: "Could not parse this line.",
      });
      continue;
    }

    const quantity = quantityText ? Number(quantityText) : 1;

    let collectorNumber: string | undefined;
    let setCode: string | undefined;
    let name = remainder;

    const collectorMatch = name.match(/\s+(\d+[a-zA-Z]?)$/);
    if (collectorMatch) {
      collectorNumber = collectorMatch[1];
      name = name.slice(0, -collectorMatch[0].length).trim();
    }

    const setMatch = name.match(/\s*(?:\[([^\]]+)\]|\(([^)]+)\))$/);
    if (setMatch) {
      setCode = (setMatch[1] ?? setMatch[2])?.trim().toUpperCase();
      name = name.slice(0, -setMatch[0].length).trim();
    }

    if (!name || Number.isNaN(quantity) || quantity < 1) {
      errors.push({
        lineNumber: index + 1,
        text,
        reason: "Expected a card name and positive quantity.",
      });
      continue;
    }

    entries.push({
      lineNumber: index + 1,
      quantity,
      name,
      setCode,
      collectorNumber,
    });
  }

  return { entries, errors };
}

export function getCardCategory(typeLine: string): CardCategory {
  if (typeLine.includes("Land")) return "Land";
  if (typeLine.includes("Creature")) return "Creature";
  if (typeLine.includes("Artifact")) return "Artifact";
  if (typeLine.includes("Enchantment")) return "Enchantment";
  if (typeLine.includes("Instant")) return "Instant";
  if (typeLine.includes("Sorcery")) return "Sorcery";
  if (typeLine.includes("Planeswalker")) return "Planeswalker";
  if (typeLine.includes("Battle")) return "Battle";
  return "Other";
}

export function groupValidatedCards(cards: ValidatedDeckCard[]) {
  const groupedDeck = createEmptyGroupedDeck();
  const mergedCards = mergeValidatedCards(cards);

  for (const card of mergedCards) {
    groupedDeck[card.category].push(card);
  }

  for (const category of CARD_CATEGORIES) {
    groupedDeck[category].sort((left, right) => left.name.localeCompare(right.name));
  }

  return groupedDeck;
}

export function mergeValidatedCards(cards: ValidatedDeckCard[]) {
  const mergedCards = new Map<string, ValidatedDeckCard>();

  for (const card of cards) {
    const existingCard = mergedCards.get(card.oracleId);

    if (existingCard) {
      existingCard.quantity += card.quantity;
      continue;
    }

    mergedCards.set(card.oracleId, { ...card });
  }

  return [...mergedCards.values()];
}

export function formatDeckExport(cards: ValidatedDeckCard[]) {
  return formatDecklist(cards, {
    includeQuantity: true,
    includeSet: false,
    includeCollectorNumber: false,
    setStyle: "brackets",
  });
}

export function formatDecklist(cards: ValidatedDeckCard[], options: DeckExportOptions) {
  const mergedCards = mergeValidatedCards(cards).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  const rows = mergedCards.flatMap((card) => {
    const suffixParts: string[] = [];

    if (options.includeSet && card.setCode) {
      suffixParts.push(
        options.setStyle === "parentheses" ? `(${card.setCode})` : `[${card.setCode}]`,
      );
    }

    if (options.includeSet && options.includeCollectorNumber && card.collectorNumber) {
      suffixParts.push(card.collectorNumber);
    }

    const cardText = [card.name, ...suffixParts].join(" ").trim();

    if (options.includeQuantity) {
      return [`${card.quantity} ${cardText}`];
    }

    return Array.from({ length: card.quantity }, () => cardText);
  });

  return rows.join("\n").trim();
}
