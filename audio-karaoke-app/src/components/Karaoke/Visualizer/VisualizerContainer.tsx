import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Upload, 
    Edit3, 
    Maximize2, 
    Target, 
    Users, 
    Settings, 
    Mic2, 
    X
} from 'lucide-react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { VoicePreset, VoiceTransformSettings } from '@/types/audio';
import { LyricTheme, LyricDisplay } from '../LyricDisplay';
import { LyricEditor } from '../LyricEditor';
import { CDGRenderer } from '../CDGRenderer';
import { VoiceTransformPanel } from '../VoiceTransformPanel';
import { PracticePanel } from '../PracticePanel';
import { RoomLobby } from '../../Room/RoomLobby';
import { RoomView } from '../../Room/RoomView';
import { SettingsPanel } from '../../UI/SettingsPanel';
import { useTranslations } from 'next-intl';

import { AudioVisualizer } from '@/utils/audio/audioVisualizer';

interface VisualizerContainerProps {
    visualizer: AudioVisualizer | null;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
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
    isVisualSettingsOpen: boolean;
    recorder: {
        isRecording: boolean;
    };
    
    voiceFxProps: {
        currentPreset: string;
        settings: VoiceTransformSettings;
        isMonitoring: boolean;
        onPresetChange: (preset: VoicePreset) => void;
        onSettingsChange: (settings: Partial<VoiceTransformSettings>) => void;
        onToggleMonitoring: () => void;
    };
    practiceProps: any;
    roomProps: any;

    onCanvasReady: (canvas: HTMLCanvasElement) => void;
    onLRCUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onThemeChange: (theme: LyricTheme) => void;
    onToggleStageMode: (enabled: boolean) => void;
    onTogglePractice: () => void;
    onToggleRoom: () => void;
    onToggleVoiceFx: () => void;
    onToggleSettings: () => void;
    onToggleEditor: (show: boolean) => void;
    onSaveLRC: (data: LRCData) => void;
    onVisualSettingsChange: (settings: VisualSettings) => void;
    onCloseVisualSettings: () => void;
    onCloseVoiceFx: () => void;
    onClosePractice: () => void;
    onCloseRoom: () => void;
}

export const VisualizerContainer: React.FC<VisualizerContainerProps> = ({
    visualizer,
    canvasRef,
    lyrics,
    cdgData,
    currentLineIndex,
    currentWordIndex,
    theme,
    visualSettings,
    isStageMode,
    showEditor,
    showPractice,
    showRoom,
    showVoiceFx,
    showSettings,
    isVisualSettingsOpen,
    recorder,
    voiceFxProps,
    practiceProps,
    roomProps,
    onCanvasReady,
    onLRCUpload,
    onThemeChange,
    onToggleStageMode,
    onTogglePractice,
    onToggleRoom,
    onToggleVoiceFx,
    onToggleSettings,
    onToggleEditor,
    onSaveLRC,
    onVisualSettingsChange,
    onCloseVisualSettings,
    onCloseVoiceFx,
    onClosePractice,
    onCloseRoom
}) => {
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
            ref={containerRef}
            onMouseMove={handleMouseMove}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={`glass-premium relative rounded-3xl overflow-hidden flex flex-col items-center justify-center p-6 md:p-8 group transition-all duration-700 ${
                isStageMode ? 'flex-1 min-h-[60vh] md:min-h-0 aspect-auto border-none bg-black' : 'aspect-4/3 md:aspect-21/9'
            }`}
        >
            {/* Background Visualizer */}
            <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000 ${
                    isStageMode ? 'opacity-80' : 'opacity-40'
                } ${visualSettings.visualizationMode === '3d-landscape' ? 'mix-blend-screen' : ''}`}
                width={1200}
                height={400}
            />

            {/* Lyrics Layer */}
            <motion.div 
                layout
                className={`relative z-10 w-full flex flex-col items-center transition-all duration-700 ${isStageMode ? 'scale-125' : ''}`}
            >
                {cdgData && (
                    <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 1 }}
                        className="mb-4 transform"
                    >
                        <CDGRenderer onCanvasReady={onCanvasReady} />
                    </motion.div>
                )}

                <AnimatePresence mode="wait">
                    {showEditor ? (
                        <motion.div 
                            key="editor"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-3xl p-6 overflow-y-auto"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-primary" />
                                    {t('editLyrics') || 'Lyric Editor'}
                                </h2>
                                <button
                                    onClick={() => onToggleEditor(false)}
                                    className="p-2 hover:bg-white/10 rounded-full text-white/60 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <LyricEditor
                                currentTime={0}
                                onSave={onSaveLRC}
                                initialLRC={lyrics}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="display"
                            layout
                            className="w-full flex justify-center"
                        >
                                <LyricDisplay
                                    visualizer={visualizer}
                                    lyrics={lyrics}
                                    currentLineIndex={currentLineIndex}
                                currentWordIndex={currentWordIndex}
                                theme={theme}
                                visualSettings={visualSettings}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Empty State Overlays */}
            {!lyrics && !cdgData && !showEditor && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-20"
                >
                    <div className="text-center space-y-2">
                        <h3 className="text-2xl font-bold text-white">Ready to Shine?</h3>
                        <p className="text-white/40 text-sm">Upload an LRC file or CDG data to begin</p>
                    </div>
                    <div className="flex gap-4">
                        <label className="cursor-pointer interactive-scale">
                            <input type="file" accept=".lrc,.cdg" onChange={onLRCUpload} className="sr-only" />
                            <div className="bg-primary/20 backdrop-blur-xl px-8 py-4 rounded-full border border-primary/30 text-white font-bold text-sm uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                                <Upload className="w-4 h-4" />
                                {t('uploadLrc')}
                            </div>
                        </label>
                        <button
                            onClick={() => onToggleEditor(true)}
                            className="bg-white/5 backdrop-blur-xl px-8 py-4 rounded-full border border-white/10 hover:bg-white/10 transition-all text-white/80 font-bold text-sm uppercase tracking-widest interactive-scale"
                        >
                            {t('createLyrics')}
                        </button>
                    </div>
                </motion.div>
            )}

            {/* Quick Controls Toolbar */}
            {(lyrics || cdgData) && !showEditor && (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-50 p-2 rounded-2xl bg-black/20 backdrop-blur-xl border border-white/5"
                >
                    {/* Theme Switcher */}
                    <div className="flex bg-white/5 rounded-xl p-1 gap-1">
                        {(['modern', 'neon', 'classic', 'retro'] as LyricTheme[]).map(t => (
                            <button
                                key={t}
                                onClick={() => onThemeChange(t)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${
                                    theme === t ? 'bg-primary text-white shadow-[0_0_12px_rgba(147,51,234,0.5)]' : 'text-white/30 hover:text-white/60'
                                }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <div className="w-[1px] h-8 bg-white/10 self-center" />

                    <ToolbarButton 
                        icon={<Target className="w-4 h-4" />} 
                        active={showPractice} 
                        onClick={onTogglePractice} 
                        label="Practice" 
                    />
                    <ToolbarButton 
                        icon={<Users className="w-4 h-4" />} 
                        active={showRoom} 
                        onClick={onToggleRoom} 
                        label="Collab" 
                    />
                    <ToolbarButton 
                        icon={<Mic2 className="w-4 h-4" />} 
                        active={showVoiceFx} 
                        onClick={onToggleVoiceFx} 
                        label="Voice FX" 
                    />
                    <ToolbarButton 
                        icon={<Settings className="w-4 h-4" />} 
                        active={isVisualSettingsOpen} 
                        onClick={() => onVisualSettingsChange({ ...visualSettings })} 
                        label="Settings" 
                    />
                    <ToolbarButton 
                        icon={<Edit3 className="w-4 h-4" />} 
                        onClick={() => onToggleEditor(true)} 
                        label="Editor" 
                    />
                    <ToolbarButton 
                        icon={<Maximize2 className="w-4 h-4" />} 
                        onClick={() => onToggleStageMode(true)} 
                        label="Stage Mode" 
                    />
                </motion.div>
            )} 

            {/* Side Panels - Floating & Animated */}
            <AnimatePresence>
                {showVoiceFx && (
                    <PanelWrapper key="voicefx" onClose={onCloseVoiceFx}>
                        <VoiceTransformPanel {...voiceFxProps} onClose={onCloseVoiceFx} />
                    </PanelWrapper>
                )}
                {showPractice && (
                    <PanelWrapper key="practice" onClose={onClosePractice} className="w-85">
                        <PracticePanel
                            {...practiceProps}
                            onStopPractice={() => {
                                practiceProps.onStopPractice();
                                onClosePractice();
                            }}
                        />
                         {!practiceProps.isPracticing && !practiceProps.isComplete && (
                            <button 
                                className="w-full mt-4 px-4 py-3 bg-primary/20 hover:bg-primary/40 text-primary-foreground rounded-xl font-bold transition-all border border-primary/30"
                                onClick={() => practiceProps.startPractice(practiceProps.pitchHistory)}
                                disabled={practiceProps.pitchHistory.length === 0}
                            >
                                Start Practice From History
                            </button>
                        )}
                    </PanelWrapper>
                )}
                {showRoom && (
                    <PanelWrapper key="room" onClose={onCloseRoom}>
                        {!roomProps.isConnected || !roomProps.room ? (
                                <RoomLobby onJoin={roomProps.onJoin} onCancel={onCloseRoom} />
                        ) : (
                            <RoomView {...roomProps} onLeave={roomProps.onLeave} />
                        )}
                    </PanelWrapper>
                )}
            </AnimatePresence>

            {/* Recording Indicator */}
            <AnimatePresence>
                {recorder.isRecording && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="absolute top-6 left-6 flex items-center gap-2 bg-red-500/20 text-red-500 px-4 py-2 rounded-full border border-red-500/30 font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                    >
                        <motion.div 
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-2 h-2 bg-red-500 rounded-full" 
                        />
                        {t('recording')}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Visual Settings Panel */}
            <SettingsPanel
                isOpen={isVisualSettingsOpen}
                onClose={onCloseVisualSettings}
                visualSettings={visualSettings}
                onVisualSettingsChange={onVisualSettingsChange}
            />
        </motion.div>
    );
};

const ToolbarButton: React.FC<{ icon: React.ReactNode; active?: boolean; onClick: () => void; label: string }> = ({ icon, active, onClick, label }) => (
    <button
        onClick={onClick}
        className={`p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center interactive-scale ${
            active 
                ? 'bg-primary text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' 
                : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/5'
        }`}
        title={label}
    >
        {icon}
    </button>
);

const PanelWrapper: React.FC<{ children: React.ReactNode; onClose: () => void; className?: string }> = ({ children, className }) => (
    <motion.div 
        initial={{ opacity: 0, scale: 0.9, x: 10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: 10 }}
        className={`absolute top-24 right-6 z-[60] glass-premium rounded-3xl p-1 shadow-2xl ${className || ''}`}
    >
        {children}
    </motion.div>
);
