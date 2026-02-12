/**
 * Tests for lyricSync utility functions (DTW alignment, text normalization)
 */

import {
    normalizeText,
    editDistance,
    dtwAlign,
    alignLyricsToTranscription,
} from '../../ml/lyricSync';
import type { WhisperSegment, WhisperWord } from '../../ml/lyricSync';

// ── normalizeText ───────────────────────────────────────────────

describe('normalizeText', () => {
    it('should lowercase and strip punctuation', () => {
        expect(normalizeText("Hello, World!")).toBe('hello world');
    });

    it('should collapse whitespace', () => {
        expect(normalizeText("  foo   bar  ")).toBe('foo bar');
    });

    it('should handle empty string', () => {
        expect(normalizeText('')).toBe('');
    });

    it('should preserve Unicode letters', () => {
        expect(normalizeText('Živi Život!')).toBe('živi život');
    });
});

// ── editDistance ─────────────────────────────────────────────────

describe('editDistance', () => {
    it('should return 0 for identical strings', () => {
        expect(editDistance('abc', 'abc')).toBe(0);
    });

    it('should return length for empty vs non-empty', () => {
        expect(editDistance('', 'abc')).toBe(3);
        expect(editDistance('abc', '')).toBe(3);
    });

    it('should calculate single substitution', () => {
        expect(editDistance('abc', 'axc')).toBe(1);
    });

    it('should calculate insertions and deletions', () => {
        expect(editDistance('kitten', 'sitting')).toBe(3);
    });
});

// ── dtwAlign ────────────────────────────────────────────────────

describe('dtwAlign', () => {
    it('should return empty array for empty inputs', () => {
        expect(dtwAlign([], ['hello'])).toEqual([]);
        expect(dtwAlign([{ word: 'hello', start: 0, end: 1, probability: 1 }], [])).toEqual([]);
    });

    it('should align matching words correctly', () => {
        const whisperWords: WhisperWord[] = [
            { word: 'hello', start: 0, end: 0.5, probability: 0.9 },
            { word: 'world', start: 0.5, end: 1.0, probability: 0.9 },
        ];
        const lyricWords = ['hello', 'world'];
        const alignment = dtwAlign(whisperWords, lyricWords);

        expect(alignment).toHaveLength(2);
        // Each lyric word should map to its corresponding whisper word
        expect(alignment[0]).toBe(0);
        expect(alignment[1]).toBe(1);
    });

    it('should handle more whisper words than lyrics', () => {
        const whisperWords: WhisperWord[] = [
            { word: 'oh', start: 0, end: 0.2, probability: 0.8 },
            { word: 'hello', start: 0.2, end: 0.5, probability: 0.9 },
            { word: 'there', start: 0.5, end: 0.8, probability: 0.9 },
            { word: 'world', start: 0.8, end: 1.0, probability: 0.9 },
        ];
        const lyricWords = ['hello', 'world'];
        const alignment = dtwAlign(whisperWords, lyricWords);

        expect(alignment).toHaveLength(2);
        // alignment maps each lyric word to a whisper word index
        expect(alignment[0]).toBeGreaterThanOrEqual(0);
        expect(alignment[1]).toBeGreaterThanOrEqual(alignment[0]);
    });
});

// ── alignLyricsToTranscription ──────────────────────────────────

describe('alignLyricsToTranscription', () => {
    it('should produce lines with word-level timestamps', () => {
        const segments: WhisperSegment[] = [{
            text: 'hello beautiful world',
            start: 0,
            end: 3,
            words: [
                { word: 'hello', start: 0, end: 1, probability: 0.9 },
                { word: 'beautiful', start: 1, end: 2, probability: 0.8 },
                { word: 'world', start: 2, end: 3, probability: 0.9 },
            ],
        }];

        const lyricTexts = ['hello beautiful world'];
        const result = alignLyricsToTranscription(segments, lyricTexts);

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0].words).toHaveLength(3);
        expect(result.lines[0].timestamp).toBe(0);
        expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle multi-line lyrics', () => {
        const segments: WhisperSegment[] = [
            {
                text: 'line one words',
                start: 0,
                end: 2,
                words: [
                    { word: 'line', start: 0, end: 0.5, probability: 0.9 },
                    { word: 'one', start: 0.5, end: 1, probability: 0.9 },
                    { word: 'words', start: 1, end: 2, probability: 0.9 },
                ],
            },
            {
                text: 'line two here',
                start: 2,
                end: 4,
                words: [
                    { word: 'line', start: 2, end: 2.5, probability: 0.9 },
                    { word: 'two', start: 2.5, end: 3, probability: 0.9 },
                    { word: 'here', start: 3, end: 4, probability: 0.9 },
                ],
            },
        ];

        const lyricTexts = ['line one words', 'line two here'];
        const result = alignLyricsToTranscription(segments, lyricTexts);

        expect(result.lines).toHaveLength(2);
        expect(result.lines[0].words?.length).toBe(3);
        expect(result.lines[1].words?.length).toBe(3);
    });

    it('should handle segment-level fallback when no words', () => {
        const segments: WhisperSegment[] = [{
            text: 'just a segment',
            start: 1,
            end: 3,
        }];

        const lyricTexts = ['just a segment'];
        const result = alignLyricsToTranscription(segments, lyricTexts);

        expect(result.lines).toHaveLength(1);
    });
});
