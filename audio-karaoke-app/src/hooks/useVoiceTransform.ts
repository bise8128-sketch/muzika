import { useState, useRef, useEffect, useCallback } from 'react';
import { VoiceProcessor } from '@/utils/audio/processing/VoiceProcessor';
import { VoiceTransformSettings, VOICE_PRESETS, VoicePreset } from '@/types/audio';

export const useVoiceTransform = () => {
    const processorRef = useRef<VoiceProcessor | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [currentPreset, setCurrentPreset] = useState<VoicePreset>('basic');
    const [settings, setSettings] = useState<VoiceTransformSettings>(VOICE_PRESETS.basic);
    const [isMonitoring, setIsMonitoring] = useState(false);

    useEffect(() => {
        // Lazy initialization
        return () => {
             if (processorRef.current) {
                 processorRef.current.dispose();
             }
        };
    }, []);

    const initProcessor = useCallback(async () => {
        if (!processorRef.current) {
            processorRef.current = new VoiceProcessor();
        }
        await processorRef.current.openMicrophone();
        setIsInitialized(true);
        // Apply initial settings
        processorRef.current.applySettings(settings);
    }, [settings]);

    const setPreset = useCallback((preset: VoicePreset) => {
        setCurrentPreset(preset);
        const newSettings = VOICE_PRESETS[preset];
        setSettings(newSettings);
        if (processorRef.current) {
            processorRef.current.applySettings(newSettings);
        }
    }, []);

    const updateSettings = useCallback((updates: Partial<VoiceTransformSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...updates };
            if (processorRef.current) {
                processorRef.current.applySettings(next);
            }
            return next;
        });
    }, []);
    
    const toggleMonitoring = useCallback(() => {
        const next = !isMonitoring;
        setIsMonitoring(next);
        if (processorRef.current) {
            processorRef.current.setMonitoring(next);
        }
    }, [isMonitoring]);

    const getProcessedStream = useCallback(() => {
        return processorRef.current?.getProcessedStream();
    }, []);

    return {
        isInitialized,
        currentPreset,
        settings,
        isMonitoring,
        initProcessor,
        setPreset,
        updateSettings,
        toggleMonitoring,
        getProcessedStream
    };
};
