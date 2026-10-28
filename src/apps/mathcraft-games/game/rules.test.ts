import { describe, expect, it } from 'vitest';
import type { MathEvent } from '../math/lifecycle';
import type { BossStartMessage } from './bossTypes';
import { REWARD_TIER_SOLVE_INTERVAL } from './equipment';
import { GameRules, HERO_MAX_HEALTH, RESPAWN_HEALTH } from './rules';

const correctHit = (value: number): MathEvent => ({
  type: 'hit',
  outcome: 'correct',
  value,
  stepIndex: 0,
  problemId: 'p1',
});

const wrongHit = (value: number): MathEvent => ({
  type: 'hit',
  outcome: 'wrong',
  value,
  stepIndex: 0,
  problemId: 'p1',
});

const solved = (): MathEvent => ({ type: 'solved', problemId: 'p1', totalSteps: 3 });

const bossStart = (hearts: { problemId: string; health: number }[]): BossStartMessage => ({
  type: 'boss_start',
  queuedProblems: hearts.length,
  hearts: hearts.map((h) => ({ problemId: h.problemId, health: h.health })),
});

describe('game rules: combat resolution', () => {
  it('reduces the active regular enemy health by the correct-hit value', () => {
    const game = new GameRules();
    game.startEncounter('p1', 5);

    game.applyEvent(correctHit(2));
    expect(game.state.encounter).toMatchObject({ kind: 'regular', enemy: { health: 3, maxHealth: 5 } });

    game.applyEvent(correctHit(2));
    expect(game.state.encounter).toMatchObject({ kind: 'regular', enemy: { health: 1 } });
  });

  it('clamps regular enemy health at zero without going negative', () => {
    const game = new GameRules();
    game.startEncounter('p1', 2);

    game.applyEvent(correctHit(5));
    expect(game.state.encounter).toMatchObject({ kind: 'regular', enemy: { health: 0 } });
  });

  it('reduces the active boss heart health by the correct-hit value and leaves other hearts intact', () => {
    const game = new GameRules();
    game.applyEvent(bossStart([{ problemId: 'b1', health: 4 }, { problemId: 'b2', health: 6 }, { problemId: 'b3', health: 8 }]));

    game.applyEvent(correctHit(3));
    const boss = game.state.encounter;
    expect(boss.kind).toBe('boss');
    if (boss.kind !== 'boss') return;
    expect(boss.hearts[0]).toMatchObject({ health: 1, maxHealth: 4 });
    expect(boss.hearts[1]).toMatchObject({ health: 6 });
    expect(boss.activeHeartIndex).toBe(0);
  });

  it('reduces hero health by the wrong-hit value', () => {
    const game = new GameRules();
    game.startEncounter('p1', 5);

    game.applyEvent(wrongHit(3));
    expect(game.state.hero).toMatchObject({ health: HERO_MAX_HEALTH - 3, defeated: false });
  });

  it('ignores correct hits when no encounter is active', () => {
    const game = new GameRules();
    const result = game.applyEvent(correctHit(2));
    expect(result.status).toBe('applied');
    expect(game.state.encounter).toMatchObject({ kind: 'none' });
    expect(game.state.hero.health).toBe(HERO_MAX_HEALTH);
  });
});

describe('game rules: healing', () => {
  it('heals the hero by 1 HP on a solved event', () => {
    const game = new GameRules();
    game.applyEvent(wrongHit(4));
    expect(game.state.hero.health).toBe(HERO_MAX_HEALTH - 4);

    game.applyEvent(solved());
    expect(game.state.hero.health).toBe(HERO_MAX_HEALTH - 3);
  });

  it('clamps healing at the hero maximum of 12 HP', () => {
    const game = new GameRules();
    expect(game.state.hero.health).toBe(HERO_MAX_HEALTH);

    game.applyEvent(solved());
    expect(game.state.hero.health).toBe(HERO_MAX_HEALTH);
  });

  it('heals a hero at 11 HP up to exactly 12 HP', () => {
    const game = new GameRules();
    game.applyEvent(wrongHit(1));
    expect(game.state.hero.health).toBe(11);

    game.applyEvent(solved());
    expect(game.state.hero.health).toBe(12);
  });
});

describe('game rules: defeat and respawn', () => {
  it('marks the hero defeated when health reaches zero or below', () => {
    const game = new GameRules();
    game.startEncounter('p1', 5);

    game.applyEvent(wrongHit(HERO_MAX_HEALTH));
    expect(game.state.hero).toMatchObject({ health: 0, defeated: true });
  });

  it('ignores further events while the hero is defeated', () => {
    const game = new GameRules();
    game.startEncounter('p1', 5);
    game.applyEvent(wrongHit(HERO_MAX_HEALTH));

    const result = game.applyEvent(correctHit(2));
    expect(result.status).toBe('ignored');
    expect(result.reason).toBe('hero-defeated');
    expect(game.state.encounter).toMatchObject({ kind: 'regular', enemy: { health: 5 } });
  });

  it('restores 8 HP on respawn while preserving the active regular encounter', () => {
    const game = new GameRules();
    game.startEncounter('p1', 5);
    game.applyEvent(correctHit(2));
    game.applyEvent(wrongHit(HERO_MAX_HEALTH));
    expect(game.state.hero.defeated).toBe(true);

    const result = game.respawn();
    expect(result.status).toBe('applied');
    expect(game.state.hero).toMatchObject({ health: RESPAWN_HEALTH, defeated: false });
    expect(game.state.encounter).toMatchObject({ kind: 'regular', enemy: { health: 3 } });
  });

  it('preserves boss heart state and queued problems across respawn', () => {
    const game = new GameRules();
    game.applyEvent(bossStart([{ problemId: 'b1', health: 4 }, { problemId: 'b2', health: 6 }, { problemId: 'b3', health: 8 }]));
    game.applyEvent(correctHit(3));
    game.applyEvent(solved());
    game.advanceEncounter(); // advance to heart 2
    game.applyEvent(wrongHit(HERO_MAX_HEALTH));
    expect(game.state.hero.defeated).toBe(true);

    game.respawn();
    const boss = game.state.encounter;
    expect(boss.kind).toBe('boss');
    if (boss.kind !== 'boss') return;
    expect(boss.activeHeartIndex).toBe(1);
    expect(boss.queuedProblems).toBe(3);
    expect(boss.hearts[0]).toMatchObject({ health: 1 });
    expect(boss.hearts[1]).toMatchObject({ health: 6 });
  });

  it('ignores respawn when the hero is not defeated', () => {
    const game = new GameRules();
    const result = game.respawn();
    expect(result.status).toBe('ignored');
    expect(result.reason).toBe('not-defeated');
    expect(game.state.hero.health).toBe(HERO_MAX_HEALTH);
  });
});

describe('game rules: boss progression', () => {
  it('represents three hearts and the declared queued-problem count on boss start', () => {
    const game = new GameRules();
    game.applyEvent(bossStart([{ problemId: 'b1', health: 4 }, { problemId: 'b2', health: 6 }, { problemId: 'b3', health: 8 }]));

    const boss = game.state.encounter;
    expect(boss.kind).toBe('boss');
    if (boss.kind !== 'boss') return;
    expect(boss.hearts).toHaveLength(3);
    expect(boss.queuedProblems).toBe(3);
    expect(boss.activeHeartIndex).toBe(0);
  });

  it('keeps the active heart until explicitly advanced, then ends after the third', () => {
    const game = new GameRules();
    game.applyEvent(bossStart([{ problemId: 'b1', health: 4 }, { problemId: 'b2', health: 6 }, { problemId: 'b3', health: 8 }]));

    game.applyEvent(solved());
    expect(game.state.encounter).toMatchObject({ kind: 'boss', activeHeartIndex: 0 });
    game.advanceEncounter();
    expect(game.state.encounter).toMatchObject({ kind: 'boss', activeHeartIndex: 1 });

    game.applyEvent(solved());
    expect(game.state.encounter).toMatchObject({ kind: 'boss', activeHeartIndex: 1 });
    game.advanceEncounter();
    expect(game.state.encounter).toMatchObject({ kind: 'boss', activeHeartIndex: 2 });

    game.applyEvent(solved());
    expect(game.state.encounter).toMatchObject({ kind: 'boss', activeHeartIndex: 2 });
    game.advanceEncounter();
    expect(game.state.encounter).toMatchObject({ kind: 'none' });
  });

  it('keeps a defeated regular enemy visible until explicitly advanced', () => {
    const game = new GameRules();
    game.startEncounter('p1', 1);

    game.applyEvent(correctHit(1));
    game.applyEvent(solved());
    expect(game.state.encounter).toMatchObject({ kind: 'regular', enemy: { problemId: 'p1', health: 0 } });

    game.advanceEncounter();
    expect(game.state.encounter).toMatchObject({ kind: 'none' });
  });

  it('clears a boss encounter on an explicit boss_end event', () => {
    const game = new GameRules();
    game.applyEvent(bossStart([{ problemId: 'b1', health: 4 }, { problemId: 'b2', health: 6 }, { problemId: 'b3', health: 8 }]));

    game.applyEvent({ type: 'boss_end' });
    expect(game.state.encounter).toMatchObject({ kind: 'none' });
  });

  it('ignores boss_end when no boss encounter is active', () => {
    const game = new GameRules();
    game.startEncounter('p1', 5);
    game.applyEvent({ type: 'boss_end' });
    expect(game.state.encounter).toMatchObject({ kind: 'regular' });
  });
});

describe('game rules: timed reward offers and decorative stats', () => {
  it('does not offer a reward automatically when a problem is solved', () => {
    const game = new GameRules();
    for (let i = 0; i < REWARD_TIER_SOLVE_INTERVAL; i += 1) {
      game.applyEvent(solved());
    }

    expect(game.state.pendingReward).toBeNull();
    expect(game.state.solvedCount).toBe(REWARD_TIER_SOLVE_INTERVAL);
  });

  it('creates a non-empty first-tier offer at an early solved count', () => {
    const game = new GameRules();

    game.offerReward();

    expect(game.state.pendingReward?.melee?.tier).toBe(1);
    expect(game.state.pendingReward?.range?.tier).toBe(1);
  });

  it('advances the offered tier with solved-count progression', () => {
    const game = new GameRules();
    for (let i = 0; i < REWARD_TIER_SOLVE_INTERVAL * 2; i += 1) {
      game.applyEvent(solved());
    }

    game.offerReward();

    expect(game.state.pendingReward?.melee?.tier).toBe(2);
    expect(game.state.pendingReward?.range?.tier).toBe(2);
  });

  it('selecting an item replaces only that category and consumes the reward', () => {
    const game = new GameRules();
    game.offerReward();

    const equipped = game.equipItem('melee');
    expect(equipped).not.toBeNull();
    expect(game.state.loadout.melee?.tier).toBe(1);
    expect(game.state.loadout.range).toBeNull();
    expect(game.state.pendingReward).toBeNull();
  });

  it('returns null when equipping a category with no pending offer', () => {
    const game = new GameRules();
    expect(game.equipItem('range')).toBeNull();
  });

  it('keeps decorative display stats separate from combat outcomes', () => {
    const withGear = new GameRules();
    withGear.offerReward();
    withGear.equipItem('melee');

    const bare = new GameRules();
    // Same combat sequence on both engines.
    for (const game of [withGear, bare]) {
      game.startEncounter('p1', 5);
      game.applyEvent(correctHit(2));
      game.applyEvent(wrongHit(3));
    }

    expect(withGear.state.encounter).toEqual(bare.state.encounter);
    expect(withGear.state.hero).toEqual(bare.state.hero);
    // Display stats differ but are purely decorative.
    expect(withGear.getDisplayStats().damage).toBeGreaterThan(bare.getDisplayStats().damage);
  });
});
