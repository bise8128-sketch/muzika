/**
 * Karaoke and Lyric type definitions
 */

export interface LyricLine {
    startTime: number; // In seconds
    endTime: number;   // In seconds
    text: string;
    words?: LyricWord[]; // Optional word-level timing
}

export interface LyricWord {
    startTime: number;
    endTime: number;
    text: string;
}

export interface LRCData {
    lines: LyricLine[];
    metadata: {
        title?: string;
        artist?: string;
        album?: string;
        offset?: number; // In milliseconds
        [key: string]: any;
    };
}

export interface KaraokeState {
    isPlaying: boolean;
    currentTime: number;
    currentLineIndex: number;
    currentLyric: string;
    vocalsVolume: number;
    instrumentalVolume: number;
    pitch: number;
    tempo: number;
}
