/**
 * LyricSync — AI-powered lyric synchronization engine.
 *
 * Pipeline:
 * 1. Transcribe audio with Whisper ONNX → timestamped word segments
 * 2. Align Whisper output against user-provided lyrics via DTW
 * 3. Produce word-level timestamps for the original lyrics
 */

import type { LyricLine, LyricWord } from '../../types/karaoke';

// ─── Types ──────────────────────────────────────────────────────────

export interface WhisperSegment {
    text: string;
    start: number; // seconds
    end: number;
    words?: WhisperWord[];
}

export interface WhisperWord {
    word: string;
    start: number;
    end: number;
    probability: number;
}

export interface SyncProgress {
    stage: 'loading-model' | 'transcribing' | 'aligning' | 'done' | 'error';
    progress: number; // 0–1
    message: string;
}

export interface SyncResult {
    lines: LyricLine[];
    confidence: number; // overall confidence 0–1
}

// ─── DTW Alignment ──────────────────────────────────────────────────

/**
 * Normalise text for comparison: lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Simple edit-distance (Levenshtein) between two strings.
 * Used as the cost function in DTW.
 */
export function editDistance(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        new Array(b.length + 1).fill(0)
    );

    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }

    return dp[a.length][b.length];
}

/**
 * Dynamic Time Warping to align Whisper word segments to lyric words.
 *
 * @param whisperWords - Timestamped words from Whisper
 * @param lyricWords   - User-provided lyric words (in order)
 * @returns Mapping from lyricWords index → matched whisperWords index
 */
export function dtwAlign(
    whisperWords: WhisperWord[],
    lyricWords: string[]
): number[] {
    const m = lyricWords.length;
    const n = whisperWords.length;

    if (m === 0 || n === 0) return [];

    // Cost matrix
    const cost: number[][] = Array.from({ length: m + 1 }, () =>
        new Array(n + 1).fill(Infinity)
    );
    cost[0][0] = 0;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            const d = editDistance(
                normalizeText(lyricWords[i - 1]),
                normalizeText(whisperWords[j - 1].word)
            );
            cost[i][j] = d + Math.min(
                cost[i - 1][j],
                cost[i][j - 1],
                cost[i - 1][j - 1]
            );
        }
    }

    // Backtrack to find the alignment path
    const alignment: number[] = new Array(m).fill(-1);
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        alignment[i - 1] = j - 1;
        const diag = cost[i - 1][j - 1];
        const up = cost[i - 1][j];
        const left = cost[i][j - 1];
        const best = Math.min(diag, up, left);

        if (best === diag) {
            i--;
            j--;
        } else if (best === up) {
            i--;
        } else {
            j--;
        }
    }

    return alignment;
}

/**
 * Given Whisper segments and the user's original lyrics (as text lines),
 * produce aligned LyricLines with word-level timestamps.
 */
export function alignLyricsToTranscription(
    segments: WhisperSegment[],
    lyricTexts: string[]
): SyncResult {
    // Flatten Whisper words (or fall back to segment-level)
    const whisperWords: WhisperWord[] = [];
    for (const seg of segments) {
        if (seg.words && seg.words.length > 0) {
            whisperWords.push(...seg.words);
        } else {
            // Segment-level fallback: treat whole segment as one word
            whisperWords.push({
                word: seg.text.trim(),
                start: seg.start,
                end: seg.end,
                probability: 1,
            });
        }
    }

    // Split user lyrics into words (preserve line structure)
    const lineWordData: { lineIdx: number; words: string[] }[] = lyricTexts.map(
        (text, lineIdx) => ({
            lineIdx,
            words: text.split(/\s+/).filter(w => w.length > 0),
        })
    );

    // Flatten all lyric words for DTW alignment
    const allLyricWords = lineWordData.flatMap(l => l.words);
    const alignment = dtwAlign(whisperWords, allLyricWords);

    // Reconstruct lines with timestamps
    let wordOffset = 0;
    const lines: LyricLine[] = [];
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const ld of lineWordData) {
        const words: LyricWord[] = [];
        let lineStart = Infinity;
        let lineEnd = 0;

        for (let wi = 0; wi < ld.words.length; wi++) {
            const globalIdx = wordOffset + wi;
            const matchedIdx = alignment[globalIdx];

            if (matchedIdx >= 0 && matchedIdx < whisperWords.length) {
                const ww = whisperWords[matchedIdx];
                words.push({
                    text: ld.words[wi],
                    startTime: ww.start,
                    endTime: ww.end,
                });
                lineStart = Math.min(lineStart, ww.start);
                lineEnd = Math.max(lineEnd, ww.end);
                totalConfidence += ww.probability;
                confidenceCount++;
            } else {
                // Unmatched word: estimate from neighbours
                words.push({
                    text: ld.words[wi],
                    startTime: 0,
                    endTime: 0,
                });
            }
        }

        wordOffset += ld.words.length;

        lines.push({
            text: lyricTexts[ld.lineIdx],
            timestamp: lineStart === Infinity ? 0 : lineStart,
            endTimestamp: lineEnd,
            words,
        });
    }

    return {
        lines,
        confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
    };
}
