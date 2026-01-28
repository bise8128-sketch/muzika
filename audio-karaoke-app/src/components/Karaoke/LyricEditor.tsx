'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LRCData, LyricLine } from '@/types/karaoke';
import { formatLRCTimestamp, parseLRC } from '@/utils/karaoke/lrcParser';

interface LyricEditorProps {
    currentTime: number;
    onSave: (lrc: LRCData) => void;
    initialLRC?: LRCData | null;
}

export const LyricEditor: React.FC<LyricEditorProps> = ({ currentTime, onSave, initialLRC }) => {
    const [rawText, setRawText] = useState('');
    const [lines, setLines] = useState<LyricLine[]>([]);
    const [editMode, setEditMode] = useState<'text' | 'sync'>('text');
    const [activeLineIndex, setActiveLineIndex] = useState(0);

    useEffect(() => {
        if (initialLRC) {
            setLines(initialLRC.lines);
            setRawText(initialLRC.lines.map(l => l.text).join('\n'));
        }
    }, [initialLRC]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setRawText(text);
        const newLines = text.split('\n').map(line => ({
            startTime: 0,
            endTime: 0,
            text: line.trim()
        }));
        setLines(newLines);
    };

    const startSync = () => {
        setEditMode('sync');
        setActiveLineIndex(0);
    };

    const markTimestamp = () => {
        if (activeLineIndex >= lines.length) return;

        const newLines = [...lines];
        newLines[activeLineIndex].startTime = currentTime;

        // Update previous line's endTime
        if (activeLineIndex > 0) {
            newLines[activeLineIndex - 1].endTime = currentTime;
        }

        setLines(newLines);
        setActiveLineIndex(prev => prev + 1);
    };

    const handleSave = () => {
        const lrcData: LRCData = {
            lines: lines.filter(l => l.text),
            metadata: initialLRC?.metadata || { title: 'New Recording' }
        };
        onSave(lrcData);
    };

    const downloadLRC = () => {
        let content = '';
        // Add metadata
        if (initialLRC?.metadata) {
            Object.entries(initialLRC.metadata).forEach(([key, value]) => {
                content += `[${key}:${value}]\n`;
            });
        }

        // Add lines
        lines.forEach(line => {
            content += `${formatLRCTimestamp(line.startTime)}${line.text}\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lyrics.lrc';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Lyric Editor</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setEditMode('text')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${editMode === 'text' ? 'bg-primary text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        Edit Text
                    </button>
                    <button
                        onClick={startSync}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${editMode === 'sync' ? 'bg-primary text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'
                            }`}
                    >
                        Sync Mode
                    </button>
                </div>
            </div>

            {editMode === 'text' ? (
                <textarea
                    value={rawText}
                    onChange={handleTextChange}
                    className="w-full h-[400px] bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-mono focus:ring-2 focus:ring-primary outline-none resize-none"
                    placeholder="Paste your lyrics here, one line per line..."
                />
            ) : (
                <div className="space-y-4">
                    <div className="h-[400px] overflow-y-auto space-y-2 pr-2 no-scrollbar">
                        {lines.map((line, index) => (
                            <div
                                key={index}
                                className={`p-4 rounded-2xl transition-all border ${index === activeLineIndex
                                        ? 'bg-primary/20 border-primary text-white'
                                        : index < activeLineIndex
                                            ? 'bg-white/10 border-white/5 text-white/80'
                                            : 'bg-white/5 border-transparent text-white/40'
                                    }`}
                            >
                                <div className="flex justify-between">
                                    <span>{line.text || '♪'}</span>
                                    <span className="font-mono text-xs opacity-60">
                                        {line.startTime > 0 ? formatLRCTimestamp(line.startTime) : '--:--.--'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={markTimestamp}
                        disabled={activeLineIndex >= lines.length}
                        className="w-full py-6 bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 text-white font-bold text-xl rounded-2xl transition-all active:scale-95 shadow-lg shadow-primary/20"
                    >
                        Mark Next Line [Space]
                    </button>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                    onClick={downloadLRC}
                    className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download .LRC
                </button>
                <button
                    onClick={handleSave}
                    className="px-8 py-2 bg-primary text-white rounded-full font-bold hover:bg-primary/90 transition-all"
                >
                    Apply to Player
                </button>
            </div>
        </div>
    );
};
