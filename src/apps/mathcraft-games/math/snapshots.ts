import type { ArithmeticStepSnapshot, MatrixCell, OperationType, OperatorLine, RowType } from './common';

export interface ArithmeticCalculation {
  operation: OperationType;
  left: number;
  right: number;
  incomingCarry: number;
  result: number;
  carryOut: number;
  borrowOut: boolean;
}

export interface ArithmeticProblemData {
  operation: OperationType;
  left: number;
  right: number;
  result: number;
}

const skipped = (): MatrixCell => ({ kind: 'skip' });
const empty = (active = false): MatrixCell => ({ kind: 'empty', active });
const value = (value: number): MatrixCell => ({ kind: 'value', value });

function blankRow(columns: number): MatrixCell[] {
  return Array.from({ length: columns }, skipped);
}

function operandRow(operand: number, columns: number): MatrixCell[] {
  const digits = Array.from(String(operand), Number);
  const row = blankRow(columns);
  const padding = columns - digits.length;
  digits.forEach((digit, index) => {
    row[padding + index] = value(digit);
  });
  return row;
}

function writtenValue(step: ArithmeticCalculation): number {
  return step.operation === 'subtraction' ? step.result : step.result % 10;
}

function resultCell(step: ArithmeticCalculation, resolved: boolean, active: boolean): MatrixCell {
  return resolved ? value(writtenValue(step)) : empty(active);
}

function carryCell(step: ArithmeticCalculation, resolved: boolean, active: boolean): MatrixCell {
  if (step.carryOut === 0) return skipped();
  return resolved ? value(step.carryOut) : empty(active);
}

function makeSnapshot(
  problem: ArithmeticProblemData,
  steps: readonly ArithmeticCalculation[],
  index: number,
  rowTypes: RowType[],
  problemMatrix: MatrixCell[][],
  operatorLines: ArithmeticStepSnapshot['operatorLines'],
): ArithmeticStepSnapshot {
  const complete = index === steps.length;
  const activeStep = complete ? null : steps[index];
  return {
    stepIndex: complete ? null : index,
    problemOperation: problem.operation,
    stepOperation: activeStep?.operation ?? null,
    operandCount: 2,
    expected: activeStep?.result ?? null,
    rowTypes,
    problemMatrix,
    operatorLines,
  };
}

function buildAdditionSnapshots(
  problem: ArithmeticProblemData,
  steps: readonly ArithmeticCalculation[],
): ArithmeticStepSnapshot[] {
  const total = steps.length;
  const terminalCarry = steps[total - 1]?.carryOut ?? 0;
  const columns = Math.max(String(problem.left).length, String(problem.right).length) + (terminalCarry > 0 ? 1 : 0);
  const hasCarryRow = steps.slice(0, -1).some((step) => step.carryOut > 0);

  return Array.from({ length: total + 1 }, (_, resolvedCount) => {
    const rowTypes: RowType[] = ['number', 'number'];
    const rows: MatrixCell[][] = [operandRow(problem.left, columns), operandRow(problem.right, columns)];
    const operatorLines: ArithmeticStepSnapshot['operatorLines'] = [{ afterRow: 1, operation: 'addition' }];

    if (hasCarryRow) {
      const carryRow = blankRow(columns);
      for (let stepIndex = 0; stepIndex < total - 1; stepIndex += 1) {
        const step = steps[stepIndex];
        if (step.carryOut === 0) continue;
        const column = columns - 2 - stepIndex;
        carryRow[column] = carryCell(step, stepIndex < resolvedCount, stepIndex === resolvedCount);
      }
      rowTypes.push('carry');
      rows.push(carryRow);
    }

    const answerRow = blankRow(columns);
    for (let stepIndex = 0; stepIndex < total; stepIndex += 1) {
      const column = columns - 1 - stepIndex;
      answerRow[column] = resultCell(steps[stepIndex], stepIndex < resolvedCount, stepIndex === resolvedCount);
    }
    if (terminalCarry > 0) {
      answerRow[0] = resolvedCount === total ? value(terminalCarry) : empty(resolvedCount === total - 1);
    }
    rowTypes.push('number');
    rows.push(answerRow);

    return makeSnapshot(problem, steps, resolvedCount, rowTypes, rows, operatorLines);
  });
}

function adjustedMinuend(problem: ArithmeticProblemData, resolvedCount: number): number[] {
  const adjusted = Array.from(String(problem.left), Number).reverse();
  const subtrahend = Array.from(String(problem.right), Number).reverse();

  for (let column = 0; column < resolvedCount; column += 1) {
    if (adjusted[column] >= (subtrahend[column] ?? 0)) continue;
    let source = column + 1;
    while (adjusted[source] === 0) source += 1;
    adjusted[source] -= 1;
    for (let intermediate = source - 1; intermediate > column; intermediate -= 1) {
      adjusted[intermediate] = 9;
    }
    adjusted[column] += 10;
  }

  return adjusted;
}

function digitsAsCells(digitsLsdFirst: readonly number[], columns: number): MatrixCell[] {
  const row = blankRow(columns);
  digitsLsdFirst.forEach((digit, offset) => {
    const column = columns - 1 - offset;
    if (column >= 0) row[column] = value(digit);
  });
  return row;
}

function buildSubtractionSnapshots(
  problem: ArithmeticProblemData,
  steps: readonly ArithmeticCalculation[],
): ArithmeticStepSnapshot[] {
  const total = steps.length;
  const columns = Math.max(String(problem.left).length, String(problem.right).length);

  return Array.from({ length: total + 1 }, (_, resolvedCount) => {
    const complete = resolvedCount === total;
    const minuend = complete
      ? Array.from(String(problem.left), Number).reverse()
      : adjustedMinuend(problem, resolvedCount);
    const answer = blankRow(columns);
    for (let stepIndex = 0; stepIndex < total; stepIndex += 1) {
      const column = columns - 1 - stepIndex;
      answer[column] = resultCell(steps[stepIndex], stepIndex < resolvedCount, stepIndex === resolvedCount && !complete);
    }

    const rowTypes: RowType[] = ['number', 'number', 'number'];
    const rows = [
      digitsAsCells(minuend, columns),
      operandRow(problem.right, columns),
      answer,
    ];
    const operatorLines: ArithmeticStepSnapshot['operatorLines'] = [{ afterRow: 1, operation: 'subtraction' }];
    return makeSnapshot(problem, steps, resolvedCount, rowTypes, rows, operatorLines);
  });
}

function writeStep(
  row: MatrixCell[],
  step: ArithmeticCalculation,
  stepIndex: number,
  resolvedCount: number,
  column: number,
): void {
  if (column < 0 || column >= row.length) return;
  row[column] = resultCell(step, stepIndex < resolvedCount, stepIndex === resolvedCount);
}

function buildMultiplicationSnapshots(
  problem: ArithmeticProblemData,
  steps: readonly ArithmeticCalculation[],
): ArithmeticStepSnapshot[] {
  const total = steps.length;
  const leftLength = String(problem.left).length;
  const rightDigits = Array.from(String(problem.right), Number).reverse();
  const rightLength = rightDigits.length;
  const phaseACount = leftLength * rightLength;
  const columns = String(problem.result).length;
  const hasPartialProducts = rightLength > 1;
  const partialProductCarries = rightDigits.map((_, rowIndex) => {
    const firstStep = rowIndex * leftLength;
    return steps.slice(firstStep, firstStep + leftLength - 1).some((step) => step.carryOut > 0);
  });
  const sumSteps = steps.slice(phaseACount);
  const hasSumCarryRow = hasPartialProducts && sumSteps.slice(0, -1).some((step) => step.carryOut > 0);

  return Array.from({ length: total + 1 }, (_, resolvedCount) => {
    const rowTypes: RowType[] = ['number', 'number'];
    const rows: MatrixCell[][] = [operandRow(problem.left, columns), operandRow(problem.right, columns)];
    const operatorLines: OperatorLine[] = [{ afterRow: 1, operation: 'multiplication' }];
    const partialRows: { numberRow: number; carryRow: number | null }[] = [];

    if (hasPartialProducts) {
      for (let rightIndex = 0; rightIndex < rightLength; rightIndex += 1) {
        let carryRow: number | null = null;
        if (partialProductCarries[rightIndex]) {
          carryRow = rows.length;
          rowTypes.push('carry');
          rows.push(blankRow(columns));
        }
        const numberRow = rows.length;
        rowTypes.push('number');
        rows.push(blankRow(columns));
        partialRows.push({ numberRow, carryRow });
      }
      operatorLines.push({ afterRow: rows.length - 1, operation: 'addition' });
    }

    let sumCarryRow: number | null = null;
    if (hasSumCarryRow) {
      sumCarryRow = rows.length;
      rowTypes.push('carry');
      rows.push(blankRow(columns));
    }
    let singleProductCarryRow: number | null = null;
    if (!hasPartialProducts && steps.slice(0, leftLength - 1).some((step) => step.carryOut > 0)) {
      singleProductCarryRow = rows.length;
      rowTypes.push('carry');
      rows.push(blankRow(columns));
    }
    const answerRowIndex = rows.length;
    rowTypes.push('number');
    rows.push(blankRow(columns));

    if (hasPartialProducts) {
      for (let rightIndex = 0; rightIndex < rightLength; rightIndex += 1) {
        const { numberRow, carryRow } = partialRows[rightIndex];
        for (let leftIndex = 0; leftIndex < leftLength; leftIndex += 1) {
          const stepIndex = rightIndex * leftLength + leftIndex;
          const step = steps[stepIndex];
          const resultColumn = columns - 1 - (rightIndex + leftIndex);
          writeStep(rows[numberRow], step, stepIndex, resolvedCount, resultColumn);

          const partialProductIsActive = resolvedCount < (rightIndex + 1) * leftLength || resolvedCount === total;
          if (carryRow !== null && partialProductIsActive && leftIndex < leftLength - 1 && step.carryOut > 0) {
            const carryColumn = resultColumn - 1;
            rows[carryRow][carryColumn] = carryCell(step, stepIndex < resolvedCount, stepIndex === resolvedCount);
          }

          if (leftIndex === leftLength - 1 && step.carryOut > 0) {
            const terminalColumn = resultColumn - 1;
            rows[numberRow][terminalColumn] = stepIndex < resolvedCount
              ? value(step.carryOut)
              : empty(stepIndex === resolvedCount);
          }
        }
      }

      for (let sumIndex = 0; sumIndex < sumSteps.length; sumIndex += 1) {
        const stepIndex = phaseACount + sumIndex;
        const step = sumSteps[sumIndex];
        const resultColumn = columns - 1 - sumIndex;
        writeStep(rows[answerRowIndex], step, stepIndex, resolvedCount, resultColumn);
        if (sumCarryRow !== null && sumIndex < sumSteps.length - 1 && step.carryOut > 0) {
          rows[sumCarryRow][resultColumn - 1] = carryCell(step, stepIndex < resolvedCount, stepIndex === resolvedCount);
        }
        if (sumIndex === sumSteps.length - 1 && step.carryOut > 0) {
          const terminalColumn = resultColumn - 1;
          rows[answerRowIndex][terminalColumn] = stepIndex < resolvedCount
            ? value(step.carryOut)
            : empty(stepIndex === resolvedCount);
        }
      }
    } else {
      for (let leftIndex = 0; leftIndex < leftLength; leftIndex += 1) {
        const stepIndex = leftIndex;
        const step = steps[stepIndex];
        const resultColumn = columns - 1 - leftIndex;
        writeStep(rows[answerRowIndex], step, stepIndex, resolvedCount, resultColumn);
        if (singleProductCarryRow !== null && leftIndex < leftLength - 1 && step.carryOut > 0) {
          const carryColumn = resultColumn - 1;
          rows[singleProductCarryRow][carryColumn] = carryCell(step, stepIndex < resolvedCount, stepIndex === resolvedCount);
        }
        if (leftIndex === leftLength - 1 && step.carryOut > 0) {
          rows[answerRowIndex][resultColumn - 1] = stepIndex < resolvedCount
            ? value(step.carryOut)
            : empty(stepIndex === resolvedCount);
        }
      }
    }

    return makeSnapshot(problem, steps, resolvedCount, rowTypes, rows, operatorLines);
  });
}

export function buildArithmeticSnapshots(
  problem: ArithmeticProblemData,
  steps: readonly ArithmeticCalculation[],
): ArithmeticStepSnapshot[] {
  switch (problem.operation) {
    case 'addition':
      return buildAdditionSnapshots(problem, steps);
    case 'subtraction':
      return buildSubtractionSnapshots(problem, steps);
    case 'multiplication':
      return buildMultiplicationSnapshots(problem, steps);
  }
}