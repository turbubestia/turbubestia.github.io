// Minimal global typings for the WebMidi library (no bundled types).
// This file must stay a global script (no import/export) so the
// `WebMidi` namespace is visible from every module.

declare namespace WebMidi {
  interface MIDINote {
    name: string;
    accidental: string;
    octave: number;
    number: number;
  }

  interface MIDIEvent {
    type: string;
    time: number;
  }

  interface MIDINoteOnEvent extends MIDIEvent {
    type: 'noteon';
    note: MIDINote;
    velocity: number;
  }

  interface MIDINoteOffEvent extends MIDIEvent {
    type: 'noteoff';
    note: MIDINote;
  }

  interface MIDIInput {
    id: string;
    name: string;
    manufacturer?: string;
    addListener(event: string, callback: (e: MIDINoteOnEvent | MIDINoteOffEvent) => void): void;
    removeListener(event?: string): void;
  }

  interface WebMidiManager extends EventTarget {
    readonly enabled: boolean;
    readonly inputs: MIDIInput[];
    readonly outputs: unknown[];
    enable(): Promise<void>;
    disable(): void;
    getInputByName(name: string): MIDIInput | null;
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
  }

}

declare var WebMidi: WebMidi.WebMidiManager;
