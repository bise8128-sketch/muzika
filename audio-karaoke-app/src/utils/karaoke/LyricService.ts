import { WhisperEngine } from '../ml/whisperEngine';
import { LyricFetcher } from './LyricFetcher';
import { resampleAudio } from '../audio/audioBufferUtils';
import { ModelType } from '@/types/model';

export interface LyricServiceOptions {
    artist?: string;
    title?: string;
    duration?: number;
    skipFetch?: boolean;
}

export class LyricService {
    /**
     * Coordinate lyric acquisition: Fetch (LRCLIB) -> Fallback Transcribe (Whisper)
     */
    static async acquireLyrics(vocalBuffer: AudioBuffer, options: LyricServiceOptions = {}): Promise<string | null> {
        const { artist, title, duration, skipFetch = false } = options;

        // 1. Try fetching from LRCLIB first
        if (!skipFetch && artist && title) {
            console.log(`[LyricService] Attempting to fetch lyrics for ${artist} - ${title}`);
            const fetched = await LyricFetcher.fetchLyrics(artist, title, duration);
            if (fetched) {
                console.log(`[LyricService] Successfully fetched lyrics for ${title}`);
                return fetched;
            }
        }

        // 2. Fallback to Whisper transcription
        try {
            console.log(`[LyricService] Starting automatic transcription fallback`);
            // Resample to 16kHz for Whisper
            const resampled = await resampleAudio(vocalBuffer, 16000);
            const monoData = resampled.getChannelData(0);

            const whisper = new WhisperEngine();
            await whisper.load({
                id: 'whisper-tiny-en',
                type: ModelType.WHISPER,
                name: 'Whisper Tiny (EN)',
                version: '1.0.0',
                size: 40 * 1024 * 1024
            });

            const transcribed = await whisper.transcribeToLrc(monoData);
            console.log(`[LyricService] Successfully transcribed lyrics`);
            return transcribed;
        } catch (error) {
            console.warn('[LyricService] Lyric acquisition failed:', error);
            return null;
        }
    }
}
