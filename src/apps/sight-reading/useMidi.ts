import { useCallback, useEffect, useRef, useState } from 'react';
import { Input, WebMidi } from 'webmidi';
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
  const connectedRef = useRef<Input | null>(null);

  const callbacksRef = useRef({ onNoteOn, onNoteOff });
  useEffect(() => {
    callbacksRef.current = { onNoteOn, onNoteOff };
  }, [onNoteOn, onNoteOff]);

  const refresh = useCallback(() => {
    if (!navigator.requestMIDIAccess) {
      setStatus('unsupported');
      return;
    }
    WebMidi.enable()
      .then(() => {
        setDevices(Array.from(WebMidi.inputs.values()).map((input) => input.name ?? ''));
      })
      .catch((err) => alert(err));
  }, []);

  const connect = useCallback((name: string) => {
    const input = WebMidi.getInputByName(name);
    if (!input) {
      console.warn('[midi] no input found for name:', JSON.stringify(name));
      return;
    }
    console.log('[midi] connecting to', input.name, '(id:', input.id + ', state:', input.state + ')');

    // DEBUG: log every raw message to confirm the port is actually receiving data.
    input.addListener('midimessage', (e) => {
      console.log('[midi] raw message:', e.type, 'data:', Array.from(e.data));
    });

    // WebMidi.js leaves `accidental` undefined for natural notes; StaffNote expects ''.
    input.channels[1].addListener('noteon', (e) => {
      console.log('[midi] noteon:', e.note.name, e.note.accidental ?? '', e.note.octave);
      callbacksRef.current.onNoteOn(
        new StaffNote(e.note.name, e.note.accidental ?? '', e.note.octave),
      );
    });

    input.channels[1].addListener('noteoff', (e) => {
      console.log('[midi] noteoff:', e.note.name, e.note.accidental ?? '', e.note.octave);
      callbacksRef.current.onNoteOff(
        new StaffNote(e.note.name, e.note.accidental ?? '', e.note.octave),
      );
    });

    connectedRef.current = input;
    setStatus('connected');
  }, []);

  const disconnect = useCallback(() => {
    const input = connectedRef.current;
    if (input) {
      // Listeners live on the channel, not the Input.
      input.channels[1].removeListener('noteon');
      input.channels[1].removeListener('noteoff');
      input.removeListener('midimessage');
      connectedRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  // Track devices appearing/disappearing while enabled.
  useEffect(() => {
    const onChange = () =>
      setDevices(Array.from(WebMidi.inputs.values()).map((input) => input.name ?? ''));
    WebMidi.addListener('portschanged', onChange);
    return () => WebMidi.removeListener('portschanged', onChange);
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { devices, status, refresh, connect, disconnect };
}
