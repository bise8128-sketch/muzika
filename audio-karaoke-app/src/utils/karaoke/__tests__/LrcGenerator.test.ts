import { LrcGenerator } from '../LrcGenerator';
import { WhisperSegment } from '../ml/whisperEngine';

describe('LrcGenerator', () => {
    it('should generate valid LRC content from segments', () => {
        const segments: WhisperSegment[] = [
            { text: ' Hello world', start: 0.5, end: 1.5 },
            { text: ' This is a test', start: 2.0, end: 4.5 }
        ];

        const lrc = LrcGenerator.generate(segments);

        expect(lrc).toContain('[ar:Muzika AI]');
        expect(lrc).toContain('[00:00.50]Hello world');
        expect(lrc).toContain('[00:02.00]This is a test');
    });

    it('should handle minutes in timestamps', () => {
        const segments: WhisperSegment[] = [
            { text: ' Long time', start: 65.5, end: 67.0 }
        ];

        const lrc = LrcGenerator.generate(segments);
        expect(lrc).toContain('[01:05.50]Long time');
    });

    it('should return empty header for empty segments', () => {
        const lrc = LrcGenerator.generate([]);
        expect(lrc).toBe('');
    });
});
