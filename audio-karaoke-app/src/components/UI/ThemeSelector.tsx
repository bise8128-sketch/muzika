'use client';

import React from 'react';
import { useTheme, ThemeType } from '@/context/ThemeContext';
import { motion } from 'framer-motion';
import { Palette, Check } from 'lucide-react';

const THEMES: { id: ThemeType; label: string; colors: string[] }[] = [
    { id: 'midnight', label: 'Midnight Studio', colors: ['#9333ea', '#ec4899', '#050505'] },
    { id: 'cyberpunk', label: 'Cyberpunk Neon', colors: ['#06b6d4', '#f472b6', '#020617'] },
    { id: 'aurora', label: 'Aurora', colors: ['#10b981', '#3b82f6', '#022c22'] },
];

export const ThemeSelector: React.FC = () => {
    const { theme, setTheme } = useTheme();

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Palette className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-black uppercase tracking-widest text-white/70">
                    Visual Themes
                </h4>
            </div>

            <div className="grid grid-cols-1 gap-2">
                {THEMES.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`group relative flex items-center justify-between p-3 rounded-2xl transition-all border
                            ${theme === t.id 
                                ? 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/5' 
                                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                {t.colors.map((c, i) => (
                                    <div 
                                        key={i} 
                                        className="w-4 h-4 rounded-full border border-black/50"
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-tight
                                ${theme === t.id ? 'text-primary' : 'text-white/40 group-hover:text-white/60'}`}>
                                {t.label}
                            </span>
                        </div>

                        {theme === t.id && (
                            <motion.div
                                layoutId="theme-check"
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-primary"
                            >
                                <Check className="w-4 h-4" />
                            </motion.div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};
