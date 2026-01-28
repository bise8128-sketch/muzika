'use client';

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

import { PlaybackController } from '@/utils/audio/playbackController';
import { AudioUpload } from '@/components/AudioUpload/AudioUpload';
import { BatchQueue } from '@/components/Batch/BatchQueue';
import { useBatchSeparation, QueueItem } from '@/hooks/useBatchSeparation';

const KaraokePlayer = dynamic(() => import('@/components/Karaoke/KaraokePlayer').then(mod => mod.KaraokePlayer), {
  loading: () => <div className="h-64 flex items-center justify-center">Loading Karaoke Player...</div>,
  ssr: false
});

const ResultsDisplay = dynamic(() => import('@/components/SeparationEngine/ResultsDisplay').then(mod => mod.ResultsDisplay), {
  loading: () => <div className="h-64 flex items-center justify-center">Preparing results...</div>,
  ssr: false
});

const SettingsPanel = dynamic(() => import('@/components/UI/SettingsPanel').then(mod => mod.SettingsPanel), {
  ssr: false
});

const History = dynamic(() => import('@/components/UI/History').then(mod => mod.History), {
  ssr: false
});

type AppState = 'upload' | 'processing' | 'results' | 'karaoke';

import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '@/utils/constants';
import { useSeparation } from '@/hooks/useSeparation';

// ... existing dynamic imports ...

export default function Home() {
  const [state, setState] = useState<AppState>('upload');
  const [controller, setController] = useState<PlaybackController | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Model Selection
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);

  // Separation Hook
  const {
    separate,
    progress: separationProgress,
    status: separationStatus,
    message: separationMessage,
    result: separationResult,
    reset: resetSeparation
  } = useSeparation();

  // Mock history for demo (keep for now)
  const [historyItems, setHistoryItems] = useState([
    { id: '1', fileName: 'Bohemian Rhapsody.mp3', date: '2 hours ago', duration: '5:55' },
    { id: '2', fileName: 'Imagine.wav', date: 'Yesterday', duration: '3:03' }
  ]);

  useEffect(() => {
    const newController = new PlaybackController();
    setController(newController);
    return () => newController.dispose();
  }, []);

  // Update UI based on separation status
  useEffect(() => {
    if (separationStatus === 'processing') {
      setState('processing');
    } else if (separationStatus === 'completed' && separationResult) {
      // Short delay for smooth transition
      const timer = setTimeout(() => setState('results'), 500);
      return () => clearTimeout(timer);
    } else if (separationStatus === 'error') {
      // Handle error state (maybe stay on results with error, or alert)
      console.error("Separation Error", separationMessage);
      // ideally set state to error or show toast
      setState('upload'); // Reset for now or show error UI
      alert(`Error: ${separationMessage || 'Unknown error'}`);
    }
  }, [separationStatus, separationResult, separationMessage]);

  const handleUpload = async (file: File) => {
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
    if (!modelInfo) {
      alert('Selected model not found!');
      return;
    }

    try {
      await separate(file, modelInfo);
    } catch (e) {
      console.error("Upload/Separation failed immediately:", e);
    }
  };

  const handleDownload = (track: any, format: string) => {
    console.log(`Downloading ${track.name} as ${format}`);
    // Real implementation would use the encoded blob
  };

  const handleRestart = () => {
    setState('upload');
    resetSeparation();
  };

  const handleTryKaraoke = () => {
    setState('karaoke');
  };

  const clearHistory = () => {
    setHistoryItems([]);
  };

  const renderContent = () => {
    switch (state) {
      case 'upload':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <AudioUpload onUpload={handleUpload} />
            <History items={historyItems} onRestore={() => setState('results')} onClear={clearHistory} />
          </div>
        );

      case 'processing':
        return (
          <div className="max-w-2xl mx-auto py-20 text-center animate-in zoom-in-95 duration-500">
            <div className="relative inline-block mb-12">
              <div className="w-32 h-32 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl">
                {Math.round(separationProgress)}%
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-4 text-gradient">Separating Audio...</h2>
            <p className="text-muted-foreground animate-pulse">
              {separationMessage || 'Running AI models locally on your GPU'}
            </p>

            <div className="mt-12 space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-widest px-1">
                <span>Status: {separationStatus}</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${separationProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        );

      case 'results':
        return (
          <ResultsDisplay
            tracks={[
              { id: 'vocals', name: 'Vocals', blob: separationResult?.vocals || null },
              { id: 'instrumental', name: 'Instrumental', blob: separationResult?.instrumentals || null }
            ]}
            onDownload={handleDownload}
            onRestart={handleRestart}
          />
        );

      case 'karaoke':
        return (
          <div className="animate-in fade-in duration-700">
            <button
              onClick={() => setState('results')}
              className="mb-8 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Results
            </button>
            {controller && <KaraokePlayer controller={controller} />}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen selection:bg-primary/30">
      <Head>
        <title>Muzika | Professional AI Audio Separation</title>
        <meta name="description" content="Premium, browser-native AI audio separation with high-fidelity output." />
      </Head>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/5">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleRestart}>
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <span className="text-2xl font-black tracking-tighter">MUZIKA</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">How it works</a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Models</a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">Privacy</a>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl hover:bg-white/5 transition-colors border border-white/5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-6 pt-32 pb-20">
        {state === 'upload' && (
          <header className="text-center max-w-3xl mx-auto mb-16 space-y-6">
            <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest animate-float">
              Active Model: {AVAILABLE_MODELS.find(m => m.id === selectedModelId)?.name || 'Unknown'}
            </div>
            <h1 className="text-6xl md:text-7xl font-black tracking-tight leading-tight">
              Separate your music <br />
              <span className="text-gradient">with AI precision.</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-xl mx-auto">
              Professional vocal and instrumental separation directly in your browser. No accounts, no servers, just quality.
            </p>
          </header>
        )}

        {renderContent()}
      </main>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedModelId={selectedModelId}
        onModelChange={setSelectedModelId}
      />


      {/* Footer / Credits */}
      <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground">
        <p>© 2026 Muzika. Built with Next.js, ONNX, and Tailwind 4.</p>
      </footer>
    </div>
  );
}
