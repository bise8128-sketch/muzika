/**
 * Pitch Scoring Worker
 * 
 * Aggregates real-time pitch detection frames, matches them against the
 * reference vocal track, calculates precision, and maintains combo streaks.
 * 
 * Runs off the main thread to avoid freezing the UI during analysis.
 */

import { analyzeDetectedPitch, getPerformanceScore } from './pitchAnalysis';
import type { PitchAnalysisResult, PerformanceScore } from '../../types/audio';
import type { KeyInfo } from './keyDetection';

// Define message types locally since we can't easily import them if they depend on DOM types
export interface AddFramePayload {
    frequency: number;
    confidence: number;
    currentTime: number;
    refVocals: { pitch: number; midi: number } | null;
    keyInfo: KeyInfo | null;
}

export interface ScoreUpdatePayload {
    result: PitchAnalysisResult;
    currentCombo: number;
    lastHitType: 'perfect' | 'great' | 'good' | 'miss' | null;
}

export interface FinalStatePayload {
    overallScore: PerformanceScore;
    history: PitchAnalysisResult[];
}

// Worker State
let performanceHistory: PitchAnalysisResult[] = [];
let currentCombo = 0;

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT':
            performanceHistory = [];
            currentCombo = 0;
            break;

        case 'ADD_FRAME': {
            const { frequency, confidence, currentTime, refVocals, keyInfo } = payload as AddFramePayload;

            const result = analyzeDetectedPitch(
                frequency,
                confidence,
                refVocals,
                currentTime,
                keyInfo
            );

            if (result) {
                performanceHistory.push(result);

                // Calculate Hits & Combo
                const isHit = result.accuracy >= 70 || (result.harmonyInterval !== null && result.harmonyAccuracy >= 60);
                if (isHit) {
                    currentCombo++;
                } else if (result.referencePitch > 0) {
                    currentCombo = 0;
                }

                let hitType: 'perfect' | 'great' | 'good' | 'miss' | null = null;
                if (isHit) {
                    if (result.accuracy >= 95) hitType = 'perfect';
                    else if (result.accuracy >= 85) hitType = 'great';
                    else hitType = 'good';
                } else if (result.referencePitch > 0) {
                    hitType = 'miss';
                }

                // Send update back to main thread
                // Note: We don't send the full history array every frame, just the latest result
                const updatePayload: ScoreUpdatePayload = {
                    result,
                    currentCombo,
                    lastHitType: hitType
                };
                
                self.postMessage({
                    type: 'SCORE_UPDATE',
                    payload: updatePayload
                });
            }
            break;
        }

        case 'GET_FINAL_STATE': {
            const overallScore = getPerformanceScore(performanceHistory);
            
            const finalPayload: FinalStatePayload = {
                overallScore,
                history: [...performanceHistory]
            };

            self.postMessage({
                type: 'FINAL_STATE',
                payload: finalPayload
            });
            break;
        }
    }
};
