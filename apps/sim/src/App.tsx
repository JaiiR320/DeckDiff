import { useHotkey } from "@tanstack/react-hotkeys";
import { useCallback, useState } from "react";
import type { GameState } from "@deckdiff/schemas";
import { SimTable } from "./SimTable.js";
import { cardImageCacheKey } from "./cards/cardImages.js";
import { type CardImagesByName, useCardImages } from "./cards/useCardImages.js";
import {
  actionObjectIds,
  moveObjects,
  toggleFaceDown,
  toggleFlipped,
  toggleRevealedToAll,
  toggleTapped,
} from "./game.js";
import { createSeedGame } from "./seedGame.js";
import { useSimUiStore } from "./store.js";
import { findObjectLocation, isLibraryTopObject, topCard } from "./zones.js";

function drawCardForPlayer(game: GameState, actorPlayerId: string | undefined): GameState {
  const currentPlayer = actorPlayerId
    ? game.players.find((player) => player.id === actorPlayerId)
    : game.players[0];
  const drawnObject = currentPlayer ? topCard(currentPlayer.zones.library.objects) : null;
  if (!currentPlayer || !drawnObject) return game;

  return moveObjects(
    game,
    [drawnObject.objectId],
    { zone: "hand", playerId: currentPlayer.id },
    currentPlayer.id,
    currentPlayer.zones.hand.objects.length,
  );
}

function toggleAlternateFaceForObjects(
  game: GameState,
  objectIds: string[],
  cardImagesByName: CardImagesByName,
): GameState {
  const doubleFacedObjectIds = objectIds.filter((objectId) => {
    const found = findObjectLocation(game, objectId);
    return found
      ? (cardImagesByName[cardImageCacheKey(found.object.name)]?.hasAlternateFace ?? false)
      : false;
  });

  return toggleFlipped(game, doubleFacedObjectIds);
}

function revealTopLibraryOrToggleFaceDown(
  game: GameState,
  hoveredObjectId: string | null,
  objectIds: string[],
): GameState {
  if (hoveredObjectId && isLibraryTopObject(game, hoveredObjectId)) {
    return toggleRevealedToAll(game, hoveredObjectId);
  }

  return toggleFaceDown(game, objectIds);
}

export function App() {
  const [game, setGame] = useState(createSeedGame);
  const actorPlayer = game.players[0];
  const actorPlayerId = actorPlayer?.id;
  const cardImagesByName = useCardImages(game);

  /** Toggles tapped for the current action cards. */
  const toggleActionCardsTapped = useCallback((fallbackObjectId?: string) => {
    const { selectedObjectIds, hoveredObjectId } = useSimUiStore.getState();
    const objectIds = actionObjectIds({ selectedObjectIds, hoveredObjectId, fallbackObjectId });

    setGame((currentGame) => toggleTapped(currentGame, objectIds));
  }, []);

  /** Toggles alternate printed face for current double-faced action cards. */
  const toggleActionCardsAlternateFace = useCallback(
    (fallbackObjectId?: string) => {
      const { selectedObjectIds, hoveredObjectId } = useSimUiStore.getState();
      const objectIds = actionObjectIds({ selectedObjectIds, hoveredObjectId, fallbackObjectId });

      setGame((currentGame) =>
        toggleAlternateFaceForObjects(currentGame, objectIds, cardImagesByName),
      );
    },
    [cardImagesByName],
  );

  const drawCard = useCallback(() => {
    setGame((currentGame) => drawCardForPlayer(currentGame, actorPlayerId));
  }, [actorPlayerId]);

  const toggleRevealedTopLibraryOrFaceDown = useCallback((currentGame: typeof game) => {
    const { selectedObjectIds, hoveredObjectId } = useSimUiStore.getState();
    const objectIds = actionObjectIds({ selectedObjectIds, hoveredObjectId });

    setGame(revealTopLibraryOrToggleFaceDown(currentGame, hoveredObjectId, objectIds));
  }, []);

  useHotkey(
    "D",
    () => {
      if (useSimUiStore.getState().primaryDragObjectId !== null) return;
      drawCard();
    },
    { preventDefault: true },
  );

  useHotkey(
    "T",
    () => {
      if (useSimUiStore.getState().primaryDragObjectId !== null) return;
      toggleActionCardsTapped();
    },
    { preventDefault: true },
  );

  useHotkey(
    "F",
    () => {
      if (useSimUiStore.getState().primaryDragObjectId !== null) return;
      toggleRevealedTopLibraryOrFaceDown(game);
    },
    { preventDefault: true },
  );

  useHotkey(
    "Z",
    () => {
      if (useSimUiStore.getState().primaryDragObjectId !== null) return;
      toggleActionCardsAlternateFace();
    },
    { preventDefault: true },
  );

  if (!actorPlayer || !actorPlayerId) return null;

  return (
    <SimTable
      game={game}
      setGame={setGame}
      actorPlayer={actorPlayer}
      actorPlayerId={actorPlayerId}
      cardImagesByName={cardImagesByName}
      onToggleTapped={toggleActionCardsTapped}
    />
  );
}
