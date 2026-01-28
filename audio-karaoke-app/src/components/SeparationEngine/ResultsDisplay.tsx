'use client';

import React from 'react';

interface track {
    id: string;
    name: string;
    blob: Blob | null;
}

interface ResultsDisplayProps {
    tracks: track[];
    onDownload: (track: track, format: 'wav' | 'mp3') => void;
    onRestart: () => void;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ tracks, onDownload, onRestart }) => {
    return (
        <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-1000">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold mb-2 text-gradient">Separation Complete</h2>
                    <p className="text-muted-foreground">Your tracks are ready for download.</p>
                </div>
                <button
                    onClick={onRestart}
                    className="px-6 py-2.5 rounded-xl glass hover:bg-white/10 transition-all font-medium flex items-center gap-2 group"
                >
                    <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Process Another
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tracks.map((track) => (
                    <div key={track.id} className="glass-card p-6 rounded-3xl group hover:border-primary/20 transition-all relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-2xl ${track.id === 'vocals' ? 'bg-purple-500/20 text-purple-400' : 'bg-pink-500/20 text-pink-400'}`}>
                                        {track.id === 'vocals' ? (
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                            </svg>
                                        ) : (
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">{track.name}</h3>
                                        <p className="text-sm text-muted-foreground">Original quality restored</p>
                                    </div>
                                </div>
                            </div>

                            {/* Fake Waveform for visual polish */}
                            <div className="h-16 flex items-center gap-1 mb-8 opacity-40">
                                {Array.from({ length: 40 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 bg-gradient-to-t from-primary/50 to-accent/50 rounded-full"
                                        style={{ height: `${20 + Math.random() * 80}%` }}
                                    ></div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => onDownload(track, 'wav')}
                                    className="flex-1 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    WAV
                                </button>
                                <button
                                    onClick={() => onDownload(track, 'mp3')}
                                    className="flex-1 px-4 py-3 rounded-xl glass hover:bg-white/10 text-white font-semibold transition-all flex items-center justify-center gap-2 border border-white/5"
                                >
                                    MP3
                                </button>
                            </div>
                        </div>

                        {/* Decorative background glow */}
                        <div className={`absolute -bottom-8 -right-8 w-32 h-32 blur-[60px] rounded-full opacity-20 ${track.id === 'vocals' ? 'bg-purple-500' : 'bg-pink-500'}`}></div>
                    </div>
                ))}
            </div>

            <div className="glass-card p-6 rounded-3xl border-primary/20 bg-primary/5">
                <div className="flex items-center gap-6">
                    <div className="text-4xl animate-bounce">🎁</div>
                    <div>
                        <h4 className="font-bold text-lg mb-1">Did you know?</h4>
                        <p className="text-sm text-muted-foreground">
                            You can also use our <span className="text-primary font-medium">Karaoke Mode</span> to sing along with real-time lyrics and pitch adjustment!
                        </p>
                    </div>
                    <button className="ml-auto px-6 py-2 bg-white text-black rounded-xl font-bold hover:scale-105 transition-all">TRY KARAOKE</button>
                </div>
            </div>
        </div>
    );
};
