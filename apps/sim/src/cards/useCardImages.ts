import { useEffect, useState } from "react";
import type { GameState } from "@deckdiff/schemas";
import { cardImageCacheKey, getCardImage, type SimCardImage } from "./cardImages.js";

export type CardImagesByName = Record<string, SimCardImage | null>;

function gameCardNames(game: GameState) {
  return [
    ...game.players.flatMap((player) => [
      ...player.zones.library.objects,
      ...player.zones.hand.objects,
      ...player.zones.graveyard.objects,
    ]),
    ...game.zones.battlefield.objects,
    ...game.zones.stack.objects,
    ...game.zones.exile.objects,
    ...game.zones.command.objects,
  ].map((object) => object.name);
}

export function useCardImages(game: GameState) {
  const [cardImagesByName, setCardImagesByName] = useState<CardImagesByName>({});

  useEffect(() => {
    const uniqueNames = [...new Set(gameCardNames(game))];
    const missingNames = uniqueNames.filter(
      (name) => !Object.hasOwn(cardImagesByName, cardImageCacheKey(name)),
    );
    if (missingNames.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missingNames.map(
        async (name) => [cardImageCacheKey(name), await getCardImage(name)] as const,
      ),
    ).then((entries) => {
      if (cancelled) return;
      setCardImagesByName((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });

    return () => {
      cancelled = true;
    };
  }, [cardImagesByName, game]);

  return cardImagesByName;
}
