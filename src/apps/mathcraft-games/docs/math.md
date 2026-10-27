# Math Domain

The math domain operates with a logic that is mostly independent of the game. In the future the math domain could be conditioned by input state and events to configure to the current game state or react to game-generated interactions. So far the math domain considers additions, subtractions, and multiplications, however it must be designed as generic enough to be able to implement other problems such as fractions or division (however these two are out of scope in this version).

All operations use a unified multi-digit model where single digit operations are a degenerated version which should not be handled separately or as an special case. All the logic must be valid for single or multi-digits. The student can configure the digit count for each operand independently (typically 1–4 digits) and, where applicable, whether generated steps may or may not require carrying or borrowing. The first digit of each operand must be non-zero; the result size is not separately constrained by the configuration.

The problem set includes the following operation types:

- **Addition:** the student configures the digit count for each operand independently and whether generated addition steps may or may not require carrying. "Allowed" means a generated problem may or may not include that carry step; "required" means every generated problem includes at least one carry step; "forbidden" means no step produces a carry.
- **Subtraction:** the student configures the digit count for each operand independently and whether generated subtraction steps may or may not require borrowing. "Allowed" means a generated problem may or may not include that borrow step; "required" means every generated problem includes at least one borrow step; "forbidden" means no step requires borrowing.
- **Multiplication:** the student configures operand digit counts and whether the single-digit multiplication steps require carrying. The same carry modes apply as for addition. The student can also select the factor range via `minFactor` and `maxFactor` which should apply for each digit of both operands.

For generation behavior, the specific probability distribution is intentionally out of scope for this task. Random generation is acceptable as long as every generated problem satisfies the selected configuration. To avoid confusing repeated work for students, consecutive problems must not repeat the exact same operands; for example, `2 x 4` followed by `2 x 4` is not allowed, while `2 x 4` followed by `4 x 2` is allowed because the operands are not identical in sequence.

## Step-by-step Entry

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

## Arithmetic Step Snapshots

An arithmetic step snapshot is the complete, renderable state of a problem at one point in its step-by-step solution. The math domain creates the snapshot, including every operand, regrouping, carry, partial product, and placed result. The presentation renders the supplied rows and operator lines; it does not calculate arithmetic, infer cell placement, or reconstruct work from step fields.

The student enters the expected value for the active step. A correct answer advances to the next snapshot, where the accepted result and all resulting carries or regrouping are already placed. An incorrect answer leaves the current snapshot unchanged.

```typescript
export type RowType = 'number' | 'carry';
export type OperationType = 'addition' | 'subtraction' | 'multiplication';

export type MatrixCell =
  | { kind: 'skip' }
  | { kind: 'empty'; active: boolean }
  | { kind: 'value'; value: number };

export interface OperatorLine {
  /** Zero-based index of the last matrix row above this operator line. */
  afterRow: number;
  operation: OperationType;
}

export interface ArithmeticStepSnapshot {
  /** Zero-based active step index; null when the problem is complete. */
  stepIndex: number | null;
  /** Semantic identity of the problem; does not control rendered signs. */
  problemOperation: OperationType;
  /** Operation class of the active calculation, used for math-event rules. */
  stepOperation: OperationType | null;
  /** Number of leading matrix rows that are the original problem operands. */
  operandCount: number;
  /** Full value the student must enter for this step; null when complete. */
  expected: number | null;
  /** Row kind for each matrix row, in the same order as problemMatrix. */
  rowTypes: readonly RowType[];
  /** Rectangular matrix, ordered top-to-bottom and most-significant-first. */
  problemMatrix: readonly (readonly MatrixCell[])[];
  /** Explicit operator/rule lines between matrix rows. */
  operatorLines: readonly OperatorLine[];
}
```

These fields describe different semantic scopes; neither is a rendering instruction:

- `problemOperation` identifies the overall problem, such as multiplication. It remains unchanged throughout that problem and is useful to domain logic that needs to classify the problem as a whole.
- `stepOperation` identifies the kind of calculation the student is currently answering. It is used by math-event rules, such as assigning different damage to multiplication steps and addition steps. It is `null` when there is no active step.
- `operatorLines` is the sole source for which signs or operation lines the view displays and where they appear. The view must not infer signs from either operation field.

For example, while solving `23 x 34`, `problemOperation` remains `multiplication`. Its primary `operatorLines` entry renders `x` between the operand rows, and another entry renders `+` before the partial-product sum. During the digit-by-digit products, `stepOperation` is `multiplication`; during the partial-product addition, it is `addition`. Thus `stepOperation` is not a display sign, and `operatorLines` do not determine math-event behavior.

The snapshot has no separate row or column counts. Its dimensions are the lengths of `rowTypes`, `problemMatrix`, and the matrix rows. `rowTypes.length` must equal `problemMatrix.length`; every row must have the same number of cells.

### Matrix Cells

- `skip` means the row has no cell at that place. A renderer may omit it or reserve its grid position, but must not treat it as zero.
- `empty` means the place is part of the work but has no value yet. `active: true` marks a place that will be populated when the current expected answer is accepted. A step may mark multiple cells active, such as a written value and its carry.
- `value` is an actual non-negative integer at that place. Zero is a value, not an empty cell. A value is not limited to one digit: `14` in the ones place means fourteen ones.

Columns run from most significant to least significant. Every row is aligned to the same place values. A cell value may be wider than one digit; the renderer controls how that value fits its cell. It must not split, normalize, or move the value to another column.

`number` rows use the normal number presentation. `carry` rows use the carry presentation. Carry rows are included only when the problem has a non-zero carry to show; their shape stays fixed across snapshots for that problem. Subtraction represents regrouping directly in the adjusted minuend row, so a borrow by itself does not require a separate carry row.

The first `operandCount` rows are exactly the original problem's operand rows and have type `number`. Current generated problems use two operands; the row contract permits a future problem to have more. The primary operator line follows those rows. Additional operator lines are explicit in `operatorLines`; for example, multi-digit multiplication has an addition line before the final sum. Operator lines do not count as matrix rows.

Carry rows are aligned with the destination place of each carry. Their row positions and cell values are part of the snapshot, and the row structure does not change between snapshots for the same problem. A carry row may be present before its values are revealed; cells without a carry are `skip` or `empty` as appropriate. The renderer may style and position the row above the number row whose calculation consumes those carries, but it does not calculate the association.

### Snapshot Progression

For an active snapshot with `stepIndex: N`:

- All steps with indexes less than N are resolved and their effects are represented in the matrix.
- The current step's required input is `expected`.
- The matrix marks the cell or cells to be populated by accepting this answer with `kind: 'empty'` and `active: true`.
- Later work remains empty or skipped as specified by the matrix.

When the answer is accepted, the next snapshot contains the entered result in its already-determined place, along with all resulting carries or regrouping. The presentation does not place the input or compute its effects. A wrong or invalid answer does not change the snapshot. `expected` is the answer-checking value; it is independent of the matrix representation, and the presentation does not validate consistency between them.

After the final step, the completed snapshot has `stepIndex: null`, `stepOperation: null`, and `expected: null`. Its matrix shows the complete answer and all review work. For subtraction, intermediate snapshots show the regrouped minuend; the completed snapshot restores the original operands while retaining the completed difference, as required by this document.

## Problem Types

### Addition

The matrix begins with one `number` row for each operand, followed by the result work. The primary operator line is addition and appears after the operand rows. A carry row, when needed, contains non-terminal carry values aligned with the places into which they carry. A carry produced by the final entered column is written directly into the leading place of the answer row; it is not duplicated in a carry row. The answer row contains the written values by place. The current step's active targets may include both the answer place and a carry place.

For example, in `23 + 19`, the ones step expects `12`. After it is accepted, the next snapshot has `2` in the answer's ones place and `1` in the carry row at the tens place. The tens step uses that carry; after it is accepted, the completed answer row contains `42`.

Addition supports an `operandCount` greater than two. Each operand has its own leading number row; the primary operator line follows all operand rows. The snapshot supplies the complete column state and expected input for each step.

### Subtraction

Subtraction has two original operand rows and a result row. The primary operator line is subtraction. Steps proceed from least-significant place to most-significant place.

Regrouping is reflected in the minuend row itself. When a step borrows, the next snapshot shows the reduced value in the source place and the increased value in the current place. A cell can therefore contain a value such as `14` in the ones place. Any chain of borrowing through zero places is fully reflected in the matrix; the renderer neither detects nor performs it.

For `94 - 49 = 45`, the snapshots progress as follows. Bracketed columns are most-significant-first; `[x]` is `skip`, `[ ]` is `empty`, `[n]` is `value(n)`, and `*` marks an active empty cell.

```text
Active step 0; expected 5
number  [9][4]
number  [4][9]
        - -----
number  [ ][ ]*

Active step 1; expected 4 (after step 0 is accepted)
number  [8][14]
number  [4][9]
        - -----
number  [ ]*[5]

Complete
number  [9][4]
number  [4][9]
        - -----
number  [4][5]
```

The intermediate minuend `[8][14]` records the regrouping: one ten was removed from the tens place and ten ones were added to the ones place. The completed snapshot restores `[9][4]` for review.

### Multiplication

The matrix begins with the two original operand rows and a multiplication operator line. A one-digit right operand has one final result row and does not need a separate partial-product row. If a multi-digit left operand produces a non-zero carry before its final digit step, that carry is shown in a carry row aligned with the destination column, where it is consumed by the next digit step. The carry row remains in the matrix throughout the problem. A carry from the final digit step is instead written into the leading place of the result row. The result can be wider than the operands, and the matrix includes the required leading place. For example, the active step for `3 x 9` expects `27`; when accepted, the result row contains `2` in the tens place and `7` in the ones place.

When the right operand has multiple digits, the work includes one shifted partial-product number row for each right-operand digit, ordered from least significant to most significant, followed by the final sum row. Carries passed between digit steps while calculating a partial product are represented by its associated carry row when any are non-zero. The final carry of a partial product is represented in that partial-product number row. Carries generated while adding the partial products are represented by a carry row associated with the final sum. The addition operator line before the final sum is present in `operatorLines`.

During active work, a partial product's carry-row values remain visible while that partial product is being calculated, then are cleared when the next partial product begins. All partial-product carry values are cleared while the final sum is active, so completed carries are not mistaken for inputs to later work. The completed review snapshot restores all carry values. Carry row positions remain fixed across every snapshot.

For `87 x 72 = 6264`, the completed matrix has four columns, aligned from thousands to ones:

```text
number  [x][x][8][7]
number  [x][x][7][2]
        x ---------
carry   [x][x][1][x]
number  [x][1][7][4]
carry   [x][4][x][x]
number  [6][0][9][0]
        + ---------
carry   [x][1][x][x]
number  [6][2][6][4]
```

The partial-product rows represent `174` and `609` shifted one place. Carry values are aligned with their destination places. A cell marked `skip` is not a value and contributes nothing to the displayed row; a zero digit inside a partial product, such as the tens digit in `609`, is `value(0)`. A place left unused by shifting a partial product is `skip`.

The number of rows depends on the right operand's digit count and on which carry rows are required by the problem. The matrix width is the number of aligned places needed by the complete work, including the final product. The snapshot supplies the exact dimensions, rows, cell values, and operator-line positions; the renderer does not calculate them.

#### Single-Digit and One-by-One Cases

Single-digit problems use the same snapshot contract and row rules as multi-digit problems. A one-digit product may need an additional leading place for its result as happened with any other multi-digit problem. The same as with the last digit operand in multi-digit problems, it does not need a separate carry row when no later digit step consumes a carry:

```text
Active step; expected 27
number  [x][3]
number  [x][9]
        x -----
number  [ ][ ]*

Complete
number  [x][3]
number  [x][9]
        x -----
number  [2][7]
```

For `1 x 1`, no extra place or carry row is needed:

```text
Active step; expected 1
number  [1]
number  [1]
        x ---
number  [ ]*

Complete
number  [1]
number  [1]
        x ---
number  [1]
```

However this is the same for any single product that results in 9 or less, so 1x1 is not realy a specia case. In multi-digit multiplication or additions, if the last digit operation also result in less than 9 the no extra digits are nedded in the results. The global rule for the number of columns in the matrix cell is the length of the result, for instance, 10x10 results in 100 so we only need tree columns, while 50x50 is 2500 and we need four. Neither the single digit or a 1x1 case should need special care aor handling.

### Presentation Boundary

The presentation receives an `ArithmeticStepSnapshot` and renders its matrix, row types, active cells, and operator lines. It may choose the visual treatment for skipped cells and the size or alignment of multi-digit cell values. It does not:

- calculate a carry, borrow, regrouping, partial product, or result;
- decide which place receives a student's input;
- assemble or shift operands, partial products, or the final answer;
- derive the expected answer from the matrix, or check matrix consistency;
- infer operator-line positions or carry-row positions from operation-specific rules.

The presentation may highlight resolved values in work rows to distinguish accepted work from the original operands. Carry rows retain their separate carry styling, and active empty cells retain their active-target styling.

Answer validation compares the student's submitted integer with `expected`. On a match, the math domain advances to the next snapshot; on a mismatch, it retains the current snapshot for retry.