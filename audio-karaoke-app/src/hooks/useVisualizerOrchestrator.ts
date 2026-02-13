import { useEffect, useRef, useState } from 'react';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { VisualSettings } from '@/types/karaoke';
import { getWorkletManager } from '@/utils/audio/audioContext';
import { PlaybackController } from '@/utils/audio/playbackController';

interface UseVisualizerOrchestratorProps {
    controller: PlaybackController;
    visualSettings: VisualSettings;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    vocalsVolume: number;
    instrumentalVolume: number;
}

export const useVisualizerOrchestrator = ({
    controller,
    visualSettings,
    canvasRef,
    vocalsVolume,
    instrumentalVolume
}: UseVisualizerOrchestratorProps) => {
    const visualizerRef = useRef<AudioVisualizer | null>(null);
    const [visualizerInstance, setVisualizerInstance] = useState<AudioVisualizer | null>(null);

    useEffect(() => {
        if (!visualizerRef.current) {
            visualizerRef.current = new AudioVisualizer();
            setVisualizerInstance(visualizerRef.current);
        }
        visualizerRef.current.setAutoQuality(visualSettings.autoQuality);

        if (canvasRef.current) {
            visualizerRef.current.start();
            
            const { visualizationMode } = visualSettings;
            switch (visualizationMode) {
                case 'waveform':
                    visualizerRef.current.drawWaveform(canvasRef.current);
                    break;
                case '3d-landscape':
                    visualizerRef.current.draw3DLandscape(canvasRef.current);
                    break;
                case 'spectrogram':
                    visualizerRef.current.drawSpectrogram(canvasRef.current);
                    break;
                case 'bars':
                default:
                    visualizerRef.current.drawSpectrum(canvasRef.current);
                    break;
            }
        }

        return () => {
            visualizerRef.current?.stop();
        };
    }, [visualSettings.visualizationMode, visualSettings.autoQuality, canvasRef]);

    useEffect(() => {
        const workletManager = getWorkletManager();
        if (!workletManager || !visualizerRef.current) return;
        
        workletManager.onMetricsUpdate((metrics: { cpuUsage: number; latency: number; bufferUnderruns: number }) => {
            visualizerRef.current?.setPerformanceMetrics(metrics);
        });
    }, []);

    useEffect(() => {
        const gainNodes = controller.getGainNodes();
        if (gainNodes.length > 0 && visualizerRef.current) {
            gainNodes.forEach(node => visualizerRef.current?.setSource(node));
        }
    }, [controller, vocalsVolume, instrumentalVolume]);

    return visualizerInstance;
};
