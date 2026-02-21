/**
 * MidiExporter - Orchestrates Audio to MIDI conversion.
 */

import { MidiWriter, MidiEvent, MidiNoteEvent, MidiMetaEvent } from './midiWriter';
import { downloadBlob } from './audioExporter';
import { parseLRC } from '../karaoke/lrcParser';
import { KeyInfo } from './keyDetectionCore';

export interface MidiExportOptions {
    onProgress?: (progress: number) => void;
    minNoteDurationMs?: number;
    velocity?: number;
    lrcContent?: string;
    keyInfo?: KeyInfo;
}

export class MidiExporter {
    private static worker: Worker | null = null;

    private static getWorker(): Worker {
        if (!this.worker) {
            this.worker = new Worker(new URL('./pitchAnalysis.worker.ts', import.meta.url));
        }
        return this.worker;
    }

    /**
     * Convert an AudioBuffer (typically a vocal stem) to MIDI and trigger download.
     */
    public static async exportAudioToMidi(
        audioBuffer: AudioBuffer,
        filename: string,
        options: MidiExportOptions = {}
    ): Promise<void> {
        const { minNoteDurationMs = 100, velocity = 100 } = options;
        const worker = this.getWorker();

        // 1. Identify raw pitch sequence using worker
        const pitchMap = await this.getPitchMapFromBuffer(audioBuffer, worker);
        
        if (pitchMap.length === 0) {
            throw new Error('No pitches detected in the audio.');
        }

        // 2. Consolidate frames into discrete MIDI notes
        const events = this.transcribeToMidiEvents(
            pitchMap,
            audioBuffer.sampleRate,
            minNoteDurationMs,
            velocity,
            options.lrcContent,
            options.keyInfo
        );

        // 3. Generate SMF binary
        const writer = new MidiWriter();
        const midiData = writer.buildFile(events);

        // 4. Download
        const blob = new Blob([midiData as unknown as BlobPart], { type: 'audio/midi' });
        downloadBlob(blob, filename.endsWith('.mid') ? filename : `${filename}.mid`);
    }

    private static getPitchMapFromBuffer(
        audioBuffer: AudioBuffer,
        worker: Worker
    ): Promise<{ timestamp: number; pitch: number; midi: number }[]> {
        return new Promise((resolve, reject) => {
            const channelData = audioBuffer.getChannelData(0);
            
            const handleMessage = (e: MessageEvent) => {
                if (e.data.type === 'PITCH_MAP_READY') {
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    resolve(e.data.payload.pitchMap);
                } else if (e.data.type === 'ERROR') {
                    worker.removeEventListener('message', handleMessage);
                    worker.removeEventListener('error', handleError);
                    reject(new Error(e.data.payload.error));
                }
            };

            const handleError = (err: ErrorEvent) => {
                worker.removeEventListener('message', handleMessage);
                worker.removeEventListener('error', handleError);
                reject(new Error(err.message));
            };

            worker.addEventListener('message', handleMessage);
            worker.addEventListener('error', handleError);

            worker.postMessage({
                type: 'ANALYZE_BUFFER',
                payload: {
                    buffer: channelData,
                    sampleRate: audioBuffer.sampleRate
                }
            });
        });
    }

    private static transcribeToMidiEvents(
        pitchMap: { timestamp: number; pitch: number; midi: number }[],
        sampleRate: number,
        minDurationMs: number,
        velocity: number,
        lrcContent?: string,
        keyInfo?: KeyInfo
    ): MidiEvent[] {
        const events: MidiEvent[] = [];
        const ppq = 480;
        const bpm = 120;
        const ticksPerSec = (bpm / 60) * ppq; // standard BPM 120

        // 1. Add Key Signature if provided
        if (keyInfo) {
            const keyBytes = this.getKeySignatureBytes(keyInfo);
            events.push({
                ticks: 0,
                type: 'meta',
                subtype: 0x59, // Key Signature
                data: keyBytes
            });
        }

        // 2. Add Lyrics if provided
        if (lrcContent) {
            const parsedLrc = parseLRC(lrcContent);
            if (parsedLrc && parsedLrc.lines) {
                parsedLrc.lines.forEach(line => {
                    // LyricLine uses startTime in seconds
                    const ticks = Math.round(line.startTime * ticksPerSec);
                    events.push({
                        ticks: ticks,
                        type: 'meta',
                        subtype: 0x05, // Lyric
                        data: line.text
                    });
                });
            }
        }

        // 3. Process Note Events
        const minDurationTicks = (minDurationMs / 1000) * ticksPerSec;
        
        let currentNoteMidi: number | null = null;
        let noteStartTicks = 0;

        const finalizeNote = (endTicks: number) => {
            if (currentNoteMidi !== null && (endTicks - noteStartTicks) >= minDurationTicks) {
                events.push({
                    ticks: Math.round(noteStartTicks),
                    type: 'on',
                    midi: currentNoteMidi,
                    velocity
                });
                events.push({
                    ticks: Math.round(endTicks),
                    type: 'off',
                    midi: currentNoteMidi,
                    velocity
                });
            }
        };

        const GAP_THRESHOLD_SEC = 0.1;

        for (let i = 0; i < pitchMap.length; i++) {
            const frame = pitchMap[i];
            const roundedMidi = Math.round(frame.midi);
            const ticks = frame.timestamp * ticksPerSec;

            const isNewNote = currentNoteMidi === null ||
                             roundedMidi !== currentNoteMidi ||
                             (i > 0 && frame.timestamp - pitchMap[i-1].timestamp > GAP_THRESHOLD_SEC);

            if (isNewNote) {
                // End previous note if any
                if (currentNoteMidi !== null) {
                    const prevTicks = pitchMap[i-1].timestamp * ticksPerSec + (ticksPerSec * 0.02); // add a small buffer
                    finalizeNote(prevTicks);
                }
                
                currentNoteMidi = roundedMidi;
                noteStartTicks = ticks;
            }
        }

        // Finalize last note
        if (currentNoteMidi !== null && pitchMap.length > 0) {
            finalizeNote(pitchMap[pitchMap.length - 1].timestamp * ticksPerSec + (ticksPerSec * 0.02));
        }

        return events;
    }

    private static getKeySignatureBytes(keyInfo: KeyInfo): number[] {
        const sfMap: { [key: string]: number } = {
            'C': 0, 'Am': 0,
            'G': 1, 'Em': 1,
            'D': 2, 'Bm': 2,
            'A': 3, 'F#m': 3,
            'E': 4, 'C#m': 4,
            'B': 5, 'G#m': 5,
            'F#': 6, 'D#m': 6, 'Gb': -6, 'Ebm': -6,
            'C#': 7, 'A#m': 7, 'Db': -5, 'Bbm': -5,
            'F': -1, 'Dm': -1,
            'Bb': -2, 'Gm': -2,
            'Eb': -3, 'Cm': -3,
            'Ab': -4, 'Fm': -4,
            'Cb': -7, 'Abm': -7
        };

        // Normalize tonic
        const tonic = keyInfo.tonic.replace('♯', '#').replace('♭', 'b');
        
        let lookupKey = tonic;
        if (keyInfo.scale === 'minor') {
            lookupKey += 'm';
        }

        let sf = sfMap[lookupKey];
        
        // Fallback or handle enharmonics if undefined
        if (sf === undefined) {
             sf = 0;
        }

        const mi = keyInfo.scale === 'minor' ? 1 : 0;
        
        // sf is signed int8. JS numbers are doubles.
        // Need to convert negative numbers to 2's complement byte?
        // No, MidiWriter likely handles simple numbers, but let's check writeVLQ...
        // Wait, data bytes in MidiMetaEvent are passed as `number[]`.
        // If I pass -1, will `data.push(-1)` work?
        // `Uint8Array` or normal array push? Normal array.
        // But when writing to Uint8Array later, it expects 0-255.
        // So I must convert -1 to 255, -2 to 254, etc.
        
        const sfByte = sf < 0 ? 256 + sf : sf;
        
        return [sfByte, mi];
    }
}
