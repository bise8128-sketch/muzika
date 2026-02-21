import { MidiWriter, MidiEvent } from '../midiWriter';

describe('MidiWriter', () => {
    let writer: MidiWriter;

    beforeEach(() => {
        writer = new MidiWriter(480);
    });

    it('should generate a valid MIDI header', () => {
        const events: MidiEvent[] = [];
        const data = writer.buildFile(events);

        // Header Chunk ID "MThd"
        expect(String.fromCharCode(...data.slice(0, 4))).toBe('MThd');
        // Header Length 6
        expect(data[7]).toBe(6);
        // Format 0
        expect(data[9]).toBe(0);
        // Tracks 1
        expect(data[11]).toBe(1);
        // PPQ 480 (0x01E0)
        expect(data[12]).toBe(0x01);
        expect(data[13]).toBe(0xE0);
    });

    it('should write note events with delta times', () => {
        const events: MidiEvent[] = [
            { ticks: 0, type: 'on', midi: 60, velocity: 100 },
            { ticks: 480, type: 'off', midi: 60, velocity: 0 }
        ];
        const data = writer.buildFile(events);

        // Find track start "MTrk"
        let trackStart = -1;
        for (let i = 0; i < data.length - 3; i++) {
            if (String.fromCharCode(...data.slice(i, i + 4)) === 'MTrk') {
                trackStart = i;
                break;
            }
        }
        expect(trackStart).toBeGreaterThan(0);

        const trackData = data.slice(trackStart + 8); // Skip MTrk + length

        // Event 1: Delta 0, Note On (90), 60, 100
        let idx = 0;
        expect(trackData[idx++]).toBe(0x00); // Delta
        expect(trackData[idx++]).toBe(0x90); // Note On
        expect(trackData[idx++]).toBe(60);
        expect(trackData[idx++]).toBe(100);

        // Event 2: Delta 480 (0x83 0x60 in VLQ), Note Off (80), 60, 0
        // VLQ 480: 480 = 111100000 binary. 
        // 7-bit groups: 011 (3), 1100000 (96).
        // First byte: 10000011 (0x83). Second byte: 01100000 (0x60).
        expect(trackData[idx++]).toBe(0x83);
        expect(trackData[idx++]).toBe(0x60);
        expect(trackData[idx++]).toBe(0x80); // Note Off
        expect(trackData[idx++]).toBe(60);
        expect(trackData[idx++]).toBe(0);
    });

    it('should write lyric meta events (FF 05)', () => {
        const events: MidiEvent[] = [
            { ticks: 0, type: 'meta', subtype: 0x05, data: 'Hi' }
        ];
        const data = writer.buildFile(events);
        
        // Skip header to find track data
        const trackStart = 14 + 8; // Header(14) + MTrk(4) + Len(4)
        const trackData = data.slice(trackStart);

        let idx = 0;
        expect(trackData[idx++]).toBe(0x00); // Delta
        expect(trackData[idx++]).toBe(0xFF); // Meta
        expect(trackData[idx++]).toBe(0x05); // Lyric
        expect(trackData[idx++]).toBe(0x02); // Length 2
        expect(trackData[idx++]).toBe('H'.charCodeAt(0));
        expect(trackData[idx++]).toBe('i'.charCodeAt(0));
    });

    it('should write key signature events (FF 59)', () => {
        // C Major (0 sharps/flats, Major)
        const events: MidiEvent[] = [
            { ticks: 0, type: 'meta', subtype: 0x59, data: [0, 0] }
        ];
        const data = writer.buildFile(events);
        
        const trackStart = 14 + 8;
        const trackData = data.slice(trackStart);

        let idx = 0;
        expect(trackData[idx++]).toBe(0x00); // Delta
        expect(trackData[idx++]).toBe(0xFF); // Meta
        expect(trackData[idx++]).toBe(0x59); // Key Sig
        expect(trackData[idx++]).toBe(0x02); // Length 2
        expect(trackData[idx++]).toBe(0x00); // 0 sharps
        expect(trackData[idx++]).toBe(0x00); // Major
    });

    it('should handle interleaving lyrics and notes', () => {
        const events: MidiEvent[] = [
            { ticks: 0, type: 'on', midi: 60, velocity: 100 },
            { ticks: 10, type: 'meta', subtype: 0x05, data: 'A' },
            { ticks: 20, type: 'off', midi: 60, velocity: 0 }
        ];
        const data = writer.buildFile(events);
        // Validation logic implied by previous tests, just ensuring no crash and correct ordering
        const trackStart = 14 + 8;
        const trackData = data.slice(trackStart);
        
        let idx = 0;
        // Delta 0, Note On
        expect(trackData[idx++]).toBe(0x00); 
        expect(trackData[idx++]).toBe(0x90);
        idx += 2; 

        // Delta 10, Meta Lyric
        expect(trackData[idx++]).toBe(10); 
        expect(trackData[idx++]).toBe(0xFF);
        expect(trackData[idx++]).toBe(0x05);
        expect(trackData[idx++]).toBe(0x01);
        expect(trackData[idx++]).toBe('A'.charCodeAt(0));

        // Delta 10 (20-10), Note Off
        expect(trackData[idx++]).toBe(10);
        expect(trackData[idx++]).toBe(0x80);
    });
});
