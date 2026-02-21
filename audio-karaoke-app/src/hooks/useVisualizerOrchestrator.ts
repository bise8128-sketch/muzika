import { useEffect, useRef, useState } from 'react';
import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { VisualSettings } from '@/types/karaoke';
import { VoicePreset } from '@/types/audio';
import { getWorkletManager } from '@/utils/audio/audioContext';
import { PlaybackController } from '@/utils/audio/playback/PlaybackCore';

interface UseVisualizerOrchestratorProps {
    controller: PlaybackController;
    visualSettings: VisualSettings;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    vocalsVolume: number;
    instrumentalVolume: number;
    vocalEnergy?: number;
    voicePreset?: string;
}

export const useVisualizerOrchestrator = ({
    controller,
    visualSettings,
    canvasRef,
    vocalsVolume,
    instrumentalVolume,
    vocalEnergy = 0,
    voicePreset = 'original'
}: UseVisualizerOrchestratorProps) => {
    const visualizerRef = useRef<AudioVisualizer | null>(null);
    const [visualizerInstance, setVisualizerInstance] = useState<AudioVisualizer | null>(null);
    const hasTransferredCanvas = useRef(false);

    useEffect(() => {
        if (!visualizerRef.current) {
            visualizerRef.current = new AudioVisualizer();
            setVisualizerInstance(visualizerRef.current);
        }
        
        // Pass Config
        visualizerRef.current.setAutoQuality(visualSettings.autoQuality);
        visualizerRef.current.setConfig({
             theme: {}, // We can pass theme colors here
             quality: visualSettings.autoQuality ? 'high' : 'high'
        });

        if (canvasRef.current && !hasTransferredCanvas.current) {
            visualizerRef.current.transferControlToOffscreen(canvasRef.current);
            hasTransferredCanvas.current = true;
            visualizerRef.current.start();
        }

        // Set Mode
        visualizerRef.current.setMode(visualSettings.visualizationMode);

        return () => {
             // We don't stop strictly on every render, but we could if component unmounts.
             // Cleanup is handled by ref or parent unmounting usually.
        };
    }, [visualSettings.visualizationMode, visualSettings.autoQuality, canvasRef]); 
    // Note: canvasRef should be stable. If it changes, we might have issues transferring again.

    // Resize Observer
    useEffect(() => {
        if (!canvasRef.current) return;
        
        const handleResize = () => {
             if (canvasRef.current && visualizerRef.current) {
                 // For OffscreenCanvas, we just send message. 
                 // But wait, if transferred, we can't touch canvas properties on main thread easily?
                 // Actually width/height on placeholder canvas DO update layout, but backing store needs update?
                 // Standard is: Main thread canvas resizes -> We send new size to worker -> Worker updates OffscreenCanvas width/height.
                 const { clientWidth, clientHeight } = canvasRef.current;
                 visualizerRef.current.resize(clientWidth, clientHeight);
             }
        };
        
        // Initial size
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [canvasRef]);


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

    useEffect(() => {
        if (visualizerRef.current) {
            visualizerRef.current.setVocalEnergy(vocalEnergy);
        }
    }, [vocalEnergy]);

    useEffect(() => {
        if (visualizerRef.current && voicePreset) {
            visualizerRef.current.setVisualTheme(voicePreset as VoicePreset);
        }
    }, [voicePreset]);

    return visualizerInstance;
};
