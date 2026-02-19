/**
 * KeyDetector - Chromagram-based key detection utility.
 * 
 * Legacy wrapper around the pure functional core in keyDetectionCore.ts.
 * Kept for backward compatibility and synchronous testing if needed.
 */

import { analyzeKeyFromPCM, KeyInfo } from './keyDetectionCore';

export type { KeyInfo };

export class KeyDetector {
    /**
     * Detect the key of an audio buffer.
     * Delegates to the pure core logic.
     */
    static analyzeKey(buffer: AudioBuffer): KeyInfo {
        const sampleRate = buffer.sampleRate;
        const channelData = buffer.getChannelData(0);
        
        return analyzeKeyFromPCM(channelData, sampleRate);
    }
}
