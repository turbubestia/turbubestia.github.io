import type { BossHeartInit, MathEvent } from '../math/lifecycle';
import {
  computeDisplayStats,
  EMPTY_LOADOUT,
  generateRewardOffer,
  type DisplayStats,
  type EquipmentCategory,
  type EquipmentItem,
  type EquipmentLoadout,
  type RewardOffer,
} from './equipment';

// Game-domain rule engine.
//
// This module consumes only the generic math events (hit, solved, boss_start,
// boss_end) and derives all combat/progression state from their payload fields.
// It never imports problem-generation or answer-checking logic, and it is not a
// second source of truth for answer validation. Displayed equipment stats are
// decorative and are never read by any combat rule.

export const HERO_MAX_HEALTH = 12;
export const RESPAWN_HEALTH = 8;
export const SOLVED_HEAL_AMOUNT = 1;
export const REWARD_CADENCE = 3;

export interface HeroState {
  health: number;
  maxHealth: number;
  defeated: boolean;
}

export interface RegularEnemyState {
  problemId: string;
  health: number;
  maxHealth: number;
}

export interface BossHeartState {
  problemId: string;
  health: number;
  maxHealth: number;
}

export type EncounterState =
  | { kind: 'none' }
  | { kind: 'regular'; enemy: RegularEnemyState }
  | { kind: 'boss'; hearts: BossHeartState[]; activeHeartIndex: number; queuedProblems: number };

export interface GameState {
  hero: HeroState;
  encounter: EncounterState;
  solvedCount: number;
  pendingReward: RewardOffer | null;
  loadout: EquipmentLoadout;
}

export interface ApplyEventResult {
  status: 'applied' | 'ignored';
  reason?: string;
}

const initialHero = (): HeroState => ({ health: HERO_MAX_HEALTH, maxHealth: HERO_MAX_HEALTH, defeated: false });

export class GameRules {
  private hero: HeroState = initialHero();
  private encounter: EncounterState = { kind: 'none' };
  private solvedCount = 0;
  private pendingReward: RewardOffer | null = null;
  private loadout: EquipmentLoadout = { ...EMPTY_LOADOUT };

  get state(): GameState {
    const encounter: EncounterState =
      this.encounter.kind === 'regular'
        ? { kind: 'regular', enemy: { ...this.encounter.enemy } }
        : this.encounter.kind === 'boss'
          ? {
              kind: 'boss',
              hearts: this.encounter.hearts.map((heart) => ({ ...heart })),
              activeHeartIndex: this.encounter.activeHeartIndex,
              queuedProblems: this.encounter.queuedProblems,
            }
          : { kind: 'none' };

    return {
      hero: { ...this.hero },
      encounter,
      solvedCount: this.solvedCount,
      pendingReward: this.pendingReward === null ? null : { ...this.pendingReward },
      loadout: { ...this.loadout },
    };
  }

  /** Begin a regular enemy encounter whose health budget matches the problem's correct-hit budget. */
  startEncounter(problemId: string, healthBudget: number): void {
    this.encounter = {
      kind: 'regular',
      enemy: { problemId, health: healthBudget, maxHealth: healthBudget },
    };
  }

  /** Apply a generic math event and derive the resulting game state. */
  applyEvent(event: MathEvent): ApplyEventResult {
    if (this.hero.defeated) {
      return { status: 'ignored', reason: 'hero-defeated' };
    }

    switch (event.type) {
      case 'hit':
        this.applyHit(event.outcome, event.value);
        return { status: 'applied' };
      case 'solved':
        this.applySolved();
        return { status: 'applied' };
      case 'boss_start':
        this.applyBossStart(event.queuedProblems, event.hearts);
        return { status: 'applied' };
      case 'boss_end':
        this.applyBossEnd();
        return { status: 'applied' };
    }
  }

  /** Restore the hero to respawn health while preserving the active encounter and progress. */
  respawn(): ApplyEventResult {
    if (!this.hero.defeated) {
      return { status: 'ignored', reason: 'not-defeated' };
    }
    this.hero.health = RESPAWN_HEALTH;
    this.hero.defeated = false;
    return { status: 'applied' };
  }

  /** Equip the offered item for a category, consuming the pending reward. */
  equipItem(category: EquipmentCategory): EquipmentItem | null {
    const offer = this.pendingReward?.[category] ?? null;
    if (offer === null) {
      return null;
    }
    this.loadout = { ...this.loadout, [category]: offer };
    this.pendingReward = null;
    return offer;
  }

  /** Advance the active encounter after the solved problem is explicitly continued. */
  advanceEncounter(): void {
    if (this.encounter.kind === 'boss') {
      const nextIndex = this.encounter.activeHeartIndex + 1;
      if (nextIndex >= this.encounter.hearts.length) {
        this.encounter = { kind: 'none' };
      } else {
        this.encounter = { ...this.encounter, activeHeartIndex: nextIndex };
      }
    } else if (this.encounter.kind === 'regular') {
      this.encounter = { kind: 'none' };
    }
  }

  /** Decorative display stats derived from the current loadout and math level. */
  getDisplayStats(): DisplayStats {
    return computeDisplayStats(this.loadout, this.solvedCount);
  }

  private applyHit(outcome: 'correct' | 'wrong', value: number): void {
    if (outcome === 'wrong') {
      const next = this.hero.health - value;
      this.hero.health = Math.max(0, next);
      if (next <= 0) {
        this.hero.defeated = true;
      }
      return;
    }

    // Correct hit: damage the active target (boss heart or regular enemy).
    if (this.encounter.kind === 'boss') {
      const heart = this.encounter.hearts[this.encounter.activeHeartIndex];
      if (heart !== undefined) {
        heart.health = Math.max(0, heart.health - value);
      }
    } else if (this.encounter.kind === 'regular') {
      this.encounter.enemy.health = Math.max(0, this.encounter.enemy.health - value);
    }
  }

  private applySolved(): void {
    // Heal the hero by a fixed amount, clamped at maximum health.
    this.hero.health = Math.min(this.hero.maxHealth, this.hero.health + SOLVED_HEAL_AMOUNT);

    this.solvedCount += 1;
    if (this.solvedCount % REWARD_CADENCE === 0) {
      this.pendingReward = generateRewardOffer(this.solvedCount);
    }

  }

  private applyBossStart(queuedProblems: number, hearts: readonly BossHeartInit[]): void {
    this.encounter = {
      kind: 'boss',
      hearts: hearts.map((heart) => ({ problemId: heart.problemId, health: heart.health, maxHealth: heart.health })),
      activeHeartIndex: 0,
      queuedProblems,
    };
  }

  private applyBossEnd(): void {
    if (this.encounter.kind === 'boss') {
      this.encounter = { kind: 'none' };
    }
  }
}
