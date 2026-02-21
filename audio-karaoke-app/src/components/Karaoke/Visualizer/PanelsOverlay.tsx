import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VoiceRoomPanel } from '../VoiceRoomPanel';
import { PracticePanel } from '../PracticePanel';
import { RoomLobby } from '../../Room/RoomLobby';
import { RoomView } from '../../Room/RoomView';
import { AutoKeyPanel } from '../AutoKeyPanel';
import { LyricSyncPanel } from '../LyricSyncPanel';

interface PanelsOverlayProps {
    showVoiceFx: boolean;
    showPractice: boolean;
    showRoom: boolean;
    showAutoKey: boolean;
    showLyricSync: boolean;
    voiceFxProps: any;
    practiceProps: any;
    roomProps: any;
    autoKeyProps: any;
    lyricSyncProps: any;
    onCloseVoiceFx: () => void;
    onClosePractice: () => void;
    onCloseRoom: () => void;
    onCloseAutoKey: () => void;
    onCloseLyricSync: () => void;
}

const PanelWrapper: React.FC<{ children: React.ReactNode; onClose: () => void; className?: string }> = ({ children, className }) => (
    <motion.div 
        initial={{ opacity: 0, scale: 0.9, x: 10 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.9, x: 10 }}
        className={`absolute top-24 right-6 z-60 glass-premium rounded-3xl p-1 shadow-2xl ${className || ''}`}
    >
        {children}
    </motion.div>
);

export const PanelsOverlay: React.FC<PanelsOverlayProps> = ({
    showVoiceFx,
    showPractice,
    showRoom,
    showAutoKey,
    showLyricSync,
    voiceFxProps,
    practiceProps,
    roomProps,
    autoKeyProps,
    lyricSyncProps,
    onCloseVoiceFx,
    onClosePractice,
    onCloseRoom,
    onCloseAutoKey,
    onCloseLyricSync
}) => {
    return (
        <AnimatePresence>
            {showVoiceFx && (
                <PanelWrapper key="voicefx" onClose={onCloseVoiceFx} className="w-96">
                    <VoiceRoomPanel 
                        currentPreset={voiceFxProps.currentPreset}
                        settings={voiceFxProps.settings}
                        isMonitoring={voiceFxProps.isMonitoring}
                        onPresetChange={voiceFxProps.onPresetChange}
                        onSettingsChange={voiceFxProps.onSettingsChange}
                        onToggleMonitoring={voiceFxProps.onToggleMonitoring}
                        isInitialized={voiceFxProps.isInitialized}
                        onInit={voiceFxProps.onInit}
                    />
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
            {showAutoKey && (
                <PanelWrapper key="autokey" onClose={onCloseAutoKey}>
                    <AutoKeyPanel {...autoKeyProps} onClose={onCloseAutoKey} />
                </PanelWrapper>
            )}
            {showLyricSync && (
                <PanelWrapper key="lyricsync" onClose={onCloseLyricSync}>
                    <LyricSyncPanel {...lyricSyncProps} onClose={onCloseLyricSync} />
                </PanelWrapper>
            )}
        </AnimatePresence>
    );
};
