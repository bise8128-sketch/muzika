import React, { useEffect, useRef } from 'react';
import { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import { PitchAnalysisResult, StageTheme } from '@/types/karaoke';
import { getReferencePitchAtTime } from '@/utils/audio/pitchAnalysis';

interface NoteHighwayProps {
    controller: PlaybackController;
    pitchHistory: PitchAnalysisResult[];
    stageTheme: StageTheme;
    width?: number;
    height?: number;
    className?: string;
}

const LOOKAHEAD_TIME = 4; // Seconds to look ahead
const HISTORY_TIME = 1; // Seconds to look behind
const MIN_PITCH = 36; // C2
const MAX_PITCH = 84; // C6
const PITCH_RANGE = MAX_PITCH - MIN_PITCH;

export const NoteHighway: React.FC<NoteHighwayProps> = ({
    controller,
    pitchHistory,
    stageTheme,
    width = 800,
    height = 200,
    className
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>();

    // Theme Config
    const getThemeConfig = (theme: StageTheme) => {
        switch (theme) {
            case 'neon-tokyo':
                return {
                    targetColor: '#e11d48', // Rose 600
                    targetGlow: '#fb7185', // Rose 400
                    userColor: '#22d3ee', // Cyan 400
                    userGlow: '#67e8f9', // Cyan 300
                    gridColor: 'rgba(255, 255, 255, 0.1)',
                    particleColor: '#f472b6',
                    lineWidth: 4,
                };
            case 'acoustic-lounge':
                return {
                    targetColor: '#d97706', // Amber 600
                    targetGlow: '#fcd34d', // Amber 300
                    userColor: '#f59e0b', // Amber 500
                    userGlow: '#fbbf24', // Amber 400
                    gridColor: 'rgba(255, 237, 213, 0.1)', // Orange 100
                    particleColor: '#fbbf24',
                    lineWidth: 3,
                };
            case 'grand-opera':
                return {
                    targetColor: '#b91c1c', // Red 700
                    targetGlow: '#ef4444', // Red 500
                    userColor: '#facc15', // Yellow 400
                    userGlow: '#fef08a', // Yellow 200
                    gridColor: 'rgba(255, 215, 0, 0.05)',
                    particleColor: '#facc15',
                    lineWidth: 5,
                };
            default:
                return {
                    targetColor: '#fff',
                    targetGlow: '#fff',
                    userColor: '#fff',
                    userGlow: '#fff',
                    gridColor: 'rgba(255,255,255,0.1)',
                    particleColor: '#fff',
                    lineWidth: 2,
                };
        }
    };

    const draw = (time: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const config = getThemeConfig(stageTheme);
        const { width, height } = canvas;
        const currentTime = controller.getCurrentTime();
        
        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw Grid (Horizontal Pitch Lines)
        ctx.strokeStyle = config.gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = MIN_PITCH; i <= MAX_PITCH; i += 12) { // Octaves
            const y = height - ((i - MIN_PITCH) / PITCH_RANGE) * height;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();

        // Draw "Now" Line
        const nowX = (HISTORY_TIME / (LOOKAHEAD_TIME + HISTORY_TIME)) * width;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(nowX, 0);
        ctx.lineTo(nowX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Get Audio Buffer
        const buffers = controller.getAudioBuffers();
        const vocalBuffer = buffers[0]; // Assuming vocals are first

        // Helper: Map Time to X
        const timeToX = (t: number) => {
            const relativeTime = t - (currentTime - HISTORY_TIME);
            return (relativeTime / (LOOKAHEAD_TIME + HISTORY_TIME)) * width;
        };

        // Helper: Map Pitch to Y
        const pitchToY = (midi: number) => {
            return height - ((midi - MIN_PITCH) / PITCH_RANGE) * height;
        };

        // 1. Draw Target Path (Melody)
        if (vocalBuffer) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = config.lineWidth;
            ctx.strokeStyle = config.targetColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = config.targetGlow;

            ctx.beginPath();
            let firstPoint = true;

            // Sample every 50ms
            const step = 0.05;
            const startTime = Math.max(0, currentTime - HISTORY_TIME);
            const endTime = currentTime + LOOKAHEAD_TIME;

            for (let t = startTime; t <= endTime; t += step) {
                const pitchData = getReferencePitchAtTime(vocalBuffer, t);
                if (pitchData && pitchData.midi > 0) {
                    const x = timeToX(t);
                    const y = pitchToY(pitchData.midi);
                    
                    if (firstPoint) {
                        ctx.moveTo(x, y);
                        firstPoint = false;
                    } else {
                        // Check if jump is too big (new phrase)
                        const prevPitchData = getReferencePitchAtTime(vocalBuffer, t - step);
                        if (prevPitchData && Math.abs(prevPitchData.midi - pitchData.midi) > 5) {
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                } else {
                    if (!firstPoint) {
                        ctx.stroke(); // End current line
                        ctx.beginPath();
                        firstPoint = true;
                    }
                }
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow
        }

        // 2. Draw User Path (Sung Pitch)
        if (pitchHistory.length > 0) {
            ctx.lineWidth = config.lineWidth;
            ctx.strokeStyle = config.userColor;
            ctx.shadowBlur = 15;
            ctx.shadowColor = config.userGlow;

            ctx.beginPath();
            let firstUserPoint = true;

            // Filter history for visible range
            const visibleHistory = pitchHistory.filter(p => 
                p.timestamp >= currentTime - HISTORY_TIME && 
                p.timestamp <= currentTime
            );

            visibleHistory.forEach((p, i) => {
                if (p.detectedPitch > 0) {
                    const x = timeToX(p.timestamp);
                    // Convert Hz to Midi roughly for visualization: 69 + 12 * log2(freq / 440)
                    const midi = 69 + 12 * Math.log2(p.detectedPitch / 440);
                    const y = pitchToY(midi);

                    if (firstUserPoint) {
                        ctx.moveTo(x, y);
                        firstUserPoint = false;
                    } else {
                         // Check for large jumps
                        const prev = visibleHistory[i-1];
                        const prevMidi = 69 + 12 * Math.log2(prev.detectedPitch / 440);
                         if (Math.abs(prevMidi - midi) > 5) {
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(x, y);
                         } else {
                            ctx.lineTo(x, y);
                         }
                    }
                } else {
                    if (!firstUserPoint) {
                         ctx.stroke();
                         ctx.beginPath();
                         firstUserPoint = true;
                    }
                }
            });
            ctx.stroke();
            ctx.shadowBlur = 0;
            
            // Draw current cursor head
            if (visibleHistory.length > 0) {
                 const last = visibleHistory[visibleHistory.length - 1];
                 if (last.detectedPitch > 0) {
                    const midi = 69 + 12 * Math.log2(last.detectedPitch / 440);
                    const x = timeToX(last.timestamp);
                    const y = pitchToY(midi);
                    
                    ctx.fillStyle = config.userGlow;
                    ctx.beginPath();
                    ctx.arc(x, y, config.lineWidth * 2, 0, Math.PI * 2);
                    ctx.fill();
                 }
            }
        }

        requestRef.current = requestAnimationFrame(() => draw(time));
    };

    useEffect(() => {
        requestRef.current = requestAnimationFrame(() => draw(performance.now()));
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [controller, pitchHistory, stageTheme]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={`pointer-events-none ${className || ''}`}
            style={{ width: '100%', height: '100%' }}
        />
    );
};
