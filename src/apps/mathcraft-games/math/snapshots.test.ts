import { describe, expect, it } from 'vitest';
import type { MatrixCell, OperationType } from './common';
import { buildAdditionSteps } from './addition';
import { buildMultiplicationSteps } from './multiplication';
import { buildSubtractionSteps } from './subtraction';
import { buildArithmeticSnapshots, type ArithmeticCalculation, type ArithmeticProblemData } from './snapshots';

function problem(operation: OperationType, left: number, right: number): { data: ArithmeticProblemData; calculations: ArithmeticCalculation[] } {
  const steps = operation === 'addition'
    ? buildAdditionSteps(left, right)
    : operation === 'subtraction'
      ? buildSubtractionSteps(left, right)
      : buildMultiplicationSteps(left, right);
  const result = operation === 'addition'
    ? left + right
    : operation === 'subtraction'
      ? left - right
      : left * right;
  return { data: { operation, left, right, result }, calculations: steps };
}

function buildSnapshots(problemData: ReturnType<typeof problem>) {
  return buildArithmeticSnapshots(problemData.data, problemData.calculations);
}

function rowValues(cells: readonly MatrixCell[]): (number | '*' | 'x' | 'o')[] {
  return cells.map((cell) => {
    if (cell.kind === 'skip') return 'x';
    if (cell.kind === 'empty') return cell.active ? '*' : 'o';
    return cell.value;
  });
}

describe('arithmetic snapshots', () => {
  it('places intermediate and terminal addition carries in their destination rows', () => {
    const snapshots = buildSnapshots(problem('addition', 36, 97));

    expect(snapshots).toHaveLength(3);
    expect(snapshots[0].expected).toBe(13);
    expect(snapshots[0].rowTypes).toEqual(['number', 'number', 'carry', 'number']);
    expect(rowValues(snapshots[0].problemMatrix[2])).toEqual(['x', '*', 'x']);
    expect(rowValues(snapshots[0].problemMatrix[3])).toEqual(['o', 'o', '*']);

    expect(snapshots[1].expected).toBe(13);
    expect(rowValues(snapshots[1].problemMatrix[2])).toEqual(['x', 1, 'x']);
    expect(rowValues(snapshots[1].problemMatrix[3])).toEqual(['*', '*', 3]);

    expect(snapshots[2].stepIndex).toBeNull();
    expect(rowValues(snapshots[2].problemMatrix[3])).toEqual([1, 3, 3]);
  });

  it('shows subtraction regrouping only after the borrowing step is accepted', () => {
    const snapshots = buildSnapshots(problem('subtraction', 94, 49));

    expect(snapshots[0].expected).toBe(5);
    expect(rowValues(snapshots[0].problemMatrix[0])).toEqual([9, 4]);
    expect(rowValues(snapshots[1].problemMatrix[0])).toEqual([8, 14]);
    expect(rowValues(snapshots[1].problemMatrix[2])).toEqual(['*', 5]);
    expect(rowValues(snapshots[2].problemMatrix[0])).toEqual([9, 4]);
    expect(rowValues(snapshots[2].problemMatrix[2])).toEqual([4, 5]);
  });

  it('propagates subtraction borrowing through zero places', () => {
    const snapshots = buildSnapshots(problem('subtraction', 100, 1));
    expect(rowValues(snapshots[1].problemMatrix[0])).toEqual([0, 9, 10]);
    expect(snapshots[1].expected).toBe(9);
  });

  it('uses a multi-cell answer for one-digit multiplication without a carry row', () => {
    const snapshots = buildSnapshots(problem('multiplication', 3, 9));
    expect(snapshots[0].expected).toBe(27);
    expect(snapshots[0].rowTypes).toEqual(['number', 'number', 'number']);
    expect(rowValues(snapshots[1].problemMatrix[2])).toEqual([2, 7]);

    const oneTimesOne = buildSnapshots(problem('multiplication', 1, 1));
    expect(oneTimesOne[1].problemMatrix[2]).toHaveLength(1);
    expect(rowValues(oneTimesOne[1].problemMatrix[2])).toEqual([1]);
  });

  it('shows intermediate and terminal carries for multi-digit by one-digit multiplication', () => {
    const snapshots = buildSnapshots(problem('multiplication', 39, 3));

    expect(snapshots.map((snapshot) => snapshot.expected)).toEqual([27, 11, null]);
    expect(snapshots.every((snapshot) => snapshot.rowTypes.join(',') === 'number,number,carry,number')).toBe(true);
    expect(rowValues(snapshots[0].problemMatrix[2])).toEqual(['x', '*', 'x']);
    expect(rowValues(snapshots[0].problemMatrix[3])).toEqual(['o', 'o', '*']);
    expect(rowValues(snapshots[1].problemMatrix[2])).toEqual(['x', 2, 'x']);
    expect(rowValues(snapshots[1].problemMatrix[3])).toEqual(['*', '*', 7]);
    expect(rowValues(snapshots[2].problemMatrix[2])).toEqual(['x', 2, 'x']);
    expect(rowValues(snapshots[2].problemMatrix[3])).toEqual([1, 1, 7]);
  });

  it('does not add a carry row when one-digit multiplication has no interior carry', () => {
    const snapshots = buildSnapshots(problem('multiplication', 12, 3));

    expect(snapshots[0].rowTypes).toEqual(['number', 'number', 'number']);
    expect(rowValues(snapshots.at(-1)!.problemMatrix[2])).toEqual([3, 6]);
  });

  it('aligns shifted partial-product carries and final addition carries', () => {
    const snapshots = buildSnapshots(problem('multiplication', 87, 72));
    const complete = snapshots[snapshots.length - 1];
    const rows = complete.problemMatrix.map(rowValues);

    expect(rows).toContainEqual(['x', 'x', 1, 'x']);
    expect(rows).toContainEqual(['x', 4, 'x', 'x']);
    expect(rows).toContainEqual([6, 0, 9, 'x']);
    expect(rows).toContainEqual(['x', 1, 'x', 'x']);
    expect(rows.at(-1)).toEqual([6, 2, 6, 4]);
    expect(complete.operatorLines).toEqual([
      { afterRow: 1, operation: 'multiplication' },
      { afterRow: 5, operation: 'addition' },
    ]);
  });

  it('clears completed partial-product carries when the next operation begins', () => {
    const snapshots = buildSnapshots(problem('multiplication', 87, 72));
    const firstPartialProductCarryRow = 2;
    const firstPartialProductRow = 3;
    const secondPartialProductCarryRow = 4;
    const phaseBStart = 4;

    expect(rowValues(snapshots[1].problemMatrix[firstPartialProductCarryRow])).toEqual(['x', 'x', 1, 'x']);
    expect(rowValues(snapshots[2].problemMatrix[firstPartialProductCarryRow])).toEqual(['x', 'x', 'x', 'x']);
    expect(rowValues(snapshots[2].problemMatrix[firstPartialProductRow])).toEqual(['x', 1, 7, 4]);
    expect(rowValues(snapshots[3].problemMatrix[secondPartialProductCarryRow])).toEqual(['x', 4, 'x', 'x']);
    expect(rowValues(snapshots[phaseBStart].problemMatrix[firstPartialProductCarryRow])).toEqual(['x', 'x', 'x', 'x']);
    expect(rowValues(snapshots[phaseBStart].problemMatrix[secondPartialProductCarryRow])).toEqual(['x', 'x', 'x', 'x']);
  });

  it('aligns the complete product without adding a spurious leading place', () => {
    const snapshots = buildSnapshots(problem('multiplication', 31, 66));
    const complete = snapshots[snapshots.length - 1];
    expect(complete.problemMatrix.at(-1)?.map((cell) => cell.kind === 'value' ? cell.value : null)).toEqual([2, 0, 4, 6]);
    expect(complete.problemMatrix[0]).toHaveLength(4);
  });

  it('does not place a carry in the ones place', () => {
    const snapshots = buildSnapshots(problem('multiplication', 32, 65));
    const complete = snapshots[snapshots.length - 1];
    complete.rowTypes.forEach((rowType, rowIndex) => {
      if (rowType === 'carry') {
        expect(complete.problemMatrix[rowIndex].at(-1)?.kind).not.toBe('value');
      }
    });
  });
});