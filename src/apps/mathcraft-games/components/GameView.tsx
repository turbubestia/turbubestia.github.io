
// Game Logic
import { EQUIPMENT_DISPLAY_CATEGORIES, computeDisplayStats } from '../game/equipment';
import type { GameState } from '../game/rules';

// Game Components
import { assetForItem, bossAssetUrl, CATEGORY_LABELS, heroAssetUrl, regularEnemyAssetUrl } from './equipmentAssets';
import { RPGHeartRow } from './HealthHearts';
import { PlaceholderArt } from './PlaceholderArt';


interface GameViewProps {
  gameState: GameState;
}

export function GameView({ gameState }: GameViewProps) {
  const { hero, encounter, solvedCount, loadout } = gameState;
  const stats = computeDisplayStats(loadout, solvedCount);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Combat Stage panel */}
      <section className="rpg-box flex flex-col gap-3 p-4" aria-label="Combat stage">
        <div className="flex items-center justify-between border-b border-rpg-border pb-2">
          <span className="font-pixel text-xs text-rpg-text">COMBAT STAGE</span>
          <span className="text-base text-rpg-text-dim">{encounterLabel(encounter)}</span>
        </div>
        <div className="relative flex min-h-60 items-end justify-between overflow-hidden rounded border border-rpg-border bg-rpg-slot p-6">
          {/* Grid floor overlay */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-2">
            <RPGHeartRow selectedHeartIndex={0} currentHp={hero.health} totalHp={hero.maxHealth} maxHearts={1} heartSize={28} />
            <PlaceholderArt name="Hero" src={heroAssetUrl(loadout.armor)} alt="Hero" />
            <span className="font-pixel text-[11px] text-rpg-text">HERO</span>
          </div>
          {encounter.kind !== 'none' && (
            <div className="relative z-10 flex flex-col items-center gap-2">
              {encounter.kind === 'regular' ? (
                <>
                  <RPGHeartRow selectedHeartIndex={0} currentHp={encounter.enemy.health} totalHp={encounter.enemy.maxHealth} maxHearts={1} heartSize={28} />
                  <PlaceholderArt name="Enemy" src={regularEnemyAssetUrl(encounter)} alt="Enemy" />
                  <span className="font-pixel text-[11px] text-rpg-text-dim">ENEMY</span>
                </>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-1">
                    <RPGHeartRow
                      selectedHeartIndex={encounter.activeHeartIndex}
                      currentHp={encounter.hearts[encounter.activeHeartIndex]?.health ?? 0}
                      totalHp={encounter.hearts[encounter.activeHeartIndex]?.maxHealth ?? 1}
                      maxHearts={encounter.hearts.length}
                      heartSize={24}
                    />
                    <span className="text-sm text-rpg-text-dim">{encounter.queuedProblems} queued</span>
                  </div>
                  <PlaceholderArt name="Boss" src={bossAssetUrl(encounter)} alt="Boss" />
                  <span className="font-pixel text-[11px] text-rpg-text-dim">BOSS</span>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Equipment & Stats panel */}
      <section className="rpg-box flex flex-col gap-3 p-4" aria-label="Equipment and stats">
        <div className="flex items-center justify-between border-b border-rpg-border pb-2">
          <h2 className="font-pixel text-xs text-rpg-text">EQUIPMENT &amp; STATS</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="grid grid-cols-2 gap-2">
            {EQUIPMENT_DISPLAY_CATEGORIES.map((category) => {
              const item = loadout[category];
              const imgSrc = assetForItem(item);
              return (
                <div key={category} className="rpg-slot flex h-24 flex-col items-center justify-between p-2 text-center">
                  <span className="font-pixel text-[10px] uppercase text-rpg-text-dim">{CATEGORY_LABELS[category]}</span>
                  {imgSrc ? (
                    <img src={imgSrc} alt={item?.name ?? CATEGORY_LABELS[category]} className="h-8 w-8 object-contain" />
                  ) : (
                    <span className="font-pixel text-xl text-rpg-border">—</span>
                  )}
                  <span className="text-sm text-rpg-text">{item?.name ?? 'None'}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col justify-center gap-1.5 rounded border border-rpg-border bg-rpg-slot/70 p-3">
            <StatRow label="Attack" value={stats.damage} valueClass="text-rose-400" />
            <StatRow label="Defence" value={stats.defense} valueClass="text-blue-300" />
            <div className="border-t border-rpg-border pt-1">
              <StatRow label="Hero Level" value={stats.level} valueClass="text-rpg-text" />
            </div>
            <span className="text-sm text-rpg-text-dim">Solved: {solvedCount}</span>
          </div>
        </div>
      </section>

    </div>
  );
}

function encounterLabel(encounter: GameState['encounter']): string {
  if (encounter.kind === 'boss') {
    return 'Boss Fight';
  }
  return 'Wilderness Encounter';
}

function StatRow({ label, value, valueClass }: { label: string; value: number; valueClass: string }) {
  return (
    <div className="flex items-center justify-between text-base">
      <span className="text-rpg-text-dim">{label}</span>
      <span className={`font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}
