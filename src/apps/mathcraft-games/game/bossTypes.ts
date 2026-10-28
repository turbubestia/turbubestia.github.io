// Shared boss-related types for Mathcraft Games.
//
// These types are used by both the game rules engine and the session coordinator
// to construct and consume boss events. They are kept separate from the lifecycle
// module to avoid coupling the math domain to boss-specific concepts.

export interface BossHeartInit {
  problemId: string;
  health: number;
}

export interface BossStartMessage {
  type: 'boss_start';
  queuedProblems: number;
  hearts: readonly BossHeartInit[];
}

export interface BossEndMessage {
  type: 'boss_end';
}
