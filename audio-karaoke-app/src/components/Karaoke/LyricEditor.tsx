'use client';

import React, { useState, useEffect, useRef } from 'react';
import { LRCData, LyricLine } from '@/types/karaoke';
import { formatLRCTimestamp, parseLRCStrict } from '@/utils/karaoke/lrcParser';
import { generateLRCContent, downloadLRCFile } from '@/utils/karaoke/lrcExport';
import { useTranslations } from 'next-intl';
import { useLyricSync } from '@/hooks/useLyricSync';
import { PlaybackController } from '@/utils/audio/playback/PlaybackCore';
import { WhisperProgressIndicator } from './WhisperProgressIndicator';

interface LyricEditorProps {
    currentTime: number;
    onSave: (lrc: LRCData) => void;
    initialLRC?: LRCData | null;
    controller: PlaybackController;
}

export const LyricEditor: React.FC<LyricEditorProps> = ({ currentTime, onSave, initialLRC, controller }) => {
    const t = useTranslations('LyricEditor');
    const [rawText, setRawText] = useState('');
    const [lines, setLines] = useState<LyricLine[]>([]);
    const [editMode, setEditMode] = useState<'text' | 'sync'>('text');
    const [activeLineIndex, setActiveLineIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { startSync, progress, result, isProcessing } = useLyricSync();

    useEffect(() => {
        if (initialLRC) {
            setLines(initialLRC.lines);
            setRawText(initialLRC.lines.map(l => l.text).join('\n'));
        }
    }, [initialLRC]);

    const handleAISync = async () => {
        if (lines.length === 0) return;
        const plainLyrics = lines.map(l => l.text);
        startSync(plainLyrics);
    };

    useEffect(() => {
        if (progress?.stage === 'done' && result) {
            setLines(result.lines);
            setEditMode('sync');
            setActiveLineIndex(result.lines.length);
        }
    }, [progress, result]);

    const playbackLineIndex = React.useMemo(() => {
        if (!lines.length || currentTime === 0) return -1;
        let idx = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startTime <= currentTime) {
                idx = i;
            } else {
                break;
            }
        }
        return idx;
    }, [lines, currentTime]);

    const lineProgress = React.useMemo(() => {
        if (playbackLineIndex === -1 || playbackLineIndex >= lines.length) return 0;
        const currentLine = lines[playbackLineIndex];
        if (currentTime < currentLine.startTime) return 0;
        
        // Use next line's start time as end time if current line doesn't have an end time
        const endTime = playbackLineIndex < lines.length - 1 
            ? lines[playbackLineIndex + 1].startTime 
            : (currentLine.endTime || currentLine.startTime + 5);
            
        const duration = Math.max(0.1, endTime - currentLine.startTime);
        return Math.min(1, Math.max(0, (currentTime - currentLine.startTime) / duration));
    }, [currentTime, playbackLineIndex, lines]);

    useEffect(() => {
        if (editMode === 'sync' && containerRef.current) {
            const targetIndex = activeLineIndex >= lines.length ? playbackLineIndex : activeLineIndex;
            if (targetIndex >= 0 && targetIndex < lines.length) {
                const activeChild = containerRef.current.children[targetIndex] as HTMLElement;
                if (activeChild) {
                    activeChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }
    }, [activeLineIndex, playbackLineIndex, editMode, lines.length]);

    // Keyboard shortcuts for sync mode
    useEffect(() => {
        if (editMode !== 'sync') return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    if (controller.getIsPlaying()) {
                        controller.pause();
                    } else {
                        controller.play();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setActiveLineIndex(prev => Math.max(0, prev - 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setActiveLineIndex(prev => Math.min(lines.length - 1, prev + 1));
                    break;
                case 'ArrowLeft':
                case 'ArrowRight':
                    e.preventDefault();
                    if (activeLineIndex >= 0 && activeLineIndex < lines.length) {
                        setLines(prev => {
                            const newLines = [...prev];
                            const current = newLines[activeLineIndex];
                            const delta = e.code === 'ArrowRight' ? 0.1 : -0.1;
                            newLines[activeLineIndex] = {
                                ...current,
                                startTime: Math.max(0, current.startTime + delta)
                            };
                            return newLines;
                        });
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editMode, activeLineIndex, lines, controller]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        setRawText(text);
        const newLines = text.split('\n').filter(l => l.trim()).map(line => ({
            startTime: 0,
            endTime: 0,
            text: line.trim()
        }));
        setLines(newLines);
    };

    const startManualSync = () => {
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
        const content = generateLRCContent(lines, initialLRC?.metadata);
        downloadLRCFile(content, 'lyrics.lrc');
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setRawText(text);
                const newLines = text.split('\n').filter(l => l.trim()).map(line => ({
                    startTime: 0,
                    endTime: 0,
                    text: line.trim()
                }));
                setLines(newLines);
            }
        } catch (err) {
            console.error('Failed to read clipboard', err);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            try {
                const parsed = parseLRCStrict(text);
                setRawText(text);
                setLines(parsed.lines);
                setEditMode('sync');
                setActiveLineIndex(0);
            } catch (err) {
                console.error('Failed to parse LRC file:', err);
                alert(t('importError') || 'Failed to parse the LRC file. Please ensure it is a valid format.');
            }
        };

        reader.readAsText(file);
        
        // Reset the file input so the same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleClear = () => {
        if (confirm(t('clearConfirm'))) {
            setRawText('');
            setLines([]);
        }
    };

    return (
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">{t('title')}</h2>
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        accept=".lrc" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                    />
                    {editMode === 'text' && (
                        <>
                            <button
                                onClick={handleAISync}
                                disabled={isProcessing || lines.length === 0}
                                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-full text-sm font-medium transition-all flex items-center gap-2 border border-purple-500/30"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                AI Auto-Sync
                            </button>
                            <button
                                onClick={handlePaste}
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full text-sm font-medium transition-all flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                {t('paste')}
                            </button>
                            <button
                                onClick={handleClear}
                                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-full text-sm font-medium transition-all"
                            >
                                {t('clear')}
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-full text-sm font-medium transition-all flex items-center gap-2 border border-white/10"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {t('importLrc') || 'Import LRC'}
                    </button>
                    <button
                        onClick={() => setEditMode('text')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${editMode === 'text' ? 'bg-primary text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    >
                        {t('editText')}
                    </button>
                    <button
                        onClick={startManualSync}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${editMode === 'sync' ? 'bg-primary text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
                    >
                        {t('syncMode')}
                    </button>
                </div>
            </div>

            {editMode === 'text' ? (
                <>
                    <WhisperProgressIndicator progress={progress} isProcessing={isProcessing} />
                    <textarea
                        value={rawText}
                        onChange={handleTextChange}
                        className="w-full h-[400px] bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-mono focus:ring-2 focus:ring-primary outline-none resize-none"
                        placeholder={t('placeholder')}
                    />
                </>
            ) : (
                <div className="space-y-4">
                    <div ref={containerRef} className="h-[400px] overflow-y-auto space-y-2 pr-2 no-scrollbar">
                        {lines.map((line, index) => (
                            <div
                                key={index}
                                onDoubleClick={() => controller.setCurrentTime(line.startTime)}
                                title={t('doubleClickSeek') || 'Double-click to seek'}
                                className={`p-4 rounded-2xl transition-all border cursor-pointer relative overflow-hidden ${
                                    index === playbackLineIndex
                                        ? 'bg-purple-500/20 border-purple-400/50 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)] scale-[1.02]'
                                        : index === activeLineIndex
                                            ? 'bg-primary/20 border-primary text-white'
                                            : index < activeLineIndex
                                                ? 'bg-white/10 border-white/5 text-white/80 hover:bg-white/20'
                                                : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
                                    }`}
                            >
                                {index === playbackLineIndex && (
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-purple-500/20 pointer-events-none"
                                        style={{ width: `${lineProgress * 100}%`, transition: 'width 100ms linear' }}
                                    />
                                )}
                                <div className="flex justify-between relative z-10">
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
                        {t('markLine') || 'Mark Line'}
                    </button>
                    
                    <div className="flex justify-center gap-6 text-[10px] text-white/30 uppercase tracking-wider font-semibold pt-1">
                        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/50 font-sans">Space</kbd> Play / Pause</span>
                        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/50 font-sans">↑↓</kbd> Navigate Line</span>
                        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/50 font-sans">←→</kbd> Nudge 0.1s</span>
                    </div>
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
                    {t('download')}
                </button>
                <button
                    onClick={handleSave}
                    className="px-8 py-2 bg-primary hover:bg-primary/80 text-white rounded-full font-bold transition-all shadow-lg shadow-primary/20"
                >
                    {t('save')}
                </button>
            </div>
        </div>
    );
};
