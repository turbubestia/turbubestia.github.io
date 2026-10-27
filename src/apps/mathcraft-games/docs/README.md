# Mathcraft Games

## Purpose

Mathcraft Games is a math-practice game for young students, especially students working at approximately the second- through fourth-grade level. It combines written arithmetic practice with a light Minecraft-inspired role-playing game. The game should make practice engaging without making individual questions stressful or allowing a student to move on without correcting a mistake.

The experience has two independent domains:

- The **math domain** selects and presents problems, tracks each operation step, validates student input, and reports math events.
- The **game domain** presents the hero, enemies, health, rewards, and combat response. It reacts to generic math events and does not need to know which operation or problem was solved.

The math domain determines the amount of damage associated with each step. The game domain applies that amount. Equipment, displayed stats, and level are progression and presentation; they do not change problem generation, answer checking, or combat outcomes. We can think of the math domain of the input controller to the game domain. The game instead of listening to a gamepad it listen to the math events. It would be up to the game how to interpret them, but it is essentially that.

## Learning Experience

There is no countdown for an individual problem. A student may take the time needed to work through it. A wrong answer does not advance the problem or discard the current problem: the student can see the mistake and try that same step again. The student must complete the steps correctly to solve the problem and move forward.

The game provides a visual response to the work. Correct steps damage an enemy immediately; incorrect steps damage the hero. Completing a problem emits a separate solved event that can spawn a new mob or progress the steps of a boss. These events let the math experience and game experience remain decoupled while sharing a clear interaction contract.

## Math Domain

All problem types share a unified multi-digit model: single-digit problems are the 1×1 case of their respective operation, not a separate category. Addition, subtraction, and multiplication follow the same step-by-step entry pattern — the student enters the full result of each arithmetic operation, the math domain validates it against `expected`, and the snapshot advances on a match or retries on a mismatch. Each problem is decomposed into ordered steps represented by `ArithmeticStepSnapshot` instances; every step emits a `hit` event (correct or wrong) and the final correct step emits a `solved` event. Configuration controls digit counts per operand and carry/borrow constraints, but the snapshot contract, answer validation, and event emission are identical across all operations and digit counts. See `math.md` for the full snapshot contract, operation layouts, and presentation boundary.

## Game Domain

The game domain reacts to generic math events (`hit`, `solved`) without knowing which operation or problem was solved. Correct hits damage enemies; wrong hits damage the hero. Each solved problem heals the hero by 1 HP. Regular enemy health is initialised from the problem's correct-hit damage budget, so the enemy is always defeated exactly when its health reaches zero — the game domain determines defeat independently of the `solved` event. Boss encounters use three queued problems whose damage budgets set three heart health values. Equipment and level are decorative progression that do not influence math logic or combat outcomes. Melee and ranged weapons affect the hero's weapon inventory, while armor sets directly change the hero's visual appearance. See `game.md` for defeat/respawn rules, boss encounter flow, and equipment tiers.

## Event between Math and Game

The math domain supports three basic events: hit target (correct input), hit wrong (incorrect input), and solved (problem solved). These are the inputs of the game logic. Currently we don't have state input to the math logic, but in the future and if required we could add an input state to a new problem generator or input events that can make the game influence the math logic.

The game domain determines when a regular enemy is defeated based on health reaching zero or below — it does not wait for the `solved` event to declare defeat. The `solved` event is always emitted by the math domain after all arithmetic steps are completed correctly, but the game domain applies it independently: it triggers the 1 HP hero heal and advances combat state (next problem spawn). This keeps the domains properly decoupled — the math domain reports completion, while the game domain manages encounter state. Since a problem can only be solved by correct answers, after all correct `hit` events are emitted the enemy's health will have reached zero exactly when the `solved` event arrives.

A hit event has this conceptual shape:

```json
{
	"event": "hit",
	"outcome": "correct",
	"value": 2
}
```

`outcome` is either `correct` or `wrong`. `value` is a positive integer damage amount. For a correct outcome, the game subtracts `value` from the enemy’s health. For a wrong outcome, it subtracts `value` from the hero’s health. The math domain may define other damage values for future special outcomes, such as critical hits or misses, while the game continues to apply the event value without operation-specific logic.

The solved event identifies the completed problem and its step count:

```json
{
	"event": "solved",
	"problemId": "uuid-v4-string",
	"totalSteps": 4
}
```

It is emitted once after all arithmetic steps are completed correctly. It triggers a 1 HP hero heal and advances combat state. The game reacts to event outcome and value without needing the operation, operands, expected answer, or problem type.

Boss encounters are managed entirely by the game domain and the session coordinator. The math domain does not emit boss events; it only produces `hit` and `solved` events regardless of context. When a boss checkpoint is reached, the session coordinator generates three problems (one per boss heart) from the enabled configs, reads each problem's correct-hit damage budget to initialise the hearts' health, and then starts the encounter by calling the game domain directly. Each solved boss problem damages the current heart; when all three are solved the coordinator calls the game domain to end the encounter and award the defeat. The game domain tracks heart state, the active-heart index, and the remaining queue — the math domain remains unaware of bosses entirely.

## Session Flow and Controls

Before play, the student can configure the session duration and problem selection. The available session durations are 2, 5, and 10 minutes. Problem settings are retained for the current session and discarded when the page is refreshed.

The session timer measures active session time on regular mobs, not time spent fighting bosses or explicitly paused. Boss checkpoints are based on elapsed active session time. Two timers operate independently during gameplay: the **session timer** drives boss triggers and session expiry (it pauses during boss fights), while the **reward timer** drives equipment offers (it continues during boss fights). If a boss checkpoint and session expiration coincide, one boss is shown. For example, an 11-minute session has boss triggers at 5, 10, and 11 minutes; the final trigger is the session-ending boss. If a trigger becomes due while a problem is active, the current problem is completed before the boss appears.

There is no per-question timeout. If there is no student input for one minute during an active session, the timer pauses and the interface displays **Still There**. The student’s current problem and accepted work are preserved while paused. A manual pause control is also available and likewise preserves the current problem and work. A finish/end-session control lets the student stop early.

At the end of a session, the student sees a summary displaying:

- Total questions attempted and total questions completed.
- Step-level accuracy percentage.
- Total damage dealt to enemies and bosses.
- Total active session time.
- Bosses defeated and equipment earned.

When the game logic reports the hero was defeated, a overlay is shown to allow respawn or exit the session. This overlay only pause the session timer while keeping the game and math state intact. Only on session exit the game is cleared by the proper logic.

## Problem Setup Interface

Problem setup presents the supported problem types as an easy-to-scan set of controls. Each type has an enable switch and only the configuration relevant to that type. Configuration uses selectable number ranges, digit-count controls, and carry/borrow options as appropriate. Multi-digit operations allow the student or supervising adult to set the digit counts for the operands. These choices apply for the current session only.
