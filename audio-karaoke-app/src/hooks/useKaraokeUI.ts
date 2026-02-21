import { useState, useCallback } from 'react';
import { LyricTheme } from '@/components/Karaoke/LyricDisplay';
import { VisualSettings } from '@/types/karaoke';
import { getSettings, saveSettings } from '@/utils/storage/settingsStore';

export interface KaraokeUIState {
    showEditor: boolean;
    theme: LyricTheme;
    isStageMode: boolean;
    showSettings: boolean;
    showPractice: boolean;
    showRoom: boolean;
    showVoiceFx: boolean;
    showAutoKey: boolean;
    showLyricSync: boolean;
    isVisualSettingsOpen: boolean;
    visualSettings: VisualSettings;
}

export interface KaraokeUIActions {
    setShowEditor: (show: boolean) => void;
    setTheme: (theme: LyricTheme) => void;
    setIsStageMode: (enabled: boolean) => void;
    setShowSettings: (show: boolean) => void;
    setShowPractice: (show: boolean) => void;
    setShowRoom: (show: boolean) => void;
    setShowVoiceFx: (show: boolean) => void;
    setShowAutoKey: (show: boolean) => void;
    setShowLyricSync: (show: boolean) => void;
    setIsVisualSettingsOpen: (open: boolean) => void;
    setVisualSettings: (settings: VisualSettings) => void;
    
    // Toggles
    toggleStageMode: (enabled: boolean) => void;
    togglePractice: () => void;
    toggleRoom: () => void;
    toggleVoiceFx: () => void;
    toggleAutoKey: () => void;
    toggleLyricSync: () => void;
    toggleSettings: () => void;
    toggleVisualSettings: () => void;
    toggleEditor: (show: boolean) => void;
    
    // Complex Setters (with side effects like saving)
    updateTheme: (theme: LyricTheme) => void;
    updateVisualSettings: (settings: VisualSettings) => void;
}

export const useKaraokeUI = () => {
    const [showEditor, setShowEditor] = useState(false);
    
    // Initialize settings from store (lazy init to avoid effect)
    const [theme, setTheme] = useState<LyricTheme>(() => {
        try {
            return getSettings().theme;
        } catch {
            return 'modern';
        }
    });
    const [isStageMode, setIsStageMode] = useState(() => {
        try {
            return getSettings().stageModeEnabled;
        } catch {
            return false;
        }
    });

    const [showSettings, setShowSettings] = useState(false);
    const [showPractice, setShowPractice] = useState(false);
    const [showRoom, setShowRoom] = useState(false);
    const [showVoiceFx, setShowVoiceFx] = useState(false);
    const [showAutoKey, setShowAutoKey] = useState(false);
    const [showLyricSync, setShowLyricSync] = useState(false);
    const [isVisualSettingsOpen, setIsVisualSettingsOpen] = useState(false);

    const [visualSettings, setVisualSettings] = useState<VisualSettings>({
        highlightColor: 'text-yellow-400',
        fontSize: 'base',
        fontWeight: 'bold',
        textShadow: true,
        offset: 0,
        showDualText: false,
        visualizationMode: 'bars',
        autoQuality: true
    });


    const toggleStageMode = useCallback((val: boolean) => {
        setIsStageMode(val);
        saveSettings({ stageModeEnabled: val });
    }, []);

    const updateTheme = useCallback((t: LyricTheme) => {
        setTheme(t);
        saveSettings({ theme: t });
    }, []);

    const updateVisualSettings = useCallback((settings: VisualSettings) => {
        setVisualSettings(settings);
        // Note: We might want to save visual settings to store too if supported
    }, []);

    const togglePractice = useCallback(() => setShowPractice(prev => !prev), []);
    const toggleRoom = useCallback(() => setShowRoom(prev => !prev), []);
    const toggleVoiceFx = useCallback(() => setShowVoiceFx(prev => !prev), []);
    const toggleAutoKey = useCallback(() => setShowAutoKey(prev => !prev), []);
    const toggleLyricSync = useCallback(() => setShowLyricSync(prev => !prev), []);
    const toggleSettings = useCallback(() => setShowSettings(prev => !prev), []);
    const toggleVisualSettings = useCallback(() => setIsVisualSettingsOpen(prev => !prev), []); // Usually strictly controlled, but toggle supported
    
    return {
        state: {
            showEditor,
            theme,
            isStageMode,
            showSettings,
            showPractice,
            showRoom,
            showVoiceFx,
            showAutoKey,
            showLyricSync,
            isVisualSettingsOpen,
            visualSettings
        },
        actions: {
            setShowEditor,
            setTheme,
            setIsStageMode,
            setShowSettings,
            setShowPractice,
            setShowRoom,
            setShowVoiceFx,
            setShowAutoKey,
            setShowLyricSync,
            setIsVisualSettingsOpen,
            setVisualSettings,
            
            toggleStageMode,
            togglePractice,
            toggleRoom,
            toggleVoiceFx,
            toggleAutoKey,
            toggleLyricSync,
            toggleSettings,
            toggleVisualSettings,
            toggleEditor: setShowEditor,
            
            updateTheme,
            updateVisualSettings
        }
    };
};
