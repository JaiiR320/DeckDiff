import {
  type InvalidDeckCard,
  type ParsedDeckEntry,
  type ValidatedDeckCard,
  getCardCategory,
} from "./decklist";

type ScryfallCard = {
  name: string;
  oracle_id: string | null;
  id: string;
  type_line: string;
  set: string;
  collector_number: string;
  mana_cost?: string;
  oracle_text?: string;
  image_uris?: {
    small?: string;
    normal?: string;
  };
  card_faces?: Array<{
    oracle_text?: string;
    image_uris?: {
      small?: string;
      normal?: string;
    };
  }>;
};

type ScryfallCollectionResponse = {
  data: ScryfallCard[];
  not_found?: Array<{ name?: string }>;
};

type ScryfallSearchResponse = {
  data: ScryfallCard[];
};

type ScryfallAutocompleteResponse = {
  data: string[];
};

export type ScryfallRuling = {
  object: "ruling";
  oracle_id: string;
  source: "wotc" | "scryfall";
  published_at: string;
  comment: string;
};

type ScryfallListResponse<T> = {
  object: "list";
  has_more: boolean;
  next_page?: string | null;
  warnings?: string[] | null;
  data: T[];
};

export type ScryfallJudgeCard = Record<string, unknown> & {
  object?: unknown;
  id?: unknown;
  name: string;
  layout?: unknown;
  mana_cost?: unknown;
  cmc?: unknown;
  type_line?: unknown;
  oracle_text?: unknown;
  colors?: unknown;
  card_faces?: unknown;
  color_identity?: unknown;
  keywords?: unknown;
  legalities?: unknown;
  rulings_uri?: string;
};

type JudgeCardFace = {
  object: string | null;
  name: string | null;
  mana_cost: string | null;
  type_line: string | null;
  oracle_text: string | null;
  colors: string[] | null;
  color_indicator: string[] | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  defense: string | null;
};

export type JudgeCardContext = {
  object: string | null;
  id: string | null;
  name: string;
  layout: string | null;
  mana_cost: string | null;
  cmc: number | null;
  type_line: string | null;
  oracle_text: string | null;
  colors: string[] | null;
  card_faces: JudgeCardFace[] | null;
  color_identity: string[] | null;
  keywords: string[] | null;
  legalities: Record<string, string> | null;
  rulings: ScryfallRuling[];
};

export type UnresolvedJudgeCardReference = {
  name: string;
  suggestions: string[];
};

type ScryfallSymbol = {
  symbol: string;
  english: string;
  svg_uri: string;
};

type ScryfallSymbologyResponse = {
  data: ScryfallSymbol[];
};

type ScryfallErrorResponse = {
  object: "error";
  details: string;
};

export type SearchCardResult = {
  oracleId: string;
  name: string;
  typeLine: string;
  category: ReturnType<typeof getCardCategory>;
  setCode?: string;
  collectorNumber?: string;
};

export type CardPreviewLookup = {
  name: string;
  setCode?: string;
  collectorNumber?: string;
};

export type CardPreviewResult = {
  name: string;
  typeLine: string;
  manaCost?: string;
  oracleText?: string;
  setCode?: string;
  collectorNumber?: string;
  smallImageUrl: string;
  imageUrl: string;
};

export type CardSymbol = {
  symbol: string;
  english: string;
  svgUri: string;
};

const SCRYFALL_COLLECTION_LIMIT = 75;
const cardPreviewCache = new Map<string, Promise<CardPreviewResult | null>>();
let cardSymbolsCache: Promise<Map<string, CardSymbol>> | null = null;

function normalizeCardQuery(query: string) {
  return query
    .replace(/\s*\/\/\s*/g, " // ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseReferencedCardNames(message: string) {
  const matches = message.matchAll(/\[\[([^\]]+)\]\]/g);

  return [
    ...new Set(Array.from(matches, (match) => normalizeCardQuery(match[1] ?? "")).filter(Boolean)),
  ];
}

export function stripCardReferenceMarkup(message: string) {
  return message
    .replace(/\[\[([^\]]+)\]\]/g, (_, cardName: string) => normalizeCardQuery(cardName))
    .trim();
}

function toJudgeCardContext(card: ScryfallJudgeCard, rulings: ScryfallRuling[]): JudgeCardContext {
  const cardFaces = Array.isArray(card.card_faces)
    ? card.card_faces
        .filter((face): face is Record<string, unknown> => !!face && typeof face === "object")
        .map((face) => ({
          object: typeof face.object === "string" ? face.object : null,
          name: typeof face.name === "string" ? face.name : null,
          mana_cost: typeof face.mana_cost === "string" ? face.mana_cost : null,
          type_line: typeof face.type_line === "string" ? face.type_line : null,
          oracle_text: typeof face.oracle_text === "string" ? face.oracle_text : null,
          colors: Array.isArray(face.colors)
            ? face.colors.filter((value): value is string => typeof value === "string")
            : null,
          color_indicator: Array.isArray(face.color_indicator)
            ? face.color_indicator.filter((value): value is string => typeof value === "string")
            : null,
          power: typeof face.power === "string" ? face.power : null,
          toughness: typeof face.toughness === "string" ? face.toughness : null,
          loyalty: typeof face.loyalty === "string" ? face.loyalty : null,
          defense: typeof face.defense === "string" ? face.defense : null,
        }))
    : null;

  return {
    object: typeof card.object === "string" ? card.object : null,
    id: typeof card.id === "string" ? card.id : null,
    name: card.name,
    layout: typeof card.layout === "string" ? card.layout : null,
    mana_cost: typeof card.mana_cost === "string" ? card.mana_cost : null,
    cmc: typeof card.cmc === "number" ? card.cmc : null,
    type_line: typeof card.type_line === "string" ? card.type_line : null,
    oracle_text: typeof card.oracle_text === "string" ? card.oracle_text : null,
    colors: Array.isArray(card.colors)
      ? card.colors.filter((value): value is string => typeof value === "string")
      : null,
    card_faces: cardFaces,
    color_identity: Array.isArray(card.color_identity)
      ? card.color_identity.filter((value): value is string => typeof value === "string")
      : null,
    keywords: Array.isArray(card.keywords)
      ? card.keywords.filter((value): value is string => typeof value === "string")
      : null,
    legalities:
      card.legalities && typeof card.legalities === "object"
        ? Object.fromEntries(
            Object.entries(card.legalities).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : null,
    rulings,
  };
}

function getCollectionLookupName(name: string) {
  const normalizedName = normalizeCardQuery(name);
  return normalizedName.includes("//")
    ? (normalizedName.split("//")[0]?.trim() ?? normalizedName)
    : normalizedName;
}

function toSearchCardResult(card: ScryfallCard): SearchCardResult {
  return {
    oracleId: card.oracle_id ?? card.id,
    name: card.name,
    typeLine: card.type_line,
    category: getCardCategory(card.type_line),
    setCode: card.set?.toUpperCase(),
    collectorNumber: card.collector_number,
  };
}

function toCardPreviewResult(card: ScryfallCard): CardPreviewResult | null {
  const faceWithImage = card.card_faces?.find(
    (face) => face.image_uris?.normal || face.image_uris?.small,
  );
  const smallImageUrl = card.image_uris?.small ?? faceWithImage?.image_uris?.small;
  const imageUrl = card.image_uris?.normal ?? faceWithImage?.image_uris?.normal;

  if (!smallImageUrl || !imageUrl) {
    return null;
  }

  return {
    name: card.name,
    typeLine: card.type_line,
    manaCost: card.mana_cost,
    oracleText:
      card.oracle_text ??
      card.card_faces
        ?.map((face) => face.oracle_text)
        .filter(Boolean)
        .join("\n\n"),
    setCode: card.set?.toUpperCase(),
    collectorNumber: card.collector_number,
    smallImageUrl,
    imageUrl,
  };
}

function getCardPreviewCacheKey({ name, setCode, collectorNumber }: CardPreviewLookup) {
  if (setCode && collectorNumber) {
    return `print::${setCode.toLowerCase()}::${collectorNumber.toLowerCase()}`;
  }

  return `name::${normalizeCardQuery(name).toLowerCase()}`;
}

async function fetchCardPreview({ name, setCode, collectorNumber }: CardPreviewLookup) {
  const headers = { Accept: "application/json" };

  if (setCode && collectorNumber) {
    const printResponse = await fetch(
      `https://api.scryfall.com/cards/${encodeURIComponent(setCode.toLowerCase())}/${encodeURIComponent(collectorNumber.toLowerCase())}`,
      { headers },
    );

    if (printResponse.ok) {
      return toCardPreviewResult((await printResponse.json()) as ScryfallCard);
    }
  }

  const namedResponse = await fetch(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(normalizeCardQuery(name))}`,
    { headers },
  );

  if (!namedResponse.ok) {
    return null;
  }

  return toCardPreviewResult((await namedResponse.json()) as ScryfallCard);
}

async function fetchNamedCard(name: string, mode: "exact" | "fuzzy") {
  const response = await fetch(
    `https://api.scryfall.com/cards/named?${mode}=${encodeURIComponent(normalizeCardQuery(name))}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (response.ok) {
    return (await response.json()) as ScryfallJudgeCard;
  }

  if (response.status === 404) {
    return null;
  }

  const errorPayload = (await response.json()) as ScryfallErrorResponse;
  throw new Error(errorPayload.details || `Could not find ${name} on Scryfall.`);
}

async function fetchCardSuggestions(name: string) {
  const response = await fetch(
    `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(normalizeCardQuery(name))}`,
    {
      headers: { Accept: "application/json" },
    },
  );

  if (response.ok) {
    const payload = (await response.json()) as ScryfallAutocompleteResponse;
    return [...new Set(payload.data.filter(Boolean))].slice(0, 5);
  }

  const searchResults = await searchCards(name);
  return [...new Set(searchResults.map((card) => card.name))].slice(0, 5);
}

async function fetchCardRulings(rulingsUri: string) {
  const response = await fetch(rulingsUri, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Could not load card rulings from Scryfall.");
  }

  const payload = (await response.json()) as ScryfallListResponse<ScryfallRuling>;
  return payload.data;
}

export async function fetchJudgeCardContext(name: string): Promise<JudgeCardContext> {
  const card = (await fetchNamedCard(name, "exact")) ?? (await fetchNamedCard(name, "fuzzy"));

  if (!card) {
    throw new Error(`Could not find ${name} on Scryfall.`);
  }

  const rulings =
    typeof card.rulings_uri === "string" ? await fetchCardRulings(card.rulings_uri) : [];

  return toJudgeCardContext(card, rulings);
}

export async function fetchJudgeCardContexts(question: string) {
  const cardNames = parseReferencedCardNames(question);
  const results = await Promise.all(
    cardNames.map(async (name) => {
      const card = (await fetchNamedCard(name, "exact")) ?? (await fetchNamedCard(name, "fuzzy"));

      if (!card) {
        return {
          kind: "unresolved" as const,
          unresolved: {
            name,
            suggestions: await fetchCardSuggestions(name),
          },
        };
      }

      const rulings =
        typeof card.rulings_uri === "string" ? await fetchCardRulings(card.rulings_uri) : [];

      return {
        kind: "resolved" as const,
        card: toJudgeCardContext(card, rulings),
      };
    }),
  );

  return {
    cards: results.flatMap((result) => (result.kind === "resolved" ? [result.card] : [])),
    unresolved: results.flatMap((result) =>
      result.kind === "unresolved" ? [result.unresolved] : [],
    ),
  };
}

export function getCardPreview(lookup: CardPreviewLookup) {
  const cacheKey = getCardPreviewCacheKey(lookup);
  const cachedPreview = cardPreviewCache.get(cacheKey);

  if (cachedPreview) {
    return cachedPreview;
  }

  const previewPromise = fetchCardPreview(lookup).catch(() => null);
  cardPreviewCache.set(cacheKey, previewPromise);
  return previewPromise;
}

async function fetchCardSymbols() {
  const response = await fetch("https://api.scryfall.com/symbology", {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error("Could not load Scryfall card symbols.");
  }

  const payload = (await response.json()) as ScryfallSymbologyResponse;

  return new Map(
    payload.data.map((symbol) => [
      symbol.symbol,
      {
        symbol: symbol.symbol,
        english: symbol.english,
        svgUri: symbol.svg_uri,
      },
    ]),
  );
}

export function getCardSymbols() {
  if (cardSymbolsCache) {
    return cardSymbolsCache;
  }

  cardSymbolsCache = fetchCardSymbols().catch((error) => {
    cardSymbolsCache = null;
    throw error;
  });

  return cardSymbolsCache;
}

async function fetchCardCollectionByEntries(entries: ParsedDeckEntry[]) {
  const response = await fetch("https://api.scryfall.com/cards/collection", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifiers: entries.map((entry) =>
        entry.setCode
          ? { name: getCollectionLookupName(entry.name), set: entry.setCode.toLowerCase() }
          : { name: getCollectionLookupName(entry.name) },
      ),
    }),
  });

  if (!response.ok) {
    throw new Error("Could not validate cards with Scryfall.");
  }

  return (await response.json()) as ScryfallCollectionResponse;
}

export async function searchCards(query: string) {
  const normalizedQuery = normalizeCardQuery(query);
  const headers = { Accept: "application/json" };

  if (normalizedQuery.includes("//")) {
    const namedResponse = await fetch(
      `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(normalizedQuery)}`,
      { headers },
    );

    if (namedResponse.ok) {
      const card = (await namedResponse.json()) as ScryfallCard;
      return [toSearchCardResult(card)];
    }

    const namedError = (await namedResponse.json()) as ScryfallErrorResponse;
    if (namedError.object !== "error") {
      return [] as SearchCardResult[];
    }
  }

  const response = await fetch(
    `https://api.scryfall.com/cards/search?unique=cards&order=name&q=${encodeURIComponent(normalizedQuery)}`,
    { headers },
  );

  if (!response.ok) {
    const fallbackResponse = await fetch(
      `https://api.scryfall.com/cards/search?unique=cards&order=name&q=${encodeURIComponent(`name:"${normalizedQuery}"`)}`,
      { headers },
    );

    if (!fallbackResponse.ok) {
      return [] as SearchCardResult[];
    }

    const fallbackPayload = (await fallbackResponse.json()) as ScryfallSearchResponse;
    return fallbackPayload.data.slice(0, 8).map(toSearchCardResult);
  }

  const payload = (await response.json()) as ScryfallSearchResponse;

  return payload.data.slice(0, 8).map(toSearchCardResult);
}

export async function validateDeckEntries(entries: ParsedDeckEntry[]) {
  if (entries.length === 0) {
    return {
      validCards: [] as ValidatedDeckCard[],
      invalidCards: [] as InvalidDeckCard[],
    };
  }

  const payloads: ScryfallCollectionResponse[] = [];
  const uniqueEntries = [
    ...new Map(
      entries.map((entry) => [
        `${getCollectionLookupName(entry.name).toLowerCase()}::${entry.setCode ?? ""}`,
        entry,
      ]),
    ).values(),
  ];

  for (let index = 0; index < uniqueEntries.length; index += SCRYFALL_COLLECTION_LIMIT) {
    payloads.push(
      await fetchCardCollectionByEntries(
        uniqueEntries.slice(index, index + SCRYFALL_COLLECTION_LIMIT),
      ),
    );
  }

  const allCards = payloads.flatMap((payload) => payload.data);
  const allNotFound = payloads.flatMap((payload) => payload.not_found ?? []);
  const cardByKey = new Map(
    allCards.map((card) => [`${card.name.toLowerCase()}::${card.set?.toUpperCase() ?? ""}`, card]),
  );
  const invalidNames = new Set(
    allNotFound.map((entry) => entry.name?.toLowerCase()).filter(Boolean),
  );

  const validCards: ValidatedDeckCard[] = [];
  const invalidCards: InvalidDeckCard[] = [];

  for (const entry of entries) {
    const lookupName = getCollectionLookupName(entry.name);
    const exactMatch = cardByKey.get(`${lookupName.toLowerCase()}::${entry.setCode ?? ""}`);
    const fallbackMatch = allCards.find(
      (card) =>
        (card.name.toLowerCase() === lookupName.toLowerCase() ||
          card.name.toLowerCase() === normalizeCardQuery(entry.name).toLowerCase()) &&
        (!entry.setCode || card.set?.toUpperCase() === entry.setCode),
    );
    const matchedCard = exactMatch ?? fallbackMatch;

    if (!matchedCard || invalidNames.has(lookupName.toLowerCase())) {
      invalidCards.push({
        lineNumber: entry.lineNumber,
        quantity: entry.quantity,
        name: entry.name,
        reason: entry.setCode
          ? `Card not found on Scryfall for set ${entry.setCode}.`
          : "Card not found on Scryfall.",
      });
      continue;
    }

    validCards.push({
      oracleId: matchedCard.oracle_id ?? matchedCard.id,
      name: matchedCard.name,
      quantity: entry.quantity,
      typeLine: matchedCard.type_line,
      category: getCardCategory(matchedCard.type_line),
      setCode: matchedCard.set?.toUpperCase(),
      collectorNumber: matchedCard.collector_number,
    });
  }

  return { validCards, invalidCards };
}
