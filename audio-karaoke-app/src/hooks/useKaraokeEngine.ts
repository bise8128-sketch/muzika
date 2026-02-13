import { useState, useEffect, useRef } from 'react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { PlaybackController } from '@/utils/audio/playbackController';

interface UseKaraokeEngineProps {
    controller: PlaybackController | null;
    lyrics: LRCData | null;
    visualSettings: VisualSettings;
    cdgData: Uint8Array | null;
}

export const useKaraokeEngine = ({ controller, lyrics, visualSettings, cdgData }: UseKaraokeEngineProps) => {
    const workerRef = useRef<Worker | null>(null);
    const [lyricState, setLyricState] = useState({ lineIndex: -1, wordIndex: -1 });
    const isCanvasTransferredRef = useRef(false);

    // Initialize Worker
    useEffect(() => {
        const worker = new Worker(new URL('../workers/karaokeEngine.worker.ts', import.meta.url));
        workerRef.current = worker;

        worker.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'LYRIC_UPDATE') {
                setLyricState({
                    lineIndex: payload.lineIndex,
                    wordIndex: payload.wordIndex
                });
            }
        };

        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, []);

    // Sync Worker with Controller
    useEffect(() => {
        if (!workerRef.current || !controller) return;

        const worker = workerRef.current;
        const handlePlay = () => worker.postMessage({ type: 'PLAY', payload: { startTime: controller.getCurrentTime() } });
        const handlePause = () => worker.postMessage({ type: 'PAUSE' });
        const handleSeek = (data: any) => {
            worker.postMessage({ type: 'SYNC_TIME', payload: { currentTime: data.currentTime } });
            if (controller.getIsPlaying()) {
                worker.postMessage({ type: 'PLAY', payload: { startTime: data.currentTime } });
            }
        };

        controller.on('play', handlePlay);
        controller.on('pause', handlePause);
        controller.on('seeked', handleSeek);

        return () => {
            controller.off('play', handlePlay);
            controller.off('pause', handlePause);
            controller.off('seeked', handleSeek);
        };
    }, [controller]);

    // Send Data to Worker
    useEffect(() => {
        if (!workerRef.current) return;

        setLyricState({ lineIndex: -1, wordIndex: -1 });

        workerRef.current.postMessage({
            type: 'INIT_ENGINE',
            payload: {
                lrcData: lyrics,
                visualSettings
            }
        });
    }, [lyrics, visualSettings]);

    // CDG Data Update
    useEffect(() => {
        if (!cdgData) {
            isCanvasTransferredRef.current = false;
            return;
        }

        if (workerRef.current && isCanvasTransferredRef.current) {
            workerRef.current.postMessage({
                type: 'INIT_ENGINE',
                payload: {
                    cdgData: cdgData
                }
            });
        }
    }, [cdgData]);

    const handleCanvasReady = (canvas: HTMLCanvasElement) => {
        if (!workerRef.current || isCanvasTransferredRef.current) return;

        try {
            const offscreen = canvas.transferControlToOffscreen();
            workerRef.current.postMessage({
                type: 'INIT_ENGINE',
                payload: {
                    cdgData: cdgData,
                    canvas: offscreen
                }
            }, [offscreen]);
            isCanvasTransferredRef.current = true;
        } catch (e) {
            console.error("Failed to transfer canvas control:", e);
        }
    };

    return {
        lyricState,
        handleCanvasReady
    };
};
