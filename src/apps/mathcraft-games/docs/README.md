# Mathcraft Games

## Purpose

Mathcraft Games is a math-practice game for young students, especially students working at approximately the second- through fourth-grade level. It combines written arithmetic practice with a light Minecraft-inspired role-playing game. The game should make practice engaging without making individual questions stressful or allowing a student to move on without correcting a mistake.

The experience has two independent domains:

- The **math domain** selects and presents problems, tracks each operation step, validates student input, and reports math events.
- The **game domain** presents the hero, enemies, health, rewards, and combat response. It reacts to generic math events and does not need to know which operation or problem was solved.

The math domain determines the amount of damage associated with each step. The game domain applies that amount. Equipment, displayed stats, and level are progression and presentation; they do not change problem generation, answer checking, or combat outcomes.

## Learning Experience

There is no countdown for an individual problem. A student may take the time needed to work through it. A wrong answer does not advance the problem or discard the current problem: the student can see the mistake and try that same step again. The student must complete the steps correctly to solve the problem and move forward.

The game provides a visual response to the work. Correct steps damage an enemy immediately; incorrect steps damage the hero. Completing a problem emits a separate solved event. These events let the math experience and game experience remain decoupled while sharing a clear interaction contract.

## Math Problems

The problem set includes the following operation types:

- **Single-digit addition:** problems may be unrestricted or constrained by a maximum result. Single-digit operands use the range 1–9; zero is never an operand. “Unrestricted” means any valid single-digit operand pair that satisfies the operation and result constraints.
- **Single-digit subtraction:** problems may be unrestricted or constrained by a maximum difference. Single-digit operands use the range 1–9; zero is never an operand, and subtraction is always non-negative.
- **Single-digit multiplication:** the student can select the number range. Single-digit operands use the range 1–9; zero is never an operand.
- **Multi-digit addition:** the student can configure the digit count for each operand independently and whether generated addition steps may or may not require carrying. The first digit of each operand must be non-zero; the result size is not separately constrained by the configuration.
- **Multi-digit subtraction:** the student can configure the digit count for each operand independently and whether generated subtraction steps may or may not require borrowing. The first digit of each operand must be non-zero; the result size is not separately constrained by the configuration.
- **Multi-digit multiplication:** the student can configure operand digit counts and whether the single-digit multiplication steps require carrying. “Allowed” means a generated problem may or may not include that carry/borrow step; “required” means every generated problem includes at least one such step. This constraint applies only to the main multiplication steps, not the final addition of partial products. “Without carry” means each single-digit multiplication result is less than ten; it does not disable carrying when the partial products are added together.

A session may enable or disable each problem type independently. Selecting a grade applies the following default problem configurations; the student or supervising adult can adjust the enabled problem types and their available settings for the session:

| Grade | Default problem configuration |
| --- | --- |
| 2nd | Single-digit addition and subtraction, with a maximum result or difference of 20. |
| 3rd | Single-digit multiplication with factors in the range 1–5; multi-digit addition and subtraction with up to 3-digit operands, with carrying and borrowing allowed. |
| 4th | Single-digit multiplication with factors in the range 1–12; multi-digit addition and subtraction with up to 4-digit operands; multi-digit multiplication with up to 2-digit by 1-digit operands. |

For generation behavior, the specific probability distribution is intentionally out of scope for this task. Random generation is acceptable as long as every generated problem satisfies the selected configuration. To avoid confusing repeated work for students, consecutive problems must not repeat the exact same operands; for example, `2 x 4` followed by `2 x 4` is not allowed, while `2 x 4` followed by `4 x 2` is allowed because the operands are not identical in sequence.

### Step-by-step Entry

For a multi-step problem, the student enters the full result of the next arithmetic operation, not only the digit that will be written in the answer row. For example, when the next operation is `3 x 4`, the expected input is `12`. The math experience places the `2` in the appropriate place value and carries the `1` automatically. The student is responsible for entering every operation step, including each multiplication and each addition of partial products.

For example, solving `23 x 34` involves the following student-entered operation results:

```text
23 x 34

3 x 4       = 12  (write 2; carry 1)
2 x 4 + 1   = 9
3 x 3       = 9
2 x 3       = 6

92 + 690
2 + 0       = 2
9 + 9       = 18  (write 8; carry 1)
6 + 1       = 7

Result: 782
```

The math domain supplies a complete work snapshot for the current step. It specifies the operand, carry, partial-product, and result rows; each cell's place-value content and active state; and the position and operation of every operator line. Carries are aligned to their destination place in carry rows; the presentation may render those rows above the number row they apply to. Values may contain more than one digit, including a regrouped value such as `14` in the ones place. The presentation renders this supplied work without calculating or repositioning values. For subtraction, intermediate snapshots show regrouping; the completed snapshot restores the original operands so the student can review the complete problem and result.

After a correct step, the math domain advances to the next snapshot, which already contains the accepted result in its correct place and reflects any resulting carry or regrouping. The presentation does not decide where to place the entered value. A wrong answer is highlighted in red briefly, then discarded; the same snapshot remains active and can be retried. Wrong answers do not cancel the problem or prevent a later correct answer.

When the final step is correct, the completed answer is highlighted in green. The completed answer triggers the game’s combat presentation, including the enemy-defeat animation when appropriate. The **Next** control becomes available after that presentation, allowing the student to review the completed work before advancing to the next problem or enemy.

See the document `arithmetic-steps.md` for more detail on the steps interfaces.

## Math-to-Game Events

The math domain reports the total correct-hit damage budget for a problem so the game can initialize the corresponding regular enemy. Each accepted correct step then emits a `hit` event immediately. Each incorrect attempt also emits a `hit` event, but with a wrong outcome. A `solved` event is emitted after all steps in the current problem have been answered correctly. The domains communicate asynchronously through an internal event bus; the transport may use an RxJS `Subject` or `EventTarget`.

A hit event has this conceptual shape:

```json
{
	"event": "hit",
	"outcome": "correct",
	"value": 2
}
```

`outcome` is either `correct` or `wrong`. `value` is a positive integer damage amount. For a correct outcome, the game subtracts `value` from the enemy’s health. For a wrong outcome, it subtracts `value` from the hero’s health. The math domain assigns damage according to this matrix:

| Problem step | Correct hit value | Wrong hit value |
| --- | ---: | ---: |
| Single-digit addition or subtraction | 1 HP | 1 HP |
| Single-digit multiplication | 2 HP | 1 HP |
| Multi-digit addition or subtraction | 1 HP | 1 HP |
| Multi-digit multiplication step | 2 HP | 1 HP |
| Partial-product addition step in multiplication | 1 HP | 1 HP |

The math domain may define other damage values for future special outcomes, such as critical hits or misses, while the game continues to apply the event value without operation-specific logic.

The solved event identifies the completed problem and its step count:

```json
{
	"event": "solved",
	"problemId": "uuid-v4-string",
	"totalSteps": 4
}
```

It is emitted once after all arithmetic steps are completed correctly. It triggers a 1 HP hero heal and advances combat state. The game reacts to event outcome and value without needing the operation, operands, expected answer, or problem type.

Boss encounters use these game events:

```json
{
	"event": "boss_start",
	"queuedProblems": 3
}
```

```json
{
	"event": "boss_end"
}
```

`boss_start` begins the three-problem boss encounter. `boss_end` indicates that the boss has been defeated.

## Hero, Enemies, and Combat

The student selects one of three hero skins. The hero has a maximum health of 12 HP. The interface shows current and maximum health, including a heart/fill representation.

- A wrong hit damages the hero by the hit event’s `value`.
- A correct hit damages the current enemy by the hit event’s `value`.
- Health at zero or less means the hero is defeated; the game must not require health to equal exactly zero.
- Every `solved` event heals the hero by 1 HP, including solved problems during a boss fight.
- A regular enemy is associated with a math problem. Its health budget matches the total correct-hit damage budget for that problem. Correct steps reduce its health as they are completed, and solving the problem completes the encounter.

The game has no additional combat calculation. Enemy damage, hero damage, healing, and boss progress follow the event rules above. Enemy appearance or type may reflect the configured difficulty, but it does not alter the math/game event contract.

### Defeat and Respawn

When the hero is defeated, the student may either end the session or respawn. Respawn is unlimited and restores the hero to two-thirds of maximum health, rounded down: `floor((2 / 3) x 12) = 8 HP`. Respawning preserves the current encounter. During a boss fight, it also preserves the active boss heart, the remaining queued boss problems, and all accepted work on the active problem. Ending the session stops play and leads to the session summary.

## Boss Encounters

A boss appears every five minutes of active session time. The session timer pauses during a boss fight and resumes after the boss is defeated. A boss also appears when the session timer expires, including for sessions shorter than five minutes.

The student finishes the active problem before a due boss appears. For a scheduled five-minute boss, the session timer continues while the student finishes that problem; it pauses when the boss fight begins. If the timer expires during an active problem, the student completes that problem and emits its `solved` event before the session-ending boss appears. The same rule applies to scheduled boss triggers. After the session-ending boss is defeated, the session summary is shown.

Each boss has three hearts and requires three solved problems to defeat. When a boss becomes due, the math domain prepares the next three problems as a queue. Each queued problem corresponds to one boss heart, and its correct-hit damage budget supplies that heart’s health. Correct hit events damage the current heart; the solved event completes that heart’s problem and advances the fight to the next queued problem/heart. The game does not need to know the queued problems’ operations. Starting and ending the encounter are communicated using `boss_start` and `boss_end` events.

Boss triggers that occur while one boss is already pending are coalesced into a single pending boss rather than stacked as overlapping encounters. If a scheduled five-minute trigger coincides with session expiration, it is one boss encounter, not two. The reward timer continues during boss fights; a reward that becomes due while a problem is in progress is offered when that problem is solved.

## Equipment and Progression

The hero display has three equipment slots:

- Hand weapon
- Armor
- Bow

Every 30 seconds, the student is offered a choice of one hand weapon or one bow. Five minutes of reward-clock time provides 10 reward opportunities. The reward clock pauses during manual and idle pauses, but continues during boss fights. If a reward becomes due while a problem is unsolved, it is offered as soon as the problem is solved; if it becomes due during solved review, it is offered immediately. Multiple expirations during one unsolved problem coalesce into one offer. Item tiers continue to progress with completed-problem count, and early offers use the first tier.

Equipment tier scales with math level, defined as the number of completed problems. Items display the following stats:

| Category | Tier | Displayed stat range |
| --- | --- | ---: |
| Hand weapon | Wooden Sword | Atk 1–3 |
| Hand weapon | Iron Sword | Atk 4–7 |
| Hand weapon | Diamond Sword | Atk 8–12 |
| Bow | Wooden Bow | Atk 1–3 |
| Bow | Crossbow | Atk 4–7 |
| Bow | Enchanted Bow | Atk 8–12 |
| Armor | Leather Armor | Def 1–3 |
| Armor | Chainmail | Def 4–7 |
| Armor | Diamond Armor | Def 8–12 |

The displayed damage stat is the average of the hand-weapon and bow stats. The displayed defense stat comes from armor. The displayed hero level is:

```text
(displayed damage + displayed defense) x math level
```

These values, equipment, and level are decorative progression only. They do not affect health damage, enemy health, math difficulty, or answer validation.

## Session Flow and Controls

Before play, the student can configure the session duration and problem selection. The available session durations are 2, 5, and 10 minutes. Problem settings are retained for the current session and discarded when the page is refreshed.

The session timer measures active session time, not time spent fighting bosses or explicitly paused. Boss checkpoints are based on elapsed active session time. If a boss checkpoint and session expiration coincide, one boss is shown. For example, an 11-minute session has boss triggers at 5, 10, and 11 minutes; the final trigger is the session-ending boss. If a trigger becomes due while a problem is active, the current problem is completed before the boss appears.

There is no per-question timeout. If there is no student input for one minute during an active session, the timer pauses and the interface displays **Still There**. The student’s current problem and accepted work are preserved while paused. A manual pause control is also available and likewise preserves the current problem and work. A finish/end-session control lets the student stop early.

At the end of a session, the student sees a summary displaying:

- Total questions attempted and total questions completed.
- Step-level accuracy percentage.
- Total damage dealt to enemies and bosses.
- Total active session time.
- Bosses defeated and equipment earned.

## Problem Setup Interface

Problem setup presents the supported problem types as an easy-to-scan set of controls. Each type has an enable switch and only the configuration relevant to that type. Configuration uses selectable number ranges, digit-count controls, and carry/borrow options as appropriate. Multi-digit operations allow the student or supervising adult to set the digit counts for the operands. These choices apply for the current session only.

## Remaining Content Rule

Equipment tiers scale with the number of completed problems, but the problem-count thresholds for changing from one tier to the next are not specified. Equipment remains decorative and does not affect combat or math behavior.
