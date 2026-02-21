# [FI-10-ENH] MIDI Lyrics: Technical Specification & Implementation Strategy

## 1. Executive Summary
This feature enhances the `MidiExporter` module to embed synchronized lyrics into exported Standard MIDI Files (SMF). By leveraging the existing `lrcParser` and extending the `MidiWriter`, we will enable users to export karaoke-ready MIDI files compatible with professional DAWs (Logic Pro, Cubase) and hardware players. This cements the product as a professional tool for portable music production.

## 2. Mathematical Conversion: Time to Ticks

To ensure precise synchronization, we must convert LRC timestamps (seconds) to MIDI ticks.

### Formula Derivation
The current system uses fixed parameters for MIDI export:
- **PPQ (Pulses Per Quarter Note)**: 480
- **Tempo**: 120 BPM (Beats Per Minute)

1.  **Ticks per Beat**: 480 ticks
2.  **Beats per Second**: $120 \text{ BPM} / 60 = 2 \text{ beats/second}$
3.  **Ticks per Second**: $480 \text{ ticks/beat} \times 2 \text{ beats/second} = 960 \text{ ticks/second}$

### Conversion Function
Given an LRC timestamp $T_{sec}$ (e.g., `[00:12.50]` $\rightarrow$ 12.5s):

$$ T_{ticks} = \text{round}(T_{sec} \times 960) $$

*Example:*
- LRC: `[00:01.00] Hello` -> 1.0 seconds
- MIDI Ticks: $1.0 \times 960 = 960$ ticks

## 3. Optimal Track Structure Analysis

We analyzed two common SMF formats to determine the optimal structure for compatibility:

### Option A: SMF Type 0 (Single Track) - **SELECTED**
- **Structure**: All data (Tempo, Time Signature, Lyrics, Notes) is merged into a single track.
- **Pros**: 
    - Highest compatibility with older hardware karaoke players.
    - Simpler to implement (extends existing `MidiWriter` logic).
    - No risk of "losing" the lyric track on import in simpler software.
- **Cons**: Harder to edit specific event types separately in some DAWs (though professional DAWs filter easily).

### Option B: SMF Type 1 (Multiple Tracks)
- **Structure**: Track 1 = Conductor (Tempo, Lyrics); Track 2 = Notes.
- **Pros**: Cleaner separation for DAW editing.
- **Cons**: Some hardware players ignore Track 1 lyrics if they expect them interleaved with notes. Requires significant refactor of `MidiWriter` to handle multiple tracks.

**Decision**: We will proceed with **SMF Type 0**. To ensure professional compatibility, we will interleave **Lyric Meta Events (FF 05)** chronologically with **Note On/Off** events. This ensures that a player reading the stream encounters the lyric text exactly when it is needed, regardless of whether it buffers the whole track or streams it.

## 4. Implementation Strategy

### 4.1. Data Structures

We will introduce a `MidiMetaEvent` interface to the `MidiWriter`.

```typescript
// Current
export interface MidiNoteEvent {
    ticks: number;
    type: 'on' | 'off';
    midi: number;
    velocity: number;
}

// Proposed Extension
export interface MidiMetaEvent {
    ticks: number;
    type: 'meta';
    subtype: number; // e.g., 0x05 for Lyrics, 0x59 for Key Signature
    data: number[] | string; // byte array or text
}

export type MidiEvent = MidiNoteEvent | MidiMetaEvent;
```

### 4.2. `MidiWriter` Extensions
The `buildTrackData` method in `audio-karaoke-app/src/utils/audio/midiWriter.ts` will be updated to handle the `meta` type.

**Algorithm for Meta Events:**
1.  Calculate delta time.
2.  Write Delta Time (VLQ).
3.  Write Status Byte: `0xFF` (Meta Event).
4.  Write Subtype Byte (e.g., `0x05`).
5.  Write Length (VLQ).
6.  Write Data Bytes.

### 4.3. `MidiExporter` Logic Flow
1.  **Input**: AudioBuffer, Filename, Options (`lrcContent`, `keyInfo`).
2.  **Audio Analysis**: Run existing Pitch Detection worker.
3.  **LRC Parsing**: Use `lrcParser.parseLRC(lrcContent)` to get lines and timestamps.
4.  **Event Generation**:
    - Convert Pitch Map $\rightarrow$ Note Events (existing).
    - Convert LRC Lines $\rightarrow$ Lyric Meta Events (new).
    - Convert KeyInfo $\rightarrow$ Key Signature Event (new).
5.  **Merge & Sort**: Combine all events into a single array and sort strictly by `ticks`.
6.  **Write**: Pass sorted events to `MidiWriter`.

### 4.4. Strategic Analysis: Industry Standard Tool
By implementing **FF 05 (Lyrics)** and **FF 59 (Key Signature)**, we elevate the export from "raw notes" to "musical score".
-   **Singers**: Can practice with hardware players that display lyrics.
-   **Producers**: Can import the MIDI into Logic/Cubase and immediately see the song structure via lyrics and correct key signature.
-   **Remixers**: Have a ground-truth map of the vocal phrasing aligned with the notes.

This feature directly addresses the "portability" pillar of the product vision.
