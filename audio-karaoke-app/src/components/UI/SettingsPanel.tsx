import React, { useEffect, useState } from 'react';
import { useModels } from '@/hooks/useModels';
import { getStorageStats, clearCache, formatSize, StorageStats } from '@/utils/storage/storageStats';
import { useTranslations } from 'next-intl';
import { VisualSettings } from '@/types/karaoke';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    selectedModelId?: string;
    onModelChange?: (modelId: string) => void;
    visualSettings?: VisualSettings;
    onVisualSettingsChange?: (settings: VisualSettings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    isOpen,
    onClose,
    selectedModelId,
    onModelChange,
    visualSettings,
    onVisualSettingsChange
}) => {
    const t = useTranslations('SettingsPanel');
    const { models: AVAILABLE_MODELS } = useModels();
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [localModelId, setLocalModelId] = useState(selectedModelId || '');

    useEffect(() => {
        if (isOpen) {
            getStorageStats().then(setStats);
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedModelId) {
            setLocalModelId(selectedModelId);
        } else if (!localModelId && AVAILABLE_MODELS.length > 0) {
            setLocalModelId(AVAILABLE_MODELS[0].id);
        }
    }, [selectedModelId, AVAILABLE_MODELS, localModelId]);

    const handleModelChange = (id: string) => {
        setLocalModelId(id);
        if (onModelChange) {
            onModelChange(id);
        }
    };

    const handleClearCache = async () => {
        if (confirm(t('clearCacheConfirm'))) {
            await clearCache();
            const newStats = await getStorageStats();
            setStats(newStats);
        }
    };

    const handleVisualChange = (key: keyof VisualSettings, value: any) => {
        if (onVisualSettingsChange && visualSettings) {
            onVisualSettingsChange({
                ...visualSettings,
                [key]: value
            });
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`
                    fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-white/10 z-[60] shadow-2xl transition-transform duration-500 ease-out p-8 flex flex-col
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
                role="dialog"
                aria-labelledby="settings-title"
            >
                <div className="flex justify-between items-center mb-8 shrink-0">
                    <h2 id="settings-title" className="text-2xl font-bold flex items-center gap-3 text-white">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('title')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/5 transition-colors text-white"
                        aria-label="Close settings"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-10">
                    {/* Visual Settings Section */}
                    {visualSettings && (
                        <section>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('visualSettings')}</h3>
                            <div className="space-y-4">
                                {/* Highlight Color */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <label className="block text-sm text-gray-400 mb-3">{t('highlightColor')}</label>
                                    <div className="flex gap-3 flex-wrap">
                                        {['text-yellow-400', 'text-cyan-400', 'text-green-500', 'text-pink-500', 'text-white'].map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => handleVisualChange('highlightColor', color)}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${visualSettings.highlightColor === color ? 'border-white scale-110 ring-2 ring-primary/50' : 'border-transparent opacity-60 hover:opacity-100'} ${color.replace('text-', 'bg-')}`}
                                                title={color}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Visualization Mode */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <label className="block text-sm text-gray-400 mb-2">{t('visualizationMode') || 'Visualization Mode'}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['bars', 'waveform', '3d-landscape', 'spectrogram'] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                onClick={() => handleVisualChange('visualizationMode', mode)}
                                                className={`py-2 px-3 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border ${
                                                    visualSettings.visualizationMode === mode 
                                                    ? 'bg-primary border-primary text-white' 
                                                    : 'bg-black/20 border-white/5 text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                            >
                                                {mode.replace('-', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Typography */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">{t('fontSize')}</label>
                                        <div className="flex bg-black/20 rounded-lg p-1">
                                            {(['sm', 'base', 'lg', 'xl'] as const).map((size) => (
                                                <button
                                                    key={size}
                                                    onClick={() => handleVisualChange('fontSize', size)}
                                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${visualSettings.fontSize === size ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                                >
                                                    {size.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">{t('fontWeight')}</label>
                                        <div className="flex bg-black/20 rounded-lg p-1">
                                            {(['normal', 'bold', 'extrabold'] as const).map((weight) => (
                                                <button
                                                    key={weight}
                                                    onClick={() => handleVisualChange('fontWeight', weight)}
                                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${visualSettings.fontWeight === weight ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                                >
                                                    {weight === 'extrabold' ? 'Heavy' : weight.charAt(0).toUpperCase() + weight.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Toggles */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <label className="text-sm font-semibold text-white">{t('textShadow')}</label>
                                        <button
                                            onClick={() => handleVisualChange('textShadow', !visualSettings.textShadow)}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${visualSettings.textShadow ? 'bg-primary' : 'bg-white/10'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${visualSettings.textShadow ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                                        <label className="text-sm font-semibold text-white">{t('showDualText')}</label>
                                        <button
                                            onClick={() => handleVisualChange('showDualText', !visualSettings.showDualText)}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${visualSettings.showDualText ? 'bg-primary' : 'bg-white/10'}`}
                                        >
                                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${visualSettings.showDualText ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Offset Adjustment */}
                                <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <div className="flex justify-between mb-4">
                                        <label className="text-sm font-semibold text-white">{t('lyricOffset')}</label>
                                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{(visualSettings.offset / 1000).toFixed(1)}s</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-5000"
                                        max="5000"
                                        step="100"
                                        value={visualSettings.offset}
                                        onChange={(e) => handleVisualChange('offset', parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono">
                                        <span>-5s</span>
                                        <span>0s</span>
                                        <span>+5s</span>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Performance Section */}
                    {visualSettings && (
                        <section>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('performance') || 'Performance'}</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <div>
                                        <div className="font-semibold text-white">{t('autoQuality') || 'Auto-Quality'}</div>
                                        <div className="text-xs text-muted-foreground">{t('autoQualityDesc') || 'Downsample visuals if CPU load is high'}</div>
                                    </div>
                                    <button
                                        onClick={() => handleVisualChange('autoQuality', !visualSettings.autoQuality)}
                                        className={`w-12 h-6 rounded-full transition-colors relative ${visualSettings.autoQuality ? 'bg-primary' : 'bg-white/10'}`}
                                    >
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${visualSettings.autoQuality ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Engine Settings */}
                    <section>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('processingEngine')}</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div>
                                    <div className="font-semibold text-white">{t('webGpu')}</div>
                                    <div className="text-xs text-muted-foreground">{t('webGpuDesc')}</div>
                                </div>
                                <div className="w-12 h-6 rounded-full bg-primary/20 relative cursor-pointer ring-2 ring-primary" role="switch" aria-checked="true">
                                    <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary shadow-sm"></div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <label htmlFor="model-select" className="block font-semibold mb-3 text-white">{t('modelVersion')}</label>
                                <select
                                    id="model-select"
                                    className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                                    value={localModelId}
                                    onChange={(e) => handleModelChange(e.target.value)}
                                >
                                    {AVAILABLE_MODELS.map(model => (
                                        <option key={model.id} value={model.id}>
                                            {model.name} {model.description ? ` - ${model.description}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
};
