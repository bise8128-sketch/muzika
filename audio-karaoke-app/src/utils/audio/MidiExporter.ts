/**
 * MidiExporter - Orchestrates Audio to MIDI conversion.
 */

import { MidiWriter, MidiNoteEvent } from './midiWriter';
import { downloadBlob } from './audioExporter';

export interface MidiExportOptions {
    onProgress?: (progress: number) => void;
    minNoteDurationMs?: number;
    velocity?: number;
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
        const events = this.transcribeToMidiEvents(pitchMap, audioBuffer.sampleRate, minNoteDurationMs, velocity);

        // 3. Generate SMF binary
        const writer = new MidiWriter();
        const midiData = writer.buildFile(events);

        // 4. Download
        const blob = new Blob([midiData], { type: 'audio/midi' });
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
        velocity: number
    ): MidiNoteEvent[] {
        const events: MidiNoteEvent[] = [];
        const ppq = 480;
        const bpm = 120;
        const ticksPerSec = (bpm / 60) * ppq; // standard BPM 120

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
}
