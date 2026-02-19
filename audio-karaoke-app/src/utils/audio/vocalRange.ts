/**
 * VocalRange - Defines common singing ranges and recommendation logic.
 */

import { KeyInfo } from './keyDetection';

export type VocalRangeType = 'soprano' | 'alto' | 'tenor' | 'bass';

export interface VocalRangeProfile {
    name: string;
    centerMidi: number; // The "sweet spot" for this range
    minMidi: number;
    maxMidi: number;
}

export const VOCAL_RANGES: Record<VocalRangeType, VocalRangeProfile> = {
    soprano: { name: 'Soprano', centerMidi: 72, minMidi: 60, maxMidi: 84 }, // C4-C6, sweet spot C5
    alto: { name: 'Alto', centerMidi: 65, minMidi: 53, maxMidi: 77 },    // F3-F5, sweet spot F4
    tenor: { name: 'Tenor', centerMidi: 60, minMidi: 48, maxMidi: 72 },   // C3-C5, sweet spot C4
    bass: { name: 'Bass', centerMidi: 53, minMidi: 41, maxMidi: 65 },    // F2-F4, sweet spot F3
};

/**
 * Get recommended semitone shift based on track key and user's vocal range.
 */
export function getRecommendedShift(trackKey: KeyInfo, rangeType: VocalRangeType): number {
    const profile = VOCAL_RANGES[rangeType];
    const tonicNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const tonicIndex = tonicNames.indexOf(trackKey.tonic);

    if (tonicIndex === -1) return 0;

    // Estimate the melody center based on the key. 
    // Most pop melodies center around the tonic or the 5th in the middle octave (4).
    // Let's assume the "average" melody center for the track is at MIDI note 60 + tonicIndex
    const estimatedMelodyCenter = 60 + tonicIndex;

    // Calculate shift to align melody center with user's sweet spot
    let shift = profile.centerMidi - estimatedMelodyCenter;

    // Normalize shift to [-6, 6] semitones to avoid extreme distortions
    while (shift > 6) shift -= 12;
    while (shift < -6) shift += 12;

    return shift;
}
