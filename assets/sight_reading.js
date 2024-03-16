
const {Renderer, Stave, StaveNote, Voice, Formatter} = Vex.Flow;

const g_notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

class staff_note {
  constructor() {
    if (arguments.length === 1) {
      const index = arguments[0];
      const octave = Math.ceil((index + 1) / g_notes.length);
      const pos = index - (octave - 1) * g_notes.length;
      this.name = g_notes[pos];
      this.octave = octave;
      this.index = index;
      this.accidental = '';
    }
    else if (arguments.length === 3) {
      this.name = arguments[0];
      this.accidental = arguments[1];
      this.octave = Number(arguments[2]);
      const position = g_notes.indexOf(this.name);
      this.index = g_notes.length * (this.octave - 1) + position;
    }
    else {
      throw "staff_note::constructor() Incorrect number of arguements.";
    }
  }

  eq(other) {return this.index === other.index;}
  gt(other) {return this.index > other.index;}
  lt(other) {return this.index < other.index;}

  toString() {
    return this.name + this.accidental + "/" + this.octave;
  }
}

class staff_note_distribution {
  constructor(begin_note, end_note) {
    this.begin_note = begin_note;
    this.end_note = end_note;
    this.center_note = new staff_note(Math.round((begin_note.index + end_note.index) / 2.0));
    this.histogram = new Array(end_note.index - begin_note.index + 1).fill(0);
    this.direction = 1;
  }

  generate_random_notes(interval) {
    // select if we go up or down from this probability distribution
    const dir_probability = this.direction === 0 ? [0, 0, 0, 0, 0, 1, 1] : [1, 1, 1, 1, 1, 0, 0];
    const dir = dir_probability[Math.floor(Math.random() * dir_probability.length)];

    const note = this.center_note;

    // peak a random jump up or down
    let value = dir === 0
      ? note.index - Math.floor(Math.random() * (interval - 1)) - 1
      : note.index + Math.floor(Math.random() * (interval - 1)) + 1;

    // bound check, and shift direction if we hit the boundaries
    if (value <= this.begin_note.index) {
      value = this.begin_note.index;
      this.direction = 1;
    } else if (value >= this.end_note.index) {
      value = this.end_note.index;
      this.direction = 0;
    }

    this.center_note = new staff_note(value);

    let low_note = new staff_note(this.center_note.index - interval);
    let high_note = new staff_note(low_note.index + interval);

    return this.random_index_range(low_note, high_note, g_note_count);
  }

  random_index_range(low_note, high_note, count) {
    // map global keys to local range
    let low_index = low_note.index - this.begin_note.index;
    let high_index = high_note.index - this.begin_note.index;

    // index bound check
    if (low_index < 0) low_index = 0;
    if (high_index > this.histogram.length - 1) high_index = this.histogram.length - 1;

    if (Math.abs(high_index - low_index) < 2) {
      high_index = low_index + 1;
    }

    // limit the probability to the local range
    let probability = this.histogram.slice(low_index, high_index + 1);
    const prob_count = Math.max.apply(null, probability) + 1;
    probability = probability.map(element => Math.pow(prob_count - element, 2));
    const prob_norm = probability.reduce((acc, element) => acc + element, 0);
    probability = probability.map(element => element / prob_norm);

    // generate random indices
    const value = new Array(count);
    value[0] = low_index + this.pmf_sampling(probability);
    for (let i = 1; i < count; i++) {
      // avoid two consecutive equal notes
      do {
        value[i] = low_index + this.pmf_sampling(probability);
      } while (value[i-1] === value[i]);
    }

    // update histogram and create notes
    const notes = new Array(count);
    for (let i = 0; i < count; i++) {
      this.histogram[value[i]]++;
      notes[i] = new staff_note(value[i] + this.begin_note.index);
    }

    return notes;
  }

  pmf_sampling(probability) {
    const value = Math.random();
    let cumulative_probability = 0;
    for (let i = 0; i < probability.length; i++) {
      cumulative_probability += probability[i];
      if (value <= cumulative_probability) {
        return i;
      }
    }
    return probability.length - 1;
  }
}

let g_note_count = 2;

// Range of generated notes
let g_treble_high_note = new staff_note('A','', 5);
let g_treble_low_note = new staff_note('C','', 4);
let g_bass_high_note = new staff_note('C','', 4);
let g_bass_low_note = new staff_note('E','', 2);

// current notes to match and their match status
let g_treble_notes = [new staff_note('G','', 4)];
let g_treble_matches = new Array(g_treble_notes.length).fill(false);
let g_bass_notes = [new staff_note('F','', 3)];
let g_bass_matches = new Array(g_bass_notes.length).fill(false);

// to check when the match count is equal to the note count
let g_match_count = 0;

let g_treble_notes_producer = new staff_note_distribution(g_treble_low_note, g_treble_high_note);
let g_bass_notes_producer = new staff_note_distribution(g_bass_low_note, g_bass_high_note);

function update_producers() {
  g_treble_notes_producer = new staff_note_distribution(g_treble_low_note, g_treble_high_note);
  g_bass_notes_producer = new staff_note_distribution(g_bass_low_note, g_bass_high_note);
}

function produce_note() {
  const interval = Number(document.getElementById("noteInterval").value);

  g_treble_notes = g_treble_notes_producer.generate_random_notes(interval);
  g_treble_matches = new Array(g_note_count).fill(false);

  g_bass_notes = g_bass_notes_producer.generate_random_notes(interval);
  g_bass_matches = new Array(g_note_count).fill(false);

  g_match_count = 0;
}

function build_stave_voices(stave, notes, matches) {
  const note_count = notes.length;
  let note_duration = "";
  if (note_count === 1) { note_duration = "w"; }
  else if (note_count === 2) { note_duration = "h"; }
  else if (note_count === 4) { note_duration = "q"; }
  else { return; }

  let center_treble_stem_note = new staff_note('B','', 4);
  if (stave.getClef() === "bass") {
    center_treble_stem_note = new staff_note('D','', 3);
  }

  let notes_treble =  [];
  let text_treble = [];

  for (let i = 0; i < note_count; i++) {
    let temp = new StaveNote({clef: stave.getClef(), keys: [notes[i].name + '/' + notes[i].octave], duration: note_duration});
    if (matches.length === note_count && matches[i]) temp.setStyle({ fillStyle: "green", strokeStyle: "green"});
    if (notes[i].gt(center_treble_stem_note)) temp.setStemDirection(Vex.Flow.Stem.DOWN);
    notes_treble.push(temp);

    let tn = new Vex.Flow.TextNote({text: notes[i].name + notes[i].octave, font: {family: "Arial", size: 10,}, duration: note_duration })
      .setJustification(Vex.Flow.TextNote.Justification.CENTER) // Horizontal alignment
      .setLine(10)
      .setStave(stave);
    text_treble.push(tn);
  }

  const notes_voice = new Voice({ num_beats: 4, beat_value: 4});
  notes_voice.addTickables(notes_treble);

  const text_voice = new Voice({ num_beats: 4, beat_value: 4});
  text_voice.addTickables(text_treble);

  return [notes_voice, text_voice];
}

function draw_staves(
  show_note_labels = false,
  treble_notes = g_treble_notes,
  treble_matches = g_treble_matches,
  bass_notes = g_bass_notes,
  bass_matches = g_bass_matches)
{
  // Clear existing SVG
  const div_staff = document.getElementById("staff");
  div_staff.innerHTML = '';

  // Re-initialize renderer
  const renderer = new Renderer("staff", Renderer.Backends.SVG);

  // Configure the rendering context.
  renderer.resize(250, 300);
  const context = renderer.getContext();
  context.setStrokeStyle('white');
  context.setFillStyle('white');

  // Treble
  const stave_treble = new Stave(12, 30.5, 200);
  stave_treble.addClef("treble").addTimeSignature("4/4");
  stave_treble.setStyle({strokeStyle: '#808080', lineWidth: 1.0});
  stave_treble.setContext(context).draw();

  const treble_voices = build_stave_voices(stave_treble, treble_notes, treble_matches);

  // Bass
  const stave_bass = new Stave(12, 160.5, 200);
  stave_bass.addClef("bass").addTimeSignature("4/4");
  stave_bass.setStyle({strokeStyle: '#808080', lineWidth: 1.0});
  stave_bass.setContext(context).draw();

  const bass_voices = build_stave_voices(stave_bass, bass_notes, bass_matches);

  // Drawing composition
  new Formatter()
    .joinVoices(treble_voices)
    .joinVoices(bass_voices)
    .format([...treble_voices, ...bass_voices], 125);

  treble_voices[0].draw(context, stave_treble);
  bass_voices[0].draw(context, stave_bass);

  if (show_note_labels) {
    treble_voices[1].draw(context, stave_treble);
    bass_voices[1].draw(context, stave_bass);
  }
}

function draw_staff_range() {
  draw_staves(true, [g_treble_low_note, g_treble_high_note], [], [g_bass_low_note, g_bass_high_note], []);
}

function update_treble_high_note(note) {
  if (note.gt(g_treble_low_note)) {
    g_treble_high_note = note;
    update_producers();
    draw_staff_range();
  } else {
    console.log("Treble high note (" + note.toString() + ") must be higher than the treble low note " + g_treble_low_note.toString());
  }
}

function update_treble_low_note(note) {
  if (note.lt(g_treble_high_note)) {
    g_treble_low_note = note;
    update_producers();
    draw_staff_range();
  } else {
    console.log("Treble low note (" + note.toString() + ") must be lower than the treble high note " + g_treble_high_note.toString());
  }
}

function update_bass_high_note(note) {
  if (note.gt(g_bass_low_note)) {
    g_bass_high_note = note;
    update_producers();
    draw_staff_range();
  } else {
    console.log("Bass high note (" + note.toString() + ") must be higher than the bass low note " + g_bass_low_note.toString());
  }
}

function update_bass_low_note(note) {
  if (note.lt(g_bass_high_note)) {
    g_bass_low_note = note;
    update_producers();
    draw_staff_range();
  } else {
    console.log("Bass low note (" + note.toString() + ") must be lower than the bass high note " + g_bass_high_note.toString());
  }
}

document.addEventListener('DOMContentLoaded', function() {
  refresh_midi();

  // initialization -----------------------------------------------------------
  document.getElementById('noteCount').value = g_note_count;

  document.getElementById('trebleHighNoteSelector').value = g_treble_high_note.name;
  document.getElementById('trebleHighOctaveSelector').value = g_treble_high_note.octave;

  document.getElementById('trebleLowNoteSelector').value = g_treble_low_note.name;
  document.getElementById('trebleLowOctaveSelector').value = g_treble_low_note.octave;

  document.getElementById('bassHighNoteSelector').value = g_bass_high_note.name;
  document.getElementById('bassHighOctaveSelector').value = g_bass_high_note.octave;

  document.getElementById('bassLowNoteSelector').value = g_bass_low_note.name;
  document.getElementById('bassLowOctaveSelector').value = g_bass_low_note.octave;

  // Events -------------------------------------------------------------------

  // midi device buttons
  document.getElementById('connect').addEventListener('click', connect_midi_device);

  let disconnect_button = document.getElementById('disconnect');
  disconnect_button.disabled = true;
  disconnect_button.addEventListener('click', disconnect_midi_device);

  document.getElementById('refresh').addEventListener('click', refresh_midi);

  document.getElementById('noteCount').addEventListener('change', function() {
    g_note_count = Number(this.value);
    produce_note();
    draw_staves();
  });

  // treble note generation range
  document.getElementById('trebleHighNoteSelector').addEventListener('change', function() {
    update_treble_high_note(new staff_note(this.value, '', g_treble_high_note.octave));
    document.getElementById('trebleHighNoteSelector').value = g_treble_high_note.name;
  });

  document.getElementById('trebleHighOctaveSelector').addEventListener('change', function() {
    update_treble_high_note(new staff_note(g_treble_high_note.name, '', Number(this.value)));
    document.getElementById('trebleHighOctaveSelector').value = g_treble_high_note.octave;
  });

  document.getElementById('trebleLowNoteSelector').addEventListener('change', function() {
    update_treble_low_note(new staff_note(this.value, '', g_treble_low_note.octave));
    document.getElementById('trebleLowNoteSelector').value = g_treble_low_note.name;
  });

  document.getElementById('trebleLowOctaveSelector').addEventListener('change', function() {
    update_treble_low_note(new staff_note(g_treble_low_note.name, '', Number(this.value)));
    document.getElementById('trebleLowOctaveSelector').value = g_treble_low_note.octave;
  });

  // bass note generation range
  document.getElementById('bassHighNoteSelector').addEventListener('change', function() {
    update_bass_high_note(new staff_note(this.value, '', g_bass_high_note.octave));
    document.getElementById('bassHighNoteSelector').value = g_bass_high_note.name;
  });

  document.getElementById('bassHighOctaveSelector').addEventListener('change', function() {
    update_bass_high_note(new staff_note(g_bass_high_note.name, '', Number(this.value)));
    document.getElementById('bassHighOctaveSelector').value = g_bass_high_note.octave;
  });

  document.getElementById('bassLowNoteSelector').addEventListener('change', function() {
    update_bass_low_note(new staff_note(this.value, '', g_bass_low_note.octave));
    document.getElementById('bassLowNoteSelector').value = g_bass_low_note.name;
  });

  document.getElementById('bassLowOctaveSelector').addEventListener('change', function() {
    update_bass_low_note(new staff_note(g_bass_low_note.name, '', Number(this.value)));
    document.getElementById('bassLowOctaveSelector').value = g_bass_low_note.octave;
  });

  // staff
  document.getElementById('staff').addEventListener('click', function(_) {
    produce_note();
    draw_staves();
  });

  document.getElementById("showNotes").addEventListener('click', function (_) {
    draw_staves(true);
  });

  // initial notes
  produce_note();
  draw_staves();
});
