# Game Domain

The game domain mimics an RPG hero with inventory against a single enemy. When the student selects the Mathcraft app from the apps registry, the session coordinator presents the session setup. The student then selects one of three hero skins after pressing the start button. After the skin selection (which is either Alex or Steve in leather armor set), the actual Mathcraft game begins. 

# Basic Game Logic

The hero has a maximum health of 12 HP while enemies will have hit points matching the total correct-hit damage budget for the current math problem. The game does not need to know the problem; the session coordinator sets this value when spawning a new enemy.

The inputs for the game domain comes from the math domain through the session coordinator (or game controller). It react to two event types: `hit` and `solved`.
- A wrong hit (`hit` event with outcome `wrong`) damages the hero by the hit event’s `value`.
- A correct hit (`hit` event with outcome `correct`) damages the current enemy by the hit event’s `value`.
- Health at zero or less means the hero is defeated; the game must not require health to equal exactly zero.
- Every `solved` event heals the hero by 1 HP, including solved problems during a boss fight.
- A regular enemy is associated with a math problem. Its health budget matches the total correct-hit damage budget for that problem. Correct steps reduce its health as they are completed. The game domain determines when the enemy is defeated based on health reaching zero or below — it does not wait for the `solved` event to declare defeat.

The `solved` event is always emitted by the math domain after all arithmetic steps are completed correctly, but the game domain applies it independently: it triggers the 1 HP hero heal and advances combat state (next problem spawn). This keeps the domains properly decoupled — the math domain reports completion, while the game domain manages encounter state.

The game has no additional combat calculation. Enemy damage, hero damage, healing, and boss progress follow the event rules above. Enemy appearance or type may reflect the configured difficulty, but it does not alter the math/game event contract.

### Defeat and Respawn

When the hero is defeated, the student may either end the session or respawn. Respawn is unlimited and restores the hero to two-thirds of maximum health, rounded down: `floor((2 / 3) x 12) = 8 HP`. Respawning preserves the current encounter. During a boss fight, it also preserves the active boss heart, the remaining queued boss problems, and all accepted work on the active problem. Ending the session stops play and leads to the session summary. From this point of view, defeat is a decoration.

## Boss Encounters

A boss appears every five minutes of active session time. The session timer pauses during a boss fight and resumes after the boss is defeated. A boss also appears when the session timer expires, including for sessions shorter than five minutes.

The student finishes the active problem before a due boss appears. For a scheduled five-minute boss, the session timer continues while the student finishes that problem; it pauses when the boss fight begins. If the timer expires during an active problem, the student completes that problem and emits its `solved` event before the session-ending boss appears. The same rule applies to scheduled boss triggers. After the session-ending boss is defeated, the session summary is shown.

Each boss has three hearts and requires three solved problems to defeat. When a boss becomes due, the game controller prepares the next three problems as a queue. Each queued problem corresponds to one boss heart, and its correct-hit damage budget supplies that heart’s health. Correct hit events damage the current heart; the solved event completes that heart’s problem and advances the fight to the next queued problem/heart. The game does not need to know the queued problems’ operations. Starting and ending the encounter are manage by the session coordinator.

Boss triggers that occur while one boss is already pending are coalesced into a single pending boss rather than stacked as overlapping encounters. If a scheduled five-minute trigger coincides with session expiration, it is one boss encounter, not two. Two timers operate independently during gameplay: the **session timer** drives boss triggers and session expiry (it pauses during boss fights), while the **reward timer** drives equipment offers (it continues during boss fights). A reward that becomes due while a problem is in progress is offered when that problem is solved.

Regular mobs and bosses use different hit point mechanics. A boss has three hearts of life, each with a health budget matching one of the three math problems scheduled by the session coordinator. The same boss visual persists across all three hearts. This is handled by the coordinator through distinct spawn methods for regular mobs and bosses. The math domain must not hold any special logic for bosses — it is the coordinator's responsibility to spawn the right enemy type, and the game controller keeps track of regular mob or boss state.

## Equipment and Progression

The hero display has three equipment slots:

- Melee weapon
- Armor set
- Ranged weapon

Every 30 seconds, the student is offered a choice of one melee weapon, one armor set, or one ranged weapon. Five minutes of reward-clock time provides 10 reward opportunities. The reward clock pauses during manual and idle pauses, but continues during boss fights. If a reward becomes due while a problem is unsolved, it is offered as soon as the problem is solved; if it becomes due during solved review, it is offered immediately. Multiple expirations during one unsolved problem coalesce into one offer. Item tiers continue to progress with completed-problem count, and early offers use the first tier.

Equipment tier scales with math level, which for fairness and a better student experience can be matched to the session duration. For instance, if melee weapons have tiers from 1 to 6 and a 5-minute session, we can linearly match tier 1 to 0 min and tier 6 to 5 min, always allowing the best gear for the last boss fight. In a 10-minute session it would map tier 1 to 0 min and tier 6 to 10 min.

The displayed damage stat is the average of the hand-weapon and bow stats. The displayed defense stat comes from the armor set. The displayed hero level is:

```text
(displayed damage + displayed defense) x number of problem solved
```

These values, equipment, and level are decorative progression only. They do not affect health damage, enemy health, math difficulty, or answer validation.

Both melee and ranged weapons affect the state of the hero's current weapon inventory, while the armor set affects directly the selected hero image, not an armor set in the inventory. So if the hero is rewarded a chainmail armor, the hero character will be drawn with that armor set image.

## Screen layout

The game layout needs to look modern and attractive in a dark-theme color scheme. The representation is as follow:

```
            [melee weapon] [ranged weapon]
            [large SVG heart] C_HP/T_HP       [large SVG heart/s] C_HP/T_HP
    [Atk]              
    [value]
    [Def]
    [Value]            [hero]                           [enemy]
    [Level]
    [Value]
```

Where the fill level from bottom to top represents the remaining hit point along with a number of current hit point vs the total, for instance 7/12 means 7 HP remaining. For a regular mob it will have a single heart, but a boss will have three hearts and the counter C_HP/T_HP will be respected to the current affected one.