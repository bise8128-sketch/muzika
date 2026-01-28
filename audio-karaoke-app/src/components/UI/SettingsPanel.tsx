'use client';

import React from 'react';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Panel */}
            <div className={`
        fixed top-0 right-0 h-full w-full max-w-md bg-card border-l border-white/10 z-[60] shadow-2xl transition-transform duration-500 ease-out p-8
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/5 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-10">
                    {/* Engine Settings */}
                    <section>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Processing Engine</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div>
                                    <div className="font-semibold mb-1">WebGPU Acceleration</div>
                                    <div className="text-xs text-muted-foreground">Faster inference using your GPU</div>
                                </div>
                                <div className="w-12 h-6 rounded-full bg-primary/20 relative cursor-pointer ring-2 ring-primary">
                                    <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary"></div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div className="font-semibold mb-3">Model Version</div>
                                <select className="w-full bg-background border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                                    <option>MDX-Net Vocals/Instruments (v2)</option>
                                    <option>Kim_Vocal_2 (Lightweight)</option>
                                    <option disabled>Demucs v4 (Coming Soon)</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* Audio Settings */}
                    <section>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Audio Output</h3>
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div className="flex justify-between mb-2">
                                    <div className="font-semibold">Sample Rate</div>
                                    <div className="text-xs text-primary font-bold">44.1 kHz</div>
                                </div>
                                <input type="range" className="w-full accent-primary bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer" />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                                <div className="font-semibold">Normalization</div>
                                <div className="w-12 h-6 rounded-full bg-white/5 relative cursor-pointer border border-white/10">
                                    <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white/20"></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Cache Management */}
                    <section>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Storage</h3>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                            <div>
                                <div className="font-semibold">Model Cache</div>
                                <div className="text-xs text-muted-foreground">42.5 MB used</div>
                            </div>
                            <button className="px-4 py-1.5 rounded-lg border border-destructive/30 text-destructive text-sm hover:bg-destructive/10 transition-all">Clear</button>
                        </div>
                    </section>
                </div>

                <div className="absolute bottom-8 left-8 right-8">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-white/5 text-center">
                        <p className="text-xs text-muted-foreground">Muzika v1.0.0 Stable</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1">Made with ❤️ for high-quality audio</p>
                    </div>
                </div>
            </div>
        </>
    );
};
