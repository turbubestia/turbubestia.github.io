import { useEffect, useRef } from 'react';
import { Formatter, Renderer, Stave, StaveNote, Stem, TextNote, Voice } from 'vexflow';
import { StaffNote } from './note';

export interface StaffCanvasProps {
  trebleNotes: StaffNote[];
  trebleMatches: boolean[];
  bassNotes: StaffNote[];
  bassMatches: boolean[];
  rhEnabled: boolean;
  lhEnabled: boolean;
  showLabels: boolean;
}

function noteDuration(noteCount: number): string {
  if (noteCount === 1) return 'w';
  if (noteCount === 2) return 'h';
  if (noteCount === 4) return 'q';
  return '';
}

interface StaveVoices {
  stave: Stave;
  notesVoice: Voice;
  textVoice: Voice;
}

function buildStaveVoices(
  stave: Stave,
  notes: StaffNote[],
  matches: boolean[],
): [Voice, Voice] {
  const noteCount = notes.length;
  const duration = noteDuration(noteCount);

  // Notes above the staff center get stems pointing down.
  const centerNote =
    stave.getClef() === 'bass' ? new StaffNote('D', '', 3) : new StaffNote('B', '', 4);

  const vexNotes: StaveNote[] = [];
  const textNotes: TextNote[] = [];

  for (let i = 0; i < noteCount; i++) {
    const temp = new StaveNote({
      clef: stave.getClef(),
      keys: [`${notes[i].name}/${notes[i].octave}`],
      duration: duration,
    });
    if (matches.length === noteCount && matches[i]) {
      temp.setStyle({ fillStyle: 'green', strokeStyle: 'green' });
    }
    if (notes[i].gt(centerNote)) {
      temp.setStemDirection(Stem.DOWN);
    }
    vexNotes.push(temp);

    textNotes.push(
      new TextNote({
        text: `${notes[i].name}${notes[i].octave}`,
        font: { family: 'Arial', size: 10 },
        duration: duration,
      })
        .setJustification(TextNote.Justification.CENTER)
        .setLine(10)
        .setStave(stave),
    );
  }

  const notesVoice = new Voice({ numBeats: 4, beatValue: 4 });
  notesVoice.addTickables(vexNotes);

  const textVoice = new Voice({ numBeats: 4, beatValue: 4 });
  textVoice.addTickables(textNotes);

  return [notesVoice, textVoice];
}

/**
 * Renders the treble and bass staves with Vex.Flow into a div.
 * Re-renders whenever any prop changes (replaces the old manual redraw).
 */
export function StaffCanvas({
  trebleNotes,
  trebleMatches,
  bassNotes,
  bassMatches,
  rhEnabled,
  lhEnabled,
  showLabels,
}: StaffCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(250, 300);
    const context = renderer.getContext();
    context.setStrokeStyle('white');
    context.setFillStyle('white');

    let treble: StaveVoices | null = null;
    let bass: StaveVoices | null = null;

    if (rhEnabled) {
      const stave = new Stave(12, 30.5, 200);
      stave.addClef('treble').addTimeSignature('4/4');
      stave.setStyle({ strokeStyle: '#CCCCCC', lineWidth: 1.0 });
      stave.setDefaultLedgerLineStyle({ strokeStyle: '#CCCCCC', lineWidth: 1.0 });
      stave.setContext(context).draw();
      const [notesVoice, textVoice] = buildStaveVoices(stave, trebleNotes, trebleMatches);
      treble = { stave, notesVoice, textVoice };
    }

    if (lhEnabled) {
      const stave = new Stave(12, 160.5, 200);
      stave.addClef('bass').addTimeSignature('4/4');
      stave.setStyle({ strokeStyle: '#CCCCCC', lineWidth: 1.0 });
      stave.setDefaultLedgerLineStyle({ strokeStyle: '#CCCCCC', lineWidth: 1.05 });
      stave.setContext(context).draw();
      const [notesVoice, textVoice] = buildStaveVoices(stave, bassNotes, bassMatches);
      bass = { stave, notesVoice, textVoice };
    }

    // TextNote tickables require a TickContext, so label voices must be
    // formatted alongside the note voices. joinVoices overlays them at the
    // same x positions instead of laying them out sequentially.
    const formatter = new Formatter();
    const allVoices: Voice[] = [];
    if (treble) {
      const voices = [treble.notesVoice];
      if (showLabels) voices.push(treble.textVoice);
      formatter.joinVoices(voices);
      allVoices.push(...voices);
    }
    if (bass) {
      const voices = [bass.notesVoice];
      if (showLabels) voices.push(bass.textVoice);
      formatter.joinVoices(voices);
      allVoices.push(...voices);
    }
    formatter.format(allVoices, 125);

    if (treble) {
      treble.notesVoice.draw(context, treble.stave);
      if (showLabels) treble.textVoice.draw(context, treble.stave);
    }
    if (bass) {
      bass.notesVoice.draw(context, bass.stave);
      if (showLabels) bass.textVoice.draw(context, bass.stave);
    }
  }, [trebleNotes, trebleMatches, bassNotes, bassMatches, rhEnabled, lhEnabled, showLabels]);

  return <div ref={containerRef} className="mx-auto w-[250px]" />;
}
