import { WhisperSegment } from '../ml/whisperEngine';

/**
 * Utility to generate standard LRC content from Whisper segments.
 */
export class LrcGenerator {
    /**
     * Converts Whisper segments to a .lrc string.
     * @param segments The segments from Whisper transcription.
     * @returns A string in standard LRC format.
     */
    static generate(segments: WhisperSegment[]): string {
        if (!segments || segments.length === 0) return '';

        let lrc = '[ar:Muzika AI]\n[ti:Generated Lyrics]\n[tool:Muzika Automatic Lyric Aligner]\n\n';

        for (const segment of segments) {
            const timestamp = this.formatTimestamp(segment.start);
            // Ensure we don't have empty lines or just whitespace
            const text = segment.text.trim();
            if (text) {
                lrc += `${timestamp}${text}\n`;
            }
        }

        return lrc;
    }

    /**
     * Formats a time in seconds to [mm:ss.xx]
     */
    private static formatTimestamp(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const hundredths = Math.floor((seconds % 1) * 100);

        const mm = mins.toString().padStart(2, '0');
        const ss = secs.toString().padStart(2, '0');
        const xx = hundredths.toString().padStart(2, '0');

        return `[${mm}:${ss}.${xx}]`;
    }
}
