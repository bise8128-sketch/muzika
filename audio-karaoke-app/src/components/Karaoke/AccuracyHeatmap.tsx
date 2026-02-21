'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PitchAnalysisResult } from '@/types/audio';

interface AccuracyHeatmapProps {
    history: PitchAnalysisResult[];
    duration?: number;
}

export const AccuracyHeatmap: React.FC<AccuracyHeatmapProps> = ({ history, duration }) => {
    // Process history into "buckets" for the heatmap
    // We want about 100 segments for a smooth timeline
    const segments = useMemo(() => {
        if (history.length === 0) return [];
        
        const numSegments = 100;
        const startTime = history[0].timestamp;
        const endTime = history[history.length - 1].timestamp;
        const totalTime = endTime - startTime;
        
        if (totalTime <= 0) return [];

        const result = [];
        const segmentDuration = totalTime / numSegments;

        for (let i = 0; i < numSegments; i++) {
            const segStart = startTime + i * segmentDuration;
            const segEnd = segStart + segmentDuration;
            
            // Find all results in this segment
            const segResults = history.filter(h => h.timestamp >= segStart && h.timestamp < segEnd);
            
            if (segResults.length === 0) {
                result.push({ accuracy: -1 }); // -1 means no data (silence)
                continue;
            }

            // Average accuracy of scored notes in this segment
            const scored = segResults.filter(h => h.referencePitch > 0);
            if (scored.length === 0) {
                result.push({ accuracy: -1 });
                continue;
            }

            const avgAcc = scored.reduce((sum, h) => sum + h.accuracy, 0) / scored.length;
            result.push({ accuracy: avgAcc });
        }
        
        return result;
    }, [history]);

    if (segments.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Performance Timeline</span>
                <div className="flex gap-4">
                    <LegendItem color="bg-emerald-400" label="Perfect" />
                    <LegendItem color="bg-amber-400" label="Good" />
                    <LegendItem color="bg-red-500" label="Miss" />
                </div>
            </div>

            <div className="relative h-12 w-full bg-white/5 rounded-2xl overflow-hidden border border-white/5 flex p-1 gap-0.5">
                {segments.map((seg, i) => (
                    <motion.div
                        key={i}
                        initial={{ scaleY: 0, opacity: 0 }}
                        animate={{ scaleY: 1, opacity: 1 }}
                        transition={{ delay: 0.01 * i, duration: 0.3 }}
                        className="flex-1 h-full rounded-sm"
                        style={{
                            backgroundColor: seg.accuracy === -1 
                                ? 'transparent' 
                                : seg.accuracy >= 70 
                                    ? '#34d399' // emerald-400
                                    : seg.accuracy >= 40 
                                        ? '#fbbf24' // amber-400
                                        : '#ef4444', // red-500
                            opacity: seg.accuracy === -1 ? 0.1 : 0.8
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
    <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-[9px] font-bold uppercase tracking-tighter text-white/20">{label}</span>
    </div>
);
