import React from 'react';
import { VisualSettings, StageTheme } from '@/types/karaoke';

interface VisualizerCanvasProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    visualSettings: VisualSettings;
    stageTheme: StageTheme;
    isStageMode: boolean;
}

export const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({
    canvasRef,
    visualSettings,
    stageTheme,
    isStageMode
}) => {
    return (
        <canvas
            data-testid="visualizer-canvas"
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000 ${
                isStageMode ? 'opacity-80' : 'opacity-40'
            } ${visualSettings.visualizationMode === '3d-landscape' ? 'mix-blend-screen' : ''}`}
            width={1200}
            height={400}
        />
    );
};
