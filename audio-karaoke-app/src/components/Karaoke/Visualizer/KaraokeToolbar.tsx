import React from 'react';
import { motion } from 'framer-motion';
import { Maximize2, Target, Users, Settings, Mic2, Edit3, Music } from 'lucide-react';
import { LyricTheme } from '../LyricDisplay';
import { VisualSettings, LRCData } from '@/types/karaoke';

interface KaraokeToolbarProps {
    lyrics: LRCData | null;
    cdgData: Uint8Array | null;
    showEditor: boolean;
    theme: LyricTheme;
    showPractice: boolean;
    showRoom: boolean;
    showVoiceFx: boolean;
    showAutoKey: boolean;
    isVisualSettingsOpen: boolean;
    onThemeChange: (theme: LyricTheme) => void;
    onTogglePractice: () => void;
    onToggleRoom: () => void;
    onToggleVoiceFx: () => void;
    onToggleAutoKey: () => void;
    onToggleEditor: (show: boolean) => void;
    onToggleStageMode: (enabled: boolean) => void;
    onVisualSettingsChange: (settings: VisualSettings) => void;
    visualSettings: VisualSettings;
}

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

export const KaraokeToolbar: React.FC<KaraokeToolbarProps> = ({
    lyrics,
    cdgData,
    showEditor,
    theme,
    showPractice,
    showRoom,
    showVoiceFx,
    showAutoKey,
    isVisualSettingsOpen,
    onThemeChange,
    onTogglePractice,
    onToggleRoom,
    onToggleVoiceFx,
    onToggleAutoKey,
    onToggleEditor,
    onToggleStageMode,
    onVisualSettingsChange,
    visualSettings
}) => {
    if ((!lyrics && !cdgData) || showEditor) return null;

    return (
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
                icon={<Music className="w-4 h-4" />} 
                active={showAutoKey} 
                onClick={onToggleAutoKey} 
                label="Auto-Key" 
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
    );
};
