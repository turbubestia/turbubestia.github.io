
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
    
    // this array saves the history of apparition of each notes in the
    // configured begin_note to end_node
    this.histogram = new Array(end_note.index - begin_note.index + 1).fill(0);
    
    this.win_low = Math.round((begin_note.index + end_note.index) / 2.0) - 1;
    this.win_high = this.win_low + 2;
    
    // this.direction = 1;
  }

  // dir: 0 for mostly up, 1 for mostly down
  move_window_random(step) {
    
    this.win_low += step;
    this.win_high += step;
    
    if (this.win_low <= this.begin_note.index) {
      this.win_low = this.begin_note.index;
      this.win_high = this.begin_note.index + 2;
    }
    
    if (this.win_high >= this.end_note.index) {
      this.win_low = this.end_note.index - 2;
      this.win_high = this.end_note.index;
    }
  }
  
  generate_random_notes() {
    return this.random_index_range(this.win_low, this.win_high, g_note_count);
  }

  random_index_range(low_note, high_note, count) {
    // map global keys to local range
    let low_index = low_note - this.begin_note.index;
    let high_index = high_note - this.begin_note.index;

    // limit the probability to the local range
    let probability = this.histogram.slice(low_index, high_index + 1);
    if (probability.length === 1) {
      throw "probability array of length 1";
    }
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
let g_treble_high_note = new staff_note('E','', 6);
let g_treble_low_note = new staff_note('E','', 3);
let g_bass_high_note = new staff_note('G','', 4);
let g_bass_low_note = new staff_note('G','', 1);

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

let g_direction = 0;
let g_win_cnt = 0;

let g_rh_enabled = true;
let g_lh_enabled = true;

function produce_note() {

  let step_probability = [-1, -1, 0, 0, 1, 1, 1, 1, 2];
  let step = step_probability[Math.floor(Math.random() * step_probability.length)];
  if (g_direction === 1) step *= -1;

  g_treble_notes_producer.move_window_random(step);
  g_bass_notes_producer.move_window_random(step);

  if (g_treble_notes_producer.win_low <= g_treble_notes_producer.begin_note.index &&
      g_bass_notes_producer.win_low <= g_bass_notes_producer.begin_note.index) {
    g_win_cnt++;
    if (g_win_cnt > 6) {
      g_win_cnt = 0;
      g_direction = 0;
    }
  }

  if (g_treble_notes_producer.win_high >= g_treble_notes_producer.end_note.index &&
      g_bass_notes_producer.win_high >= g_bass_notes_producer.end_note.index) {
    g_win_cnt++;
    if (g_win_cnt > 6) {
      g_win_cnt = 0;
      g_direction = 1;
    }
  }
  
  g_treble_notes = g_treble_notes_producer.generate_random_notes();
  g_bass_notes = g_bass_notes_producer.generate_random_notes();

  g_treble_matches = new Array(g_note_count).fill(false);
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

  let stave_treble;
  let treble_voices;
  
  // Treble
  if (g_rh_enabled) {
    stave_treble = new Stave(12, 30.5, 200);
    stave_treble.addClef("treble").addTimeSignature("4/4");
    stave_treble.setStyle({strokeStyle: '#CCCCCC', lineWidth: 1.0});
    stave_treble.setDefaultLedgerLineStyle({strokeStyle: '#CCCCCC', lineWidth: 1.0});
    stave_treble.setContext(context).draw();

    treble_voices = build_stave_voices(stave_treble, treble_notes, treble_matches);
  }
  
  let stave_bass
  let bass_voices;
  
  if (g_lh_enabled) {
    // Bass
    stave_bass = new Stave(12, 160.5, 200);
    stave_bass.addClef("bass").addTimeSignature("4/4");
    stave_bass.setStyle({strokeStyle: '#CCCCCC', lineWidth: 1.0});
    stave_bass.setDefaultLedgerLineStyle({strokeStyle: '#CCCCCC', lineWidth: 1.05});
    stave_bass.setContext(context).draw();

    bass_voices = build_stave_voices(stave_bass, bass_notes, bass_matches);
  }
  
  let formatter = new Formatter();
  if (g_rh_enabled && !g_lh_enabled) {
    formatter.joinVoices(treble_voices).format(treble_voices, 125);
  } else if (g_lh_enabled && !g_rh_enabled) {
    formatter.joinVoices(bass_voices).format(bass_voices, 125);
  } else {
    formatter.joinVoices(treble_voices).joinVoices(bass_voices).format([...treble_voices, ...bass_voices], 125);
  }
  
  if (g_rh_enabled) {
    treble_voices[0].draw(context, stave_treble);
    if (show_note_labels) {
      treble_voices[1].draw(context, stave_treble);
    }
  }
  
  if (g_lh_enabled) {
    bass_voices[0].draw(context, stave_bass);
    if (show_note_labels) {
      bass_voices[1].draw(context, stave_bass);
    }
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

  // hand selection
  document.getElementById('rh_radio').addEventListener('change', function() {
    g_rh_enabled = this.checked || document.getElementById('bt_radio').checked;
    g_lh_enabled = document.getElementById('bt_radio').checked;
  })
  
  document.getElementById('lh_radio').addEventListener('change', function() {
    g_rh_enabled = document.getElementById('bt_radio').checked;
    g_lh_enabled = this.checked || document.getElementById('bt_radio').checked;
  })

  document.getElementById('bt_radio').addEventListener('change', function() {
    g_rh_enabled = this.checked;
    g_lh_enabled = this.checked;
  })
  
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
