export type SimCardImage = {
  name: string;
  frontImageUrl?: string;
  alternateImageUrl?: string;
  hasAlternateFace: boolean;
};

type ScryfallCard = {
  name: string;
  image_uris?: {
    normal?: string;
    small?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      normal?: string;
      small?: string;
    };
  }>;
};

const cardImageCache = new Map<string, Promise<SimCardImage | null>>();

export function normalizeCardImageName(name: string) {
  return name
    .replace(/\s*\/\/\s*/g, " // ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cardImageCacheKey(name: string) {
  return normalizeCardImageName(name).toLowerCase();
}

function faceImageUrl(face?: { image_uris?: { normal?: string; small?: string } }) {
  return face?.image_uris?.normal ?? face?.image_uris?.small;
}

function toSimCardImage(card: ScryfallCard): SimCardImage | null {
  const frontImageUrl =
    card.image_uris?.normal ?? card.image_uris?.small ?? faceImageUrl(card.card_faces?.[0]);
  const alternateImageUrl = faceImageUrl(card.card_faces?.[1]);

  if (!frontImageUrl && !alternateImageUrl) return null;

  return {
    name: card.name,
    frontImageUrl,
    alternateImageUrl,
    hasAlternateFace: Boolean(alternateImageUrl),
  };
}

async function fetchCardImage(name: string) {
  const response = await fetch(
    `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(normalizeCardImageName(name))}`,
    { headers: { Accept: "application/json" } },
  );

  if (!response.ok) return null;

  return toSimCardImage((await response.json()) as ScryfallCard);
}

export function getCardImage(name: string) {
  const cacheKey = cardImageCacheKey(name);
  const cachedImage = cardImageCache.get(cacheKey);

  if (cachedImage) return cachedImage;

  const imagePromise = fetchCardImage(name).catch(() => null);
  cardImageCache.set(cacheKey, imagePromise);
  return imagePromise;
}
