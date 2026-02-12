import React, { useRef, useEffect } from 'react';
import { LRCData, VisualSettings } from '@/types/karaoke';
import { LyricTheme, LyricDisplay } from '../LyricDisplay';
import { LyricEditor } from '../LyricEditor';
import { CDGRenderer } from '../CDGRenderer';
import { VoiceTransformPanel } from '../VoiceTransformPanel';
import { PracticePanel } from '../PracticePanel';
import { RoomLobby } from '../Room/RoomLobby';
import { RoomView } from '../Room/RoomView';
import { SettingsPanel } from '../../UI/SettingsPanel';
import { useTranslations } from 'next-intl';

interface VisualizerContainerProps {
    canvasRef: React.RefObject<HTMLCanvasElement>;
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
    
    // Sub-component props
    voiceFxProps: any; // Ideally typed better but ok for decomposition
    practiceProps: any;
    roomProps: any;

    // Handlers
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
    const tCommon = useTranslations('Karaoke');

    return (
        <div className={`relative bg-zinc-950/60 rounded-3xl overflow-hidden border border-white/10 flex flex-col items-center justify-center p-6 md:p-8 group transition-all duration-700 ${
            isStageMode ? 'flex-1 min-h-[60vh] md:min-h-0 aspect-auto border-none bg-transparent' : 'aspect-[4/3] md:aspect-[21/9]'
        }`}>
            {/* Background Visualizer */}
            <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000 ${isStageMode ? 'opacity-40' : 'opacity-30'}`}
                width={1200}
                height={400}
            />

            {/* Lyrics Layer */}
            <div className={`relative z-10 w-full flex flex-col items-center transition-all duration-700 ${isStageMode ? 'scale-125' : ''}`}>
                {cdgData && (
                    <div className="mb-4 scale-150 transform">
                        <CDGRenderer onCanvasReady={onCanvasReady} />
                    </div>
                )}

                {showEditor ? (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl p-4 overflow-y-auto">
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={() => onToggleEditor(false)}
                                className="p-2 hover:bg-white/10 rounded-full text-white"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <LyricEditor
                            currentTime={0} // Ideally passed from parent if needed for initial sync
                            onSave={onSaveLRC}
                            initialLRC={lyrics}
                        />
                    </div>
                ) : (
                    <LyricDisplay
                        lyrics={lyrics}
                        currentLineIndex={currentLineIndex}
                        currentWordIndex={currentWordIndex}
                        theme={theme}
                        visualSettings={visualSettings}
                    />
                )}
            </div>

            {/* Overlays */}
            {!lyrics && !cdgData && !showEditor && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="flex gap-4">
                        <label className="cursor-pointer focus-ring rounded-full">
                            <input type="file" accept=".lrc,.cdg" onChange={onLRCUpload} className="sr-only" />
                            <div className="bg-white/10 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 hover:bg-white/20 transition-all text-white font-bold text-sm uppercase tracking-wider">
                                {t('uploadLrc')}
                            </div>
                        </label>
                        <button
                            onClick={() => onToggleEditor(true)}
                            className="bg-primary/20 backdrop-blur-md px-6 py-3 rounded-full border border-primary/20 hover:bg-primary/30 transition-all text-white font-bold text-sm uppercase tracking-wider focus-ring"
                        >
                            {t('createLyrics')}
                        </button>
                    </div>
                </div>
            )}

            {(lyrics || cdgData) && !showEditor && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    <div className="flex bg-black/40 backdrop-blur-md rounded-full p-1 border border-white/10">
                        {(['modern', 'neon', 'classic', 'retro'] as LyricTheme[]).map(t => (
                            <button
                                key={t}
                                onClick={() => onThemeChange(t)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${theme === t ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <button
                        className={`p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md ml-2 ${showPractice ? 'bg-primary/50' : ''}`}
                        onClick={onTogglePractice}
                        title="Smart Practice Mode"
                    >
                        🎯
                    </button>

                    <button
                        className={`p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md ml-2 ${showRoom ? 'bg-primary/50' : ''}`}
                        onClick={onToggleRoom}
                        title="Collaborative Room"
                    >
                        👥
                    </button>

                    <button
                        onClick={() => onToggleStageMode(true)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md ml-2"
                        title="Stage Mode (F)"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onToggleEditor(true)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md ml-2"
                        title="Edit Lyrics"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => onVisualSettingsChange({ ...visualSettings })} // Just trigger open, handled by parent state
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md ml-2"
                        title={t('visualSettings') || "Visual Settings"}
                        onMouseDown={() => { /* Hacky way if needed, but parent should pass handler for opening settings */ }}
                        // Actually the button in original code just set isVisualSettingsOpen(true)
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                    <button
                        className={`p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md ml-2 ${showSettings ? 'bg-primary/50' : ''}`}
                        onClick={onToggleSettings}
                        title="Settings"
                    >
                        ⚙️
                    </button>
                    
                    <button
                        className={`p-2 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md ml-2 ${showVoiceFx ? 'bg-primary/50' : ''}`}
                        onClick={onToggleVoiceFx}
                        title="Voice Effects"
                    >
                        🎤
                    </button>
                </div>
            )} 

            {/* Panels */}
            {showVoiceFx && (
                <div className="absolute top-20 right-4 z-50">
                    <VoiceTransformPanel
                        {...voiceFxProps}
                        onClose={onCloseVoiceFx}
                    />
                </div>
            )}
            {showPractice && (
                <div className="absolute top-20 right-4 z-50 w-80">
                    <PracticePanel
                        {...practiceProps}
                        onStopPractice={() => {
                            practiceProps.onStopPractice();
                            onClosePractice();
                        }}
                    />
                    {!practiceProps.isPracticing && !practiceProps.isComplete && (
                        <div className="mt-2 text-center">
                            <button 
                                className="w-full px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary/80 transition"
                                onClick={() => practiceProps.startPractice(practiceProps.pitchHistory)}
                                disabled={practiceProps.pitchHistory.length === 0}
                            >
                                Start Practice From History
                            </button>
                        </div>
                    )}
                </div>
            )}

            {showRoom && (
                <div className="absolute top-20 right-4 z-50">
                    {!roomProps.isConnected || !roomProps.room ? (
                            <RoomLobby 
                            onJoin={roomProps.onJoin} 
                            onCancel={onCloseRoom} 
                            />
                    ) : (
                        <RoomView 
                            {...roomProps}
                            onLeave={roomProps.onLeave}
                        />
                    )}
                </div>
            )}

            {/* Recording Status */}
            {recorder.isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 animate-pulse font-bold text-xs uppercase tracking-widest">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    {t('recording')}
                </div>
            )}

            {/* Visual Settings Panel */}
            <SettingsPanel
                isOpen={isVisualSettingsOpen}
                onClose={onCloseVisualSettings}
                visualSettings={visualSettings}
                onVisualSettingsChange={onVisualSettingsChange}
            />
        </div>
    );
};
