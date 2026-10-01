import { useEffect, useState, useSyncExternalStore } from 'react';
import { type GameSettings, type GameSnapshot, SightReadingGame } from './game';

export interface UseSightReadingGameResult {
  game: SightReadingGame;
  snapshot: GameSnapshot;
}

/**
 * Bridges the framework-free {@link SightReadingGame} to React. The game
 * instance is created once per component mount and observed with
 * useSyncExternalStore, so the component re-renders exactly when the game
 * emits (note events, settings changes, round regeneration).
 */
export function useSightReadingGame(settings: GameSettings): UseSightReadingGameResult {
  // Lazy init keeps the game instance stable across renders without
  // constructing a throwaway instance each render.
  const [game] = useState(() => new SightReadingGame(settings));

  const snapshot = useSyncExternalStore(
    (onChange) => game.subscribe(onChange),
    () => game.getSnapshot(),
  );

  useEffect(() => () => game.dispose(), [game]);

  return { game, snapshot };
}
