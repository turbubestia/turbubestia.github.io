import { describe, expect, it } from 'vitest';
import type { ProblemConfig } from './common';
import {
  GRADE_PRESETS,
  generateProblem,
  getGradePreset,
  validateProblemConfig,
  verifyProblem,
  createSeededRandom,
} from './index';

describe('math barrel (grade presets + verification)', () => {
  it('matches grade 2 defaults', () => {
    const preset = getGradePreset(2);
    expect(preset.name).toBe('Grade 2');
    expect(preset.enabled).toEqual([
      { operation: 'addition', leftDigits: 1, rightDigits: 1, maxResult: 20 },
      { operation: 'subtraction', leftDigits: 1, rightDigits: 1, maxDifference: 20 },
    ]);
  });

  it('matches grade 3 and 4 defaults', () => {
    const grade3 = getGradePreset(3);
    const grade4 = getGradePreset(4);

    expect(grade3.enabled).toHaveLength(3);
    expect(grade4.enabled).toHaveLength(4);
    expect(grade3.enabled[0]).toMatchObject({ operation: 'multiplication', minFactor: 1, maxFactor: 5 });
    expect(grade4.enabled[0]).toMatchObject({ operation: 'multiplication', minFactor: 1, maxFactor: 12 });
    expect(grade3.enabled[1]).toMatchObject({ operation: 'addition', leftDigits: 3, rightDigits: 3 });
    expect(grade4.enabled[3]).toMatchObject({ operation: 'multiplication', leftDigits: 2, rightDigits: 1 });
  });

  it('keeps grade presets available through the exported record', () => {
    expect(GRADE_PRESETS[2].name).toBe('Grade 2');
    expect(GRADE_PRESETS[3].name).toBe('Grade 3');
    expect(GRADE_PRESETS[4].name).toBe('Grade 4');
  });

  it('rejects invalid configs before generation', () => {
    expect(validateProblemConfig({ operation: 'addition', leftDigits: 0, rightDigits: 2 })).toMatchObject({ ok: false });
    expect(validateProblemConfig({ operation: 'multiplication', leftDigits: 1, rightDigits: 1, minFactor: 3, maxFactor: 2 })).toMatchObject({ ok: false });
    expect(validateProblemConfig({ operation: 'subtraction', leftDigits: 0, rightDigits: 2 })).toMatchObject({ ok: false });
  });

  it('generates valid arithmetic for all supported operation families', () => {
    const scenarios: ProblemConfig[] = [
      { operation: 'addition', leftDigits: 1, rightDigits: 1, maxResult: 20 },
      { operation: 'subtraction', leftDigits: 1, rightDigits: 1, maxDifference: 20 },
      { operation: 'multiplication', leftDigits: 1, rightDigits: 1, minFactor: 1, maxFactor: 9 },
      { operation: 'addition', leftDigits: 3, rightDigits: 3, carryMode: 'allowed' },
      { operation: 'subtraction', leftDigits: 3, rightDigits: 3, borrowMode: 'allowed' },
      { operation: 'multiplication', leftDigits: 2, rightDigits: 1, carryMode: 'allowed' },
    ];

    scenarios.forEach((config, index) => {
      const generated = generateProblem(config, { random: createSeededRandom(47 + index) });
      expect(generated.ok).toBe(true);
      if (generated.ok) {
        expect(verifyProblem(generated.problem)).toBe(true);
      }
    });
  });

  it('verifies the generated snapshot sequence for a known addition problem', () => {
    const generated = generateProblem({ operation: 'addition', leftDigits: 2, rightDigits: 2 }, { random: createSeededRandom(99) });
    expect(generated.ok).toBe(true);
    if (generated.ok) {
      expect(generated.problem.snapshots.map((snapshot) => snapshot.expected)).toEqual([expect.any(Number), expect.any(Number), null]);
      expect(generated.problem.snapshots.at(-1)?.stepIndex).toBeNull();
      expect(generated.problem.snapshots.at(-1)?.problemMatrix.at(-1)?.map((cell) => cell.kind === 'value' ? cell.value : null).join('')).toBe(String(generated.problem.result));
    }
  });
});
