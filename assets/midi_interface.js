
let g_selectedMidiName = "";

function refresh_midi() {
    WebMidi
        .enable()
        .then(on_midi_enabled)
        .catch(err => alert(err));
}

function on_midi_enabled() {
    // get and clear the selector
    let selectMidiElement = document.getElementById('midi-device');
    selectMidiElement.innerHTML = '';

    // and then populate the selector
    WebMidi.inputs.forEach(input => {
        let option = document.createElement('option');
        option.value = input.id; // Assuming each device has an 'id' property
        option.textContent = input.name; // Assuming each device has a 'name' property
        selectMidiElement.appendChild(option);
    });
}

function selected_midi_device_text() {
    let select = document.getElementById('midi-device');
    return select.options[select.selectedIndex].text;
}

function connect_midi_device() {
    let selected = selected_midi_device_text();
    if (selected === undefined) return;

    const myInput = WebMidi.getInputByName(selected);
    myInput.addListener("noteon", midi_key_press);
    myInput.addListener("noteoff", midi_key_release);

    let selectComboBox = document.getElementById('midi-device');
    let connectButton = document.getElementById('connect');
    let disconnectButton = document.getElementById('disconnect');

    selectComboBox.disabled = true;
    connectButton.disabled = true;
    disconnectButton.disabled = false;

    g_selectedMidiName = selected;

    document.getElementById('status').innerText = 'Connected';
}

function disconnect_midi_device() {
    let selectComboBox = document.getElementById('midi-device');
    let connectButton = document.getElementById('connect');
    let disconnectButton = document.getElementById('disconnect');

    const myInput = WebMidi.getInputByName(g_selectedMidiName);
    myInput.removeListener( "noteon", midi_key_press);
    myInput.removeListener("noteoff", midi_key_release);

    selectComboBox.disabled = false;
    connectButton.disabled = false;
    disconnectButton.disabled = true;

    document.getElementById('status').innerText = 'Disconnected';
}

function midi_key_press(e) {

    if (g_match_count === g_note_count) {
        return;
    }

    const note = new staff_note(e.note.name, e.note.accidental, e.note.octave);
    const treble_match = note.eq(g_treble_notes[g_match_count]);
    const bass_match = note.eq(g_bass_notes[g_match_count]);

    if (treble_match) {
        g_treble_matches[g_match_count] = true;
    } else if (bass_match) {
        g_bass_matches[g_match_count] = true;
    } else {
        g_treble_matches[g_match_count] = treble_match;
        g_bass_matches[g_match_count] = bass_match;
    }

    if (g_treble_matches[g_match_count] && g_bass_matches[g_match_count]) {
        g_match_count++;
    }

    if (g_match_count === g_note_count) {
        let to = Number(document.getElementById("noteTimeout").value);
        setTimeout(function () {
            if (g_match_count === g_note_count) {
                produce_note();
                draw_staves();
            }
        }, to * 1000);
    }

    if (treble_match || bass_match) {
        draw_staves();
    }
}

function midi_key_release(e) {

    if (g_match_count === g_note_count) {
        produce_note();
        draw_staves();
    } else {
        const note = new staff_note(e.note.name, e.note.accidental, e.note.octave);
        const treble_match = note.eq(g_treble_notes[g_match_count]);
        const bass_match = note.eq(g_bass_notes[g_match_count]);

        if (g_match_count < g_note_count) {
            if (treble_match) {
                g_treble_matches[g_match_count] = false;
            } else if (bass_match) {
                g_bass_matches[g_match_count] = false;
            } else {
                g_treble_matches[g_match_count] = treble_match;
                g_bass_matches[g_match_count] = bass_match;
            }
        }

        if (treble_match || bass_match) {
            draw_staves();
        }
    }
}
