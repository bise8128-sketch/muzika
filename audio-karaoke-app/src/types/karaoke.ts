/**
 * Karaoke and Lyric type definitions
 */

export interface LyricLine {
  startTime: number; // In seconds
  endTime: number; // In seconds
  text: string;
  translation?: string; // Translated text
  words?: LyricWord[]; // Optional word-level timing
}

export interface LyricWord {
  startTime: number;
  endTime: number;
  text: string;
}

export interface VisualSettings {
  highlightColor: string;
  fontSize: "sm" | "base" | "lg" | "xl";
  fontWeight: "normal" | "bold" | "extrabold";
  textShadow: boolean;
  offset: number; // In milliseconds
  showDualText: boolean;
  visualizationMode:
    | "bars"
    | "waveform"
    | "3d-landscape"
    | "spectrogram"
    | "fluid";
  autoQuality: boolean;
  ghostMode?: boolean;
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
