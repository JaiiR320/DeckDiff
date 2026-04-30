export type SimCardImage = {
  name: string;
  layout?: string;
  frontImageUrl?: string;
  alternateImageUrl?: string;
  hasAlternateFace: boolean;
  shouldRotatePreview: boolean;
};

type ScryfallCard = {
  name: string;
  layout?: string;
  image_uris?: {
    large?: string;
    normal?: string;
    small?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      large?: string;
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

function imageUrl(imageUris?: { large?: string; normal?: string; small?: string }) {
  return imageUris?.large ?? imageUris?.normal ?? imageUris?.small;
}

function faceImageUrl(face?: { image_uris?: { large?: string; normal?: string; small?: string } }) {
  return imageUrl(face?.image_uris);
}

function toSimCardImage(card: ScryfallCard): SimCardImage | null {
  const frontImageUrl = imageUrl(card.image_uris) ?? faceImageUrl(card.card_faces?.[0]);
  const alternateImageUrl = faceImageUrl(card.card_faces?.[1]);

  if (!frontImageUrl && !alternateImageUrl) return null;

  return {
    name: card.name,
    layout: card.layout,
    frontImageUrl,
    alternateImageUrl,
    hasAlternateFace: Boolean(alternateImageUrl),
    shouldRotatePreview: card.layout === "split",
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
