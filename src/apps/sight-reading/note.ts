// Port of the note model and random-note generation from the original
// assets/sight_reading.js, restructured as typed classes without globals.

export const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

// Single logical note representation
export class StaffNote 
{
  readonly name: string;
  readonly accidental: string;
  readonly octave: number;
  readonly index: number;

  /** Build from a flat note index (0 = A of octave 0). */
  constructor(index: number);
  /** Build from note name, accidental and octave. */
  constructor(name: string, accidental: string, octave: number);

  constructor(first: number | string, accidental?: string, octave?: number) 
  {
    if (typeof first === 'number') {
      // in this constructor the input is the key index
      this.index = first;
      // we add 5 so the index = 5 maps to position 5 in the NOTE_NAMES list
      // however the index is still 0, this also means that index 2 is actually
      // C1 which is position 0 in octave 1.
      const oct = Math.floor((first + 5) / NOTE_NAMES.length);
      this.octave = oct;
      // given the index we deduce the note name, but due to the limitions inposed
      // by the current logic, we don't support accidentals
      const pos = (first + 5) - oct * NOTE_NAMES.length;
      this.name = NOTE_NAMES[pos];
      this.accidental = '';
    } 
    else if (accidental !== undefined && octave !== undefined) {
      // in this constructor the input is the note and octave
      this.name = first;
      this.accidental = accidental;
      this.octave = octave;
      // and we need to back compute the index, and to make it start from 0 for A0,
      // we have to substract 5 since the A position if 5 in NOTE_NAMES.
      const position = NOTE_NAMES.indexOf(this.name as (typeof NOTE_NAMES)[number]);
      if (position < 0) throw new Error(`staff_note: unknown note name "${first}"`);
      this.index = NOTE_NAMES.length * (this.octave) + position - 5;
      if (this.index < 0) throw new Error(`staff_note: note below A0`);
    } 
    else {
      throw new Error('StaffNote::constructor() incorrect number of arguments.');
    }
  }

  // comparison is achieve only by the note index
  eq(other: StaffNote): boolean { return this.index === other.index; }
  gt(other: StaffNote): boolean { return this.index > other.index; }
  lt(other: StaffNote): boolean { return this.index < other.index; }

  toString(): string { return `${this.name}${this.accidental}/${this.octave}`; }
}

/**
 * Generates random notes inside [beginNote, endNote] using a sliding
 * 3-note window. A histogram makes recently used notes less likely to
 * repeat, so the output feels melodic rather than uniform noise.
 */
export class NoteDistribution 
{
  readonly beginNote: StaffNote;
  readonly endNote: StaffNote;

  private histogram: number[];
  winLow: number;
  winHigh: number;

  // begin and end note defines the range, while winLow and winHigh the
  // current sliding window from where to chose the notes. A complete
  // histogram (from begin to end) of notes is keep to drive a unifor
  // distribution such all note has same probability in short turns.
  constructor(beginNote: StaffNote, endNote: StaffNote) 
  {
    this.beginNote = beginNote;
    this.endNote = endNote;
    this.histogram = new Array(endNote.index - beginNote.index + 1).fill(0);
    this.winLow = Math.round((beginNote.index + endNote.index) / 2.0) - 1;
    this.winHigh = this.winLow + 2;
  }

  moveWindow(step: number): void 
  {
    this.winLow += step;
    this.winHigh += step;
    // clamp the low bound
    if (this.winLow <= this.beginNote.index) {
      this.winLow = this.beginNote.index;
      this.winHigh = this.beginNote.index + 2;
    }
    // clamp the high bound
    if (this.winHigh >= this.endNote.index) {
      this.winLow = this.endNote.index - 2;
      this.winHigh = this.endNote.index;
    }
  }

  generateRandomNotes(count: number): StaffNote[] 
  {
    return this.randomIndexRange(this.winLow, this.winHigh, count);
  }

  private randomIndexRange(lowNote: number, highNote: number, count: number): StaffNote[] 
  {
    // Map global indices to the local range [0, |high-low|)
    const lowIndex = lowNote - this.beginNote.index;
    const highIndex = highNote - this.beginNote.index;

    // Limit the probability to the local range.
    let probability = this.histogram.slice(lowIndex, highIndex + 1);
    if (probability.length === 1) {
      throw new Error('probability array of length 1');
    }
    
    // this invert the probability such that those notes that have picked up
    // more will get 0, and the lowest will be maximum.
    const probCount = Math.max(...probability) + 1;
    probability = probability.map((element) => Math.pow(probCount - element, 2));
    // and now we normalize such that the sum is 1.0
    const probNorm = probability.reduce((acc, element) => acc + element, 0);
    probability = probability.map((element) => element / probNorm);

    // Generate random indices, avoiding two consecutive equal notes.
    const value = new Array<number>(count);
    value[0] = lowIndex + this.pmfSampling(probability);
    for (let i = 1; i < count; i++) {
      do {
        value[i] = lowIndex + this.pmfSampling(probability);
      } while (value[i - 1] === value[i]);
    }

    // Update histogram and create notes.
    const notes = new Array<StaffNote>(count);
    for (let i = 0; i < count; i++) {
      this.histogram[value[i]]++;
      notes[i] = new StaffNote(value[i] + this.beginNote.index);
    }

    return notes;
  }

  private pmfSampling(probability: number[]): number 
  {
    const value = Math.random();
    let cumulativeProbability = 0;
    for (let i = 0; i < probability.length; i++) {
      cumulativeProbability += probability[i];
      if (value <= cumulativeProbability) {
        return i;
      }
    }
    return probability.length - 1;
  }
}

export interface ProducedNotes 
{
  treble: StaffNote[];
  bass: StaffNote[];
}

// Legal domain for the piano range, expressed in flat natural-note index space.
const PIANO_LOW_BOUND = 0;
const PIANO_HIGH_BOUND = 51;
const PIANO_MIN_SEPARATION = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Represents the note ranges for the left and right hands on a piano. It provides
 * methods to adjust the range, nudge the hands so they keep at least 2 notes apart,
 * and clamps to the keyboard boundaries (A0 to C8).
 *
 * The canonical state is held as four flat natural-note indices (0..51); the public
 * `StaffNote` boundary fields are derived from that index state. All boundary math is
 * done in index space and every mutation routes through a single normalization path.
 */
export class PianoRange
{
  public left_hand_low!: StaffNote;
  public left_hand_high!: StaffNote;
  public right_hand_low!: StaffNote;
  public right_hand_high!: StaffNote;

  // Canonical index-space state (single source of truth).
  private leftLow: number;
  private leftHigh: number;
  private rightLow: number;
  private rightHigh: number;

  constructor() {
    this.leftLow = new StaffNote("C", "", 3).index;
    this.leftHigh = new StaffNote("G", "", 3).index;
    this.rightLow = new StaffNote("C", "", 4).index;
    this.rightHigh = new StaffNote("G", "", 4).index;
    this.normalize();
  }

  public moveLeftHandBy(side: number, step: number): void {
    if (side === 0) {
      this.leftLow += step;
    } else {
      this.leftHigh += step;
    }
    this.normalize();
  }

  public moveRightHandBy(side: number, step: number): void {
    if (side === 0) {
      this.rightLow += step;
    } else {
      this.rightHigh += step;
    }
    this.normalize();
  }

  public moveLeftHandTo(side: number, index: number): void {
    const current = side === 0 ? this.leftLow : this.leftHigh;
    this.moveLeftHandBy(side, index - current);
  }

  public moveRightHandTo(side: number, index: number): void {
    const current = side === 0 ? this.rightLow : this.rightHigh;
    this.moveRightHandBy(side, index - current);
  }

  /**
   * The only path by which range state is stored. Clamps each boundary into its legal
   * sub-range, repairs per-hand low/high collisions, enforces cross-hand separation,
   * and re-derives the public `StaffNote` fields from the normalized indices.
   */
  private normalize(): void {
    // 1. Clamp each boundary into its legal sub-range.
    this.leftLow = clamp(this.leftLow, PIANO_LOW_BOUND, PIANO_HIGH_BOUND - PIANO_MIN_SEPARATION);
    this.leftHigh = clamp(this.leftHigh, PIANO_MIN_SEPARATION, PIANO_HIGH_BOUND);
    this.rightLow = clamp(this.rightLow, PIANO_LOW_BOUND, PIANO_HIGH_BOUND - PIANO_MIN_SEPARATION);
    this.rightHigh = clamp(this.rightHigh, PIANO_MIN_SEPARATION, PIANO_HIGH_BOUND);

    // 2. Repair per-hand low/high collisions (restore the minimum gap).
    if (this.leftHigh < this.leftLow + PIANO_MIN_SEPARATION) {
      this.leftHigh = this.leftLow + PIANO_MIN_SEPARATION;
    }
    if (this.rightHigh < this.rightLow + PIANO_MIN_SEPARATION) {
      this.rightHigh = this.rightLow + PIANO_MIN_SEPARATION;
    }

    // 3. Enforce cross-hand separation: the right hand stays at least MIN above the left.
    if (this.rightLow < this.leftLow + PIANO_MIN_SEPARATION) {
      this.rightLow = this.leftLow + PIANO_MIN_SEPARATION;
    }
    if (this.rightHigh < this.leftHigh + PIANO_MIN_SEPARATION) {
      this.rightHigh = Math.min(this.leftHigh + PIANO_MIN_SEPARATION, PIANO_HIGH_BOUND);
    }

    // 4. Re-verify the right hand's internal gap after the cross-hand push.
    if (this.rightHigh < this.rightLow + PIANO_MIN_SEPARATION) {
      this.rightHigh = Math.min(this.rightLow + PIANO_MIN_SEPARATION, PIANO_HIGH_BOUND);
    }

    // 5. Re-derive the public StaffNote fields from the normalized indices.
    this.left_hand_low = new StaffNote(this.leftLow);
    this.left_hand_high = new StaffNote(this.leftHigh);
    this.right_hand_low = new StaffNote(this.rightLow);
    this.right_hand_high = new StaffNote(this.rightHigh);
  }
}

/**
 * Holds the treble and bass distributions and drives the sliding window.
 * `interval` controls how far the window may drift per round (replaces the
 * old hardcoded step table): steps are sampled from -interval..+interval
 * with a bias toward small steps.
 */
export class NoteProducer 
{
  private treble: NoteDistribution;
  private bass: NoteDistribution;
  private direction = 0; // 0 = free, 1 = push down
  private winCnt = 0;

  constructor(
    trebleLow: StaffNote,
    trebleHigh: StaffNote,
    bassLow: StaffNote,
    bassHigh: StaffNote) 
  {
    this.treble = new NoteDistribution(trebleLow, trebleHigh);
    this.bass = new NoteDistribution(bassLow, bassHigh);
  }

  setTrebleRange(low: StaffNote, high: StaffNote): void {
    this.treble = new NoteDistribution(low, high);
  }

  setBassRange(low: StaffNote, high: StaffNote): void {
    this.bass = new NoteDistribution(low, high);
  }

  produce(interval: number, count: number): ProducedNotes 
  {
    const step = this.sampleStep(interval);
    
    if (this.direction === 1) {
      this.treble.moveWindow(-step);
      this.bass.moveWindow(-step);
    } else {
      this.treble.moveWindow(step);
      this.bass.moveWindow(step);
    }

    // If both windows are stuck at the low boundary, go back to free drift.
    if (this.treble.winLow <= this.treble.beginNote.index &&
        this.bass.winLow <= this.bass.beginNote.index) 
    {
      this.winCnt++;
      // wait 6 cycles then force a change in direction to allow extremes
      // to participate evently in the distribution
      if (this.winCnt > 6) {
        this.winCnt = 0;
        this.direction = 0;
      }
    }

    // If both windows are stuck at the high boundary, push them down.
    if (this.treble.winHigh >= this.treble.endNote.index &&
        this.bass.winHigh >= this.bass.endNote.index)
    {
      this.winCnt++;
      // wait 6 cycles then force a change in direction to allow extremes
      // to participate evently in the distribution
      if (this.winCnt > 6) {
        this.winCnt = 0;
        this.direction = 1;
      }
    }

    return {
      treble: this.treble.generateRandomNotes(count),
      bass: this.bass.generateRandomNotes(count),
    };
  }

  private sampleStep(interval: number): number 
  {
    // Weights biased toward small steps: w(0) = 2, w(±k) = 1/k.
    const weights: number[] = [2];
    for (let k = 1; k <= interval; k++) {
      weights.push(1 / k);
    }
    const total = weights.reduce((acc, w) => acc + w, 0);
    let r = Math.random() * total;
    for (let k = 0; k < weights.length; k++) {
      r -= weights[k];
      if (r <= 0) {
        return k === 0 ? 0 : Math.random() < 0.5 ? -k : k;
      }
    }
    return interval;
  }
}
