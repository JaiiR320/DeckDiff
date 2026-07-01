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

export type CardCategory = string;

export type DeckCategory = {
  id: CardCategory;
  name: string;
  kind?: "default" | "custom";
  hidden?: boolean;
  includeInDeck?: boolean;
};

const DEFAULT_CATEGORY_IDS: Record<(typeof CARD_CATEGORIES)[number], CardCategory> = {
  Land: "land",
  Creature: "creature",
  Artifact: "artifact",
  Enchantment: "enchantment",
  Instant: "instant",
  Sorcery: "sorcery",
  Planeswalker: "planeswalker",
  Battle: "battle",
  Other: "other",
};

export function defaultDeckCategories(): DeckCategory[] {
  return CARD_CATEGORIES.map((name) => ({ id: DEFAULT_CATEGORY_IDS[name], name, kind: "default" }));
}

export function createCategoryId(name: string, categories: DeckCategory[]) {
  const baseId =
    name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "category";
  const ids = new Set(categories.map((category) => category.id));

  if (!ids.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let nextId = `${baseId}-${suffix}`;
  while (ids.has(nextId)) {
    suffix += 1;
    nextId = `${baseId}-${suffix}`;
  }

  return nextId;
}

export function normalizeCategoryNameForCompare(name: string) {
  return name.trim().toLowerCase();
}

export function hasCategoryName(
  categories: DeckCategory[],
  name: string,
  exceptCategoryId?: string,
) {
  const normalizedName = normalizeCategoryNameForCompare(name);
  return categories.some(
    (category) =>
      category.id !== exceptCategoryId &&
      normalizeCategoryNameForCompare(category.name) === normalizedName,
  );
}

export function createCategoryName(name: string, categories: DeckCategory[]) {
  const baseName = name.trim() || "Category";

  if (!hasCategoryName(categories, baseName)) {
    return baseName;
  }

  let suffix = 2;
  let nextName = `${baseName} ${suffix}`;
  while (hasCategoryName(categories, nextName)) {
    suffix += 1;
    nextName = `${baseName} ${suffix}`;
  }

  return nextName;
}

export function defaultCategoryIdForName(name: string) {
  return DEFAULT_CATEGORY_IDS[name as (typeof CARD_CATEGORIES)[number]] ?? "other";
}

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
  categoryId?: CardCategory;
  category?: CardCategory;
  manaCost?: string;
  manaValue?: number;
  producedMana?: string[];
  setCode?: string;
  collectorNumber?: string;
  smallImageUrl?: string;
  imageUrl?: string;
  faces?: Array<{
    name: string;
    typeLine: string;
    manaCost?: string;
    oracleText?: string;
    smallImageUrl: string;
    imageUrl: string;
  }>;
  priceUsd?: number;
  edhrecRank?: number | null;
};

export function deckCardEntryKey(card: Pick<ValidatedDeckCard, "oracleId" | "categoryId">) {
  return `${card.categoryId ?? ""}\0${card.oracleId}`;
}

export type DeckExportOptions = {
  includeQuantity: boolean;
  includeSet: boolean;
  includeCollectorNumber: boolean;
  setStyle: "brackets" | "parentheses";
  groupByCategory?: boolean;
  includeOutOfDeckCategories?: boolean;
  separateSideboard?: boolean;
  deckName?: string;
  categories?: DeckCategory[];
};

export type InvalidDeckCard = {
  lineNumber: number;
  quantity: number;
  name: string;
  reason: string;
};

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

export function getDefaultCategoryId(typeLine: string) {
  return defaultCategoryIdForName(getCardCategory(typeLine));
}

export function normalizeDeckCategories(categories: unknown): DeckCategory[] {
  if (!Array.isArray(categories)) {
    return defaultDeckCategories();
  }

  const normalized: DeckCategory[] = [];
  const seen = new Set<string>();
  for (const category of categories) {
    if (!category || typeof category !== "object") {
      continue;
    }

    const id = String((category as { id?: unknown }).id ?? "").trim();
    const name = String((category as { name?: unknown }).name ?? "").trim();
    if (!id || !name || seen.has(id)) {
      continue;
    }

    seen.add(id);
    normalized.push({
      id,
      name,
      kind: (category as DeckCategory).kind,
      hidden: (category as DeckCategory).hidden === true,
      includeInDeck: (category as DeckCategory).includeInDeck !== false,
    });
  }

  return normalized.length > 0 ? normalized : defaultDeckCategories();
}

export function normalizeDeckCard(card: ValidatedDeckCard, categories = defaultDeckCategories()) {
  const categoryIds = new Set(categories.map((category) => category.id));
  const legacyId = card.category ? defaultCategoryIdForName(card.category) : undefined;
  const categoryId = card.categoryId ?? legacyId ?? getDefaultCategoryId(card.typeLine);
  const fallbackCategoryId = categoryIds.has("other") ? "other" : categories[0]?.id;

  return {
    ...card,
    categoryId: categoryIds.has(categoryId) ? categoryId : fallbackCategoryId,
  };
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

export function mergeValidatedCardEntries(cards: ValidatedDeckCard[]) {
  const mergedCards = new Map<string, ValidatedDeckCard>();

  for (const card of cards) {
    const key = deckCardEntryKey(card);
    const existingCard = mergedCards.get(key);

    if (existingCard) {
      existingCard.quantity += card.quantity;
      continue;
    }

    mergedCards.set(key, { ...card });
  }

  return [...mergedCards.values()];
}

export function formatDecklist(cards: ValidatedDeckCard[], options: DeckExportOptions) {
  if (options.groupByCategory) {
    return formatGroupedDecklist(cards, options);
  }

  if (options.separateSideboard) {
    return formatDecklistWithSideboard(cards, options);
  }

  const mergedCards = sortDeckCardsByName(mergeValidatedCards(cards));
  return formatDeckCardRows(mergedCards, options).join("\n").trim();
}

function formatGroupedDecklist(cards: ValidatedDeckCard[], options: DeckExportOptions) {
  const categories = normalizeDeckCategories(options.categories);
  const sections = categories.flatMap((category) => {
    if (category.includeInDeck === false && !options.includeOutOfDeckCategories) {
      return [];
    }

    const categoryCards = sortDeckCardsByName(
      mergeValidatedCards(cards.filter((card) => card.categoryId === category.id)),
    );
    if (categoryCards.length === 0) {
      return [];
    }

    return [`## ${category.name}\n${formatDeckCardRows(categoryCards, options).join("\n")}`];
  });

  return [`# ${options.deckName ?? "Deck"}`, ...sections].join("\n\n").trim();
}

function formatDecklistWithSideboard(cards: ValidatedDeckCard[], options: DeckExportOptions) {
  const categories = normalizeDeckCategories(options.categories);
  const sideboardCategoryIds = new Set<string>();

  for (const category of categories) {
    if (normalizeCategoryNameForCompare(category.name) === "sideboard") {
      sideboardCategoryIds.add(category.id);
    }
  }

  if (sideboardCategoryIds.size === 0) {
    return formatDeckCardRows(sortDeckCardsByName(mergeValidatedCards(cards)), options)
      .join("\n")
      .trim();
  }

  const mainCards = sortDeckCardsByName(
    mergeValidatedCards(cards.filter((card) => !sideboardCategoryIds.has(card.categoryId ?? ""))),
  );
  const sideboardCards = sortDeckCardsByName(
    mergeValidatedCards(cards.filter((card) => sideboardCategoryIds.has(card.categoryId ?? ""))),
  );
  const sections = [formatDeckCardRows(mainCards, options).join("\n")];

  if (sideboardCards.length > 0) {
    sections.push(`Sideboard\n${formatDeckCardRows(sideboardCards, options).join("\n")}`);
  }

  return sections.filter(Boolean).join("\n\n").trim();
}

function formatDeckCardRows(cards: ValidatedDeckCard[], options: DeckExportOptions) {
  return cards.flatMap((card) => {
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
}

function sortDeckCardsByName(cards: ValidatedDeckCard[]) {
  return cards.sort((left, right) => left.name.localeCompare(right.name));
}
