import type { EquipmentCategory } from '../game/equipment';
import { EQUIPMENT_CATEGORIES, computeDisplayStats } from '../game/equipment';
import type { GameState } from '../game/rules';
import { HealthHearts } from './HealthHearts';
import { PlaceholderArt } from './PlaceholderArt';

// Combat presentation (MGP6-03). Renders hero/enemy/boss state, equipment and
// decorative stats, and reward choices purely from supplied game state; user
// actions are forwarded through callbacks.

interface GameViewProps {
  gameState: GameState;
  onEquip: (category: EquipmentCategory) => void;
}

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  'hand-weapon': 'Weapon',
  armor: 'Armor',
  bow: 'Bow',
};

export function GameView({ gameState, onEquip }: GameViewProps) {
  const { hero, encounter, solvedCount, pendingReward, loadout } = gameState;
  const stats = computeDisplayStats(loadout, solvedCount);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {EQUIPMENT_CATEGORIES.map((category) => (
          <div key={category} className="flex min-h-20 w-24 flex-col items-center gap-1 rounded-lg border border-panel-border bg-panel p-2 text-center text-xs">
            <span className="text-neutral-400">{CATEGORY_LABELS[category]}</span>
            <span className="text-neutral-200">{loadout[category]?.name ?? '—'}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <div className="flex flex-col items-end gap-2 text-right text-sm">
          <Stat label="Attack" value={stats.damage} />
          <Stat label="Defence" value={stats.defense} />
          <Stat label="Level" value={stats.level} />
          <span className="text-xs text-neutral-500">Solved: {solvedCount}</span>
        </div>
        <div className="flex min-w-0 justify-center gap-3">
          <HeroPanel hero={hero} />
          <EncounterPanel encounter={encounter} />
        </div>
      </div>

      {pendingReward !== null && (
        <div role="group" aria-label="Choose a reward" className="flex flex-col gap-2 rounded-lg border border-panel-border bg-panel p-3">
          <h3 className="text-sm font-semibold text-neutral-200">Choose a reward</h3>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_CATEGORIES.map((category) => {
              const item = pendingReward[category];
              if (item === null) {
                return null;
              }
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onEquip(category)}
                  className="rounded-lg border border-panel-border bg-bg px-3 py-1.5 text-sm hover:bg-bg/70"
                >
                  {item.name} ({CATEGORY_LABELS[category]})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex flex-col leading-tight text-neutral-400">
      {label}
      <span className="font-mono text-xl text-neutral-200">{value}</span>
    </span>
  );
}

function HeroPanel({ hero }: { hero: GameState['hero'] }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <HealthHearts current={hero.health} max={hero.maxHealth} label="Hero health" />
      <PlaceholderArt name="Hero" frames={9} />
    </div>
  );
}

function EncounterPanel({ encounter }: { encounter: GameState['encounter'] }) {
  if (encounter.kind === 'none') {
    return null;
  }

  if (encounter.kind === 'regular') {
    return (
      <div className="flex flex-col items-center gap-2">
        <HealthHearts current={encounter.enemy.health} max={encounter.enemy.maxHealth} label="Enemy health" />
        <PlaceholderArt name="Enemy" frames={9} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-col items-center gap-1">
        <HealthHearts
          current={encounter.hearts[encounter.activeHeartIndex]?.health ?? 0}
          max={encounter.hearts[encounter.activeHeartIndex]?.maxHealth ?? 1}
          label="Boss heart"
        />
        <span className="text-xs text-neutral-400">
          Heart {encounter.activeHeartIndex + 1} of {encounter.hearts.length} · {encounter.queuedProblems} queued
        </span>
      </div>
      <PlaceholderArt name="Boss" frames={9} frameDurationMs={166} />
    </div>
  );
}
