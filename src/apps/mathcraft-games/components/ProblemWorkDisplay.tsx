import type { ArithmeticStepSnapshot, MatrixCell, OperationType, RowType } from '../math/common';
import type { ProblemLifecycleState } from '../math/lifecycle';

// Renders the active operation and written work from the supplied snapshot.
// Matrix values, active targets, regrouping, and operator positions are owned
// by the math domain; this component only formats and styles those values.

interface ProblemWorkDisplayProps {
  lifecycle: ProblemLifecycleState;
}

const OPERATION_LABELS = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
} as const;

export function ProblemWorkDisplay({ lifecycle }: ProblemWorkDisplayProps) {
  const { snapshot, totalSteps } = lifecycle;
  const solved = snapshot.stepIndex === null;
  const linesAfterRow = new Map<number, ArithmeticStepSnapshot['operatorLines'][number][]>();
  for (const line of snapshot.operatorLines) {
    const lines = linesAfterRow.get(line.afterRow) ?? [];
    lines.push(line);
    linesAfterRow.set(line.afterRow, lines);
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-2 overflow-x-auto rounded-xl border border-panel-border bg-panel p-4">
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <span>{OPERATION_LABELS[snapshot.problemOperation]}</span>
        {!solved && (
          <span>
            Step {snapshot.stepIndex! + 1} of {totalSteps}
          </span>
        )}
      </div>

      <div className="inline-flex flex-col gap-0.5 font-mono text-xl">
        {snapshot.problemMatrix.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`}>
            <SnapshotRow
              cells={row}
              rowType={snapshot.rowTypes[rowIndex]}
              isFinalAnswer={solved && rowIndex === snapshot.problemMatrix.length - 1}
              highlightValues={snapshot.problemOperation === 'multiplication'
                && rowIndex >= snapshot.operandCount
                && snapshot.rowTypes[rowIndex] === 'number'}
            />
            {linesAfterRow.get(rowIndex)?.map((line, lineIndex) => (
              <OperatorLineView key={`operator-${rowIndex}-${lineIndex}`} operation={line.operation} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotRow({
  cells,
  rowType,
  isFinalAnswer,
  highlightValues,
}: {
  cells: readonly MatrixCell[];
  rowType: RowType;
  isFinalAnswer: boolean;
  highlightValues: boolean;
}) {
  return (
    <div className="flex items-end gap-1">
      <span className="w-6" aria-hidden />
      {cells.map((cell, i) => (
        <SnapshotCell key={i} cell={cell} rowType={rowType} isFinalAnswer={isFinalAnswer} highlightValues={highlightValues} />
      ))}
    </div>
  );
}

function SnapshotCell({
  cell,
  rowType,
  isFinalAnswer,
  highlightValues,
}: {
  cell: MatrixCell;
  rowType: RowType;
  isFinalAnswer: boolean;
  highlightValues: boolean;
}) {
  const isCarry = rowType === 'carry';
  const isSkip = cell.kind === 'skip';
  const isActive = cell.kind === 'empty' && cell.active;
  const digitText = cell.kind === 'value' ? String(cell.value) : isActive ? '·' : '';
  const valueSize = cell.kind === 'value' && String(cell.value).length > 1 ? 'text-sm' : 'text-xl';
  const cellStateClass = isSkip
    ? 'border-transparent bg-transparent text-transparent'
    : isActive
      ? 'border-neutral-400 bg-bg text-neutral-100'
      : cell.kind === 'value'
        ? isFinalAnswer || highlightValues
          ? 'border-green-500/60 bg-green-500/10 text-green-300'
          : isCarry
            ? 'border-amber-400/40 bg-amber-400/10 text-amber-400'
            : 'border-panel-border bg-panel text-neutral-200'
        : 'border-panel-border/40 bg-panel/40 text-neutral-600';

  return (
    <div className={`flex ${isCarry ? 'h-6' : 'h-8'} w-8 items-center justify-center`}>
      <span
        aria-hidden={isSkip}
        className={`flex ${isCarry ? 'h-5 text-xs' : 'h-8'} w-8 items-center justify-center rounded border ${valueSize} ${cellStateClass}`}
      >
        {digitText}
      </span>
    </div>
  );
}

function OperatorLineView({ operation }: { operation: OperationType }) {
  const symbol = operation === 'addition' ? '+' : operation === 'subtraction' ? '−' : '×';
  return (
    <div className="flex items-center gap-1" aria-hidden>
      <span className="w-6 text-center text-xl">{symbol}</span>
      <span className="flex-1 border-t border-neutral-500" />
    </div>
  );
}
