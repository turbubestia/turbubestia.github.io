import { useCallback, useEffect, useRef, useState } from 'react';
import { StaffNote } from './note';

export type MidiStatus = 'unsupported' | 'disconnected' | 'connected';

export interface UseMidiOptions {
  onNoteOn: (note: StaffNote) => void;
  onNoteOff: (note: StaffNote) => void;
}

export interface UseMidiResult {
  devices: string[];
  status: MidiStatus;
  refresh: () => void;
  connect: (name: string) => void;
  disconnect: () => void;
}

/**
 * WebMIDI wrapper hook. Note callbacks are kept in a ref so the underlying
 * MIDI listeners are attached once per connection and always see the latest
 * game state without re-subscribing on every render.
 */
export function useMidi({ onNoteOn, onNoteOff }: UseMidiOptions): UseMidiResult {
  const [devices, setDevices] = useState<string[]>([]);
  const [status, setStatus] = useState<MidiStatus>('disconnected');
  const connectedRef = useRef<WebMidi.MIDIInput | null>(null);

  const callbacksRef = useRef({ onNoteOn, onNoteOff });
  useEffect(() => {
    callbacksRef.current = { onNoteOn, onNoteOff };
  }, [onNoteOn, onNoteOff]);

  const refresh = useCallback(() => {
    if (typeof WebMidi === 'undefined') {
      setStatus('unsupported');
      return;
    }
    WebMidi.enable()
      .then(() => {
        setDevices(WebMidi.inputs.map((input) => input.name));
      })
      .catch((err) => alert(err));
  }, []);

  const connect = useCallback(
    (name: string) => {
      if (typeof WebMidi === 'undefined') return;
      const input = WebMidi.getInputByName(name);
      if (!input) return;

      input.addListener('noteon', (e) => {
        if (e.type !== 'noteon') return;
        callbacksRef.current.onNoteOn(
          new StaffNote(e.note.name, e.note.accidental, e.note.octave),
        );
      });
      input.addListener('noteoff', (e) => {
        if (e.type !== 'noteoff') return;
        callbacksRef.current.onNoteOff(
          new StaffNote(e.note.name, e.note.accidental, e.note.octave),
        );
      });

      connectedRef.current = input;
      setStatus('connected');
    },
    [],
  );

  const disconnect = useCallback(() => {
    const input = connectedRef.current;
    if (input) {
      input.removeListener('noteon');
      input.removeListener('noteoff');
      connectedRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  // Track devices appearing/disappearing while enabled.
  useEffect(() => {
    if (typeof WebMidi === 'undefined') return;
    const onChange = () => setDevices(WebMidi.inputs.map((input) => input.name));
    WebMidi.addEventListener('midimessage', onChange);
    return () => WebMidi.removeEventListener('midimessage', onChange);
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { devices, status, refresh, connect, disconnect };
}
