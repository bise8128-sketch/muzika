/**
 * Lightweight Standard MIDI File (SMF) Writer
 * Supports SMF Type 0 (Single Track)
 */

export interface MidiNoteEvent {
    ticks: number;
    type: 'on' | 'off';
    midi: number;
    velocity: number;
}

export class MidiWriter {
    private buffer: number[] = [];
    private ppq: number = 480;

    constructor(ppq: number = 480) {
        this.ppq = ppq;
    }

    /**
     * Encode a Standard MIDI File from a list of absolute tick events
     */
    public buildFile(events: MidiNoteEvent[]): Uint8Array {
        this.buffer = [];
        
        // 1. Header Chunk
        this.addString('MThd');
        this.addUint32(6);      // Header length
        this.addUint16(0);      // Format 0 (single track)
        this.addUint16(1);      // Number of tracks
        this.addUint16(this.ppq); // Ticks per quarter note

        // 2. Track Chunk
        const trackData = this.buildTrackData(events);
        this.addString('MTrk');
        this.addUint32(trackData.length);
        this.addBytes(trackData);

        return new Uint8Array(this.buffer);
    }

    private buildTrackData(events: MidiNoteEvent[]): number[] {
        const data: number[] = [];
        let lastTicks = 0;

        // Sort events by absolute ticks
        const sortedEvents = [...events].sort((a, b) => a.ticks - b.ticks);

        for (const event of sortedEvents) {
            const delta = event.ticks - lastTicks;
            this.writeVLQ(data, delta);

            if (event.type === 'on') {
                data.push(0x90); // Note On (Channel 0)
                data.push(event.midi & 0x7F);
                data.push(event.velocity & 0x7F);
            } else {
                data.push(0x80); // Note Off (Channel 0)
                data.push(event.midi & 0x7F);
                data.push(event.velocity & 0x7F);
            }
            lastTicks = event.ticks;
        }

        // End of Track Meta Event (0xFF 0x2F 0x00)
        this.writeVLQ(data, 0); // Delta time 0
        data.push(0xFF, 0x2F, 0x00);

        return data;
    }

    private writeVLQ(target: number[], value: number): void {
        const buffer: number[] = [];
        let v = value;
        
        // Split into 7-bit chunks
        buffer.push(v & 0x7F);
        while (v > 0x7F) {
            v >>= 7;
            buffer.push((v & 0x7F) | 0x80);
        }
        
        // Reverse and add to target
        for (let i = buffer.length - 1; i >= 0; i--) {
            target.push(buffer[i]);
        }
    }

    private addString(s: string): void {
        for (let i = 0; i < s.length; i++) {
            this.buffer.push(s.charCodeAt(i));
        }
    }

    private addUint32(v: number): void {
        this.buffer.push((v >> 24) & 0xFF);
        this.buffer.push((v >> 16) & 0xFF);
        this.buffer.push((v >> 8) & 0xFF);
        this.buffer.push(v & 0xFF);
    }

    private addUint16(v: number): void {
        this.buffer.push((v >> 8) & 0xFF);
        this.buffer.push(v & 0xFF);
    }

    private addBytes(bytes: number[]): void {
        for (const b of bytes) {
            this.buffer.push(b);
        }
    }
}
