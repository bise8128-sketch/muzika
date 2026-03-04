import React, { useEffect, useState } from 'react';
import { useAudioStore } from '@/store/audioStore';

export function PerformanceOverlay() {
    const metrics = useAudioStore(state => state.metrics);
    // Render a small, non-intrusive floating overlay
    
    // Auto-calculate FPS
    const [fps, setFps] = useState(0);
    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();
        let animationFrameId: number;

        const loop = () => {
            const now = performance.now();
            frameCount++;
            if (now >= lastTime + 1000) {
                setFps(Math.round((frameCount * 1000) / (now - lastTime)));
                frameCount = 0;
                lastTime = now;
            }
            animationFrameId = requestAnimationFrame(loop);
        };

        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Periodically update store with FPS so other parts can react if necessary
    useEffect(() => {
        const interval = setInterval(() => {
            useAudioStore.getState().updateMetrics({ fps });
        }, 1000);
        return () => clearInterval(interval);
    }, [fps]);

    return (
        <div className="fixed bottom-4 left-4 z-50 p-3 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg text-xs font-mono text-zinc-300 pointer-events-none shadow-2xl flex flex-col gap-1 min-w-[140px]">
            <div className="text-white/50 font-bold mb-1 uppercase text-[10px] tracking-widest">Perf Monitor</div>
            
            <div className="flex justify-between gap-4">
                <span>FPS</span>
                <span className={fps >= 50 ? 'text-green-400' : fps >= 30 ? 'text-amber-400' : 'text-red-400'}>
                    {fps}
                </span>
            </div>
            
            <div className="flex justify-between gap-4">
                <span>Engine</span>
                <span className={metrics.gpuActive ? 'text-green-400' : 'text-blue-400'}>
                    {metrics.gpuActive ? 'WebGPU' : 'WASM'}
                </span>
            </div>
            
            {metrics.processingLatency !== null && metrics.processingLatency > 0 && (
                <div className="flex justify-between gap-4">
                    <span>Latency</span>
                    <span className={metrics.processingLatency < 100 ? 'text-green-400' : metrics.processingLatency < 300 ? 'text-amber-400' : 'text-red-400'}>
                        {Math.round(metrics.processingLatency)}ms
                    </span>
                </div>
            )}
            
            {metrics.timeToFirstAudio !== null && metrics.timeToFirstAudio > 0 && (
                <div className="flex justify-between gap-4">
                    <span>TTFA</span>
                    <span className="text-zinc-100">{metrics.timeToFirstAudio}ms</span>
                </div>
            )}
            
            {(metrics.cacheHits > 0 || metrics.cacheMisses > 0) && (
                <div className="flex justify-between gap-4 mt-1 border-t border-white/10 pt-1">
                    <span className="text-[10px] text-zinc-500">Cache H/M</span>
                    <span className="text-[10px] text-zinc-400">{metrics.cacheHits} / {metrics.cacheMisses}</span>
                </div>
            )}
        </div>
    );
}
