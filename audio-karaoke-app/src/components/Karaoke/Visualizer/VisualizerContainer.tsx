import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { VoicePreset, VoiceTransformSettings } from '@/types/audio';
import type { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import { LyricTheme } from '../LyricDisplay';
import { SettingsPanel } from '../../UI/SettingsPanel';
import { useTranslations } from 'next-intl';

import { AudioVisualizer } from '@/utils/audio/audioVisualizer';
import { VisualizerCanvas } from './VisualizerCanvas';
import { LyricsContainer } from './LyricsContainer';
import { KaraokeToolbar } from './KaraokeToolbar';
import { PanelsOverlay } from './PanelsOverlay';

interface VisualizerContainerProps {
    visualizer: AudioVisualizer | null;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    controller: PlaybackController;
    lyrics: LRCData | null;
    cdgData: Uint8Array | null;
    currentLineIndex: number;
    currentWordIndex: number;
    theme: LyricTheme;
    visualSettings: VisualSettings;
    isStageMode: boolean;
    showEditor: boolean;
    showPractice: boolean;
    showRoom: boolean;
    showVoiceFx: boolean;
    showSettings: boolean;
    showAutoKey: boolean;
    isVisualSettingsOpen: boolean;
    recorder: {
        isRecording: boolean;
    };
    
    voiceFxProps: {
        currentPreset: VoicePreset;
        settings: VoiceTransformSettings;
        isMonitoring: boolean;
        onPresetChange: (preset: VoicePreset) => void;
        onSettingsChange: (settings: Partial<VoiceTransformSettings>) => void;
        onToggleMonitoring: () => void;
    };
    practiceProps: any;
    roomProps: any;
    autoKeyProps: any;

    onCanvasReady: (canvas: HTMLCanvasElement) => void;
    onLRCUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onThemeChange: (theme: LyricTheme) => void;
    onToggleStageMode: (enabled: boolean) => void;
    onTogglePractice: () => void;
    onToggleRoom: () => void;
    onToggleVoiceFx: () => void;
    onToggleAutoKey: () => void;
    onToggleSettings: () => void;
    onToggleEditor: (show: boolean) => void;
    onSaveLRC: (data: LRCData) => void;
    onVisualSettingsChange: (settings: VisualSettings) => void;
    onCloseVisualSettings: () => void;
    onCloseVoiceFx: () => void;
    onClosePractice: () => void;
    onCloseRoom: () => void;
    onCloseAutoKey: () => void;

    // Recording Mix API
    isRecordingMix: boolean;
    recordedMixBlob: Blob | null;
    onStartRecordingMix: () => void;
    onStopRecordingMix: () => void;
    onClearMixRecording: () => void;
}

export const VisualizerContainer: React.FC<VisualizerContainerProps> = (props) => {
    const t = useTranslations('KaraokePlayer');
    const containerRef = useRef<HTMLDivElement>(null);

    // Mouse tracking for premium glow
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        containerRef.current.style.setProperty('--mouse-x', `${x}px`);
        containerRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    return (
        <motion.div
            data-testid="visualizer-container"
            ref={containerRef}
            onMouseMove={handleMouseMove}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`glass-premium relative rounded-3xl overflow-hidden flex flex-col items-center justify-center p-6 md:p-8 group transition-all duration-700 ${
                props.isStageMode ? 'flex-1 min-h-[60vh] md:min-h-0 aspect-auto border-none bg-black' : 'aspect-4/3 md:aspect-21/9'
            }`}
        >
            <VisualizerCanvas 
                canvasRef={props.canvasRef}
                visualSettings={props.visualSettings}
                isStageMode={props.isStageMode}
            />

            <LyricsContainer
                cdgData={props.cdgData}
                lyrics={props.lyrics}
                showEditor={props.showEditor}
                isStageMode={props.isStageMode}
                theme={props.theme}
                visualSettings={props.visualSettings}
                currentLineIndex={props.currentLineIndex}
                currentWordIndex={props.currentWordIndex}
                visualizer={props.visualizer}
                controller={props.controller}
                onCanvasReady={props.onCanvasReady}
                onToggleEditor={props.onToggleEditor}
                onSaveLRC={props.onSaveLRC}
                onLRCUpload={props.onLRCUpload}
            />

            <KaraokeToolbar
                lyrics={props.lyrics}
                cdgData={props.cdgData}
                showEditor={props.showEditor}
                theme={props.theme}
                showPractice={props.showPractice}
                showRoom={props.showRoom}
                showVoiceFx={props.showVoiceFx}
                showAutoKey={props.showAutoKey}
                isVisualSettingsOpen={props.isVisualSettingsOpen}
                visualSettings={props.visualSettings}
                isRecordingMix={props.isRecordingMix}
                recordedMixBlob={props.recordedMixBlob}
                onStartRecordingMix={props.onStartRecordingMix}
                onStopRecordingMix={props.onStopRecordingMix}
                onClearMixRecording={props.onClearMixRecording}
                onThemeChange={props.onThemeChange}
                onTogglePractice={props.onTogglePractice}
                onToggleRoom={props.onToggleRoom}
                onToggleVoiceFx={props.onToggleVoiceFx}
                onToggleAutoKey={props.onToggleAutoKey}
                onToggleEditor={props.onToggleEditor}
                onToggleStageMode={props.onToggleStageMode}
                onVisualSettingsChange={props.onVisualSettingsChange}
            />

            <PanelsOverlay
                showVoiceFx={props.showVoiceFx}
                showPractice={props.showPractice}
                showRoom={props.showRoom}
                showAutoKey={props.showAutoKey}
                voiceFxProps={props.voiceFxProps}
                practiceProps={props.practiceProps}
                roomProps={props.roomProps}
                autoKeyProps={props.autoKeyProps}
                onCloseVoiceFx={props.onCloseVoiceFx}
                onClosePractice={props.onClosePractice}
                onCloseRoom={props.onCloseRoom}
                onCloseAutoKey={props.onCloseAutoKey}
            />

            <AnimatePresence>
                {(props.recorder.isRecording || props.isRecordingMix) && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="absolute top-6 left-6 flex items-center gap-2 bg-red-500/20 text-red-500 px-4 py-2 rounded-full border border-red-500/30 font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(239,68,68,0.2)] z-50 pointer-events-none"
                    >
                        <motion.div 
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-2 h-2 bg-red-500 rounded-full" 
                        />
                        {props.isRecordingMix ? t('recordingSession') || 'RECORDING SESSION' : t('recording')}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Visual Settings Panel */}
            <SettingsPanel
                isOpen={props.isVisualSettingsOpen}
                onClose={props.onCloseVisualSettings}
                visualSettings={props.visualSettings}
                onVisualSettingsChange={props.onVisualSettingsChange}
            />
        </motion.div>
    );
};
