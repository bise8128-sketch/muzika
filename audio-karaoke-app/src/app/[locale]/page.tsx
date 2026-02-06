'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

import { PlaybackController } from '@/utils/audio/playbackController';
import { AudioUpload } from '@/components/AudioUpload/AudioUpload';
import { BatchQueue } from '@/components/Batch/BatchQueue';
import { useBatchSeparation, QueueItem } from '@/hooks/useBatchSeparation';
import { exportAudio, MP3ExportError, getErrorMessage } from '@/utils/audio/audioExporter';
import { getHistorySessions, restoreSession, clearHistory as dbClearHistory, HistorySession } from '@/utils/storage/historyStore';
import { float32ArrayToAudioBuffer } from '@/utils/audio/audioDecoder';
import { getSettings, saveSettings } from '@/utils/storage/settingsStore';
import { songsStorage } from '@/utils/storage/songsStorage';
import { DEFAULT_MODEL_ID } from '@/utils/constants';
import { useSeparation } from '@/hooks/useSeparation';
import { useModels } from '@/hooks/useModels';
import LanguageSwitcher from '@/components/UI/LanguageSwitcher';

const KaraokePlayer = dynamic(() => import('@/components/Karaoke/KaraokePlayer').then(mod => mod.KaraokePlayer), {
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Loading Karaoke Player...</div>,
  ssr: false
});

const ResultsDisplay = dynamic(() => import('@/components/SeparationEngine/ResultsDisplay').then(mod => mod.ResultsDisplay), {
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Preparing results...</div>,
  ssr: false
});

const SettingsPanel = dynamic(() => import('@/components/UI/SettingsPanel').then(mod => mod.SettingsPanel), {
  ssr: false
});

const History = dynamic(() => import('@/components/UI/History').then(mod => mod.History), {
  ssr: false
});

const Onboarding = dynamic(() => import('@/components/UI/Onboarding').then(mod => mod.Onboarding), {
  ssr: false
});

const ModelManager = dynamic(() => import('@/components/ModelManager/ModelManager').then(mod => mod.ModelManager), {
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Loading Model Manager...</div>,
  ssr: false
});

import { SeparationResult as ISeparationResult } from '@/types/audio';

type AppState = 'upload' | 'processing' | 'results' | 'karaoke' | 'models' | 'batch';

interface DownloadTrack {
  id: string;
  name: string;
  blob: Blob | AudioBuffer | null;
}

// Backend Status Component
function BackendStatus() {
  const t = useTranslations('BackendStatus');
  const [status, setStatus] = useState<'online' | 'error' | 'loading'>('loading');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (res.ok) {
          const data = await res.json();
          setStatus(data.services.modelRepository === 'connected' ? 'online' : 'error');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-white/10">
      <div
        role="status"
        aria-label={status === 'online' ? 'System Online' : status === 'error' ? 'System Error' : 'System Loading'}
        className={`w-2 h-2 rounded-full transition-all duration-500 ${status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
          status === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
            'bg-amber-500 animate-pulse'
          }`}
      />
      <span className={status === 'error' ? 'text-rose-400' : 'text-muted-foreground'}>
        {t('backend', { status })}
      </span>
    </div>
  );
}

export default function Home() {
  const t = useTranslations('HomePage');
  const router = useRouter();
  const { models: AVAILABLE_MODELS } = useModels();
  const [state, setState] = useState<AppState>('upload');
  const [controller] = useState(() => new PlaybackController());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [autoStartKaraoke, setAutoStartKaraoke] = useState(() => {
    if (typeof window !== 'undefined') {
      return getSettings().autoStartKaraoke;
    }
    return false;
  });

  // Result state (from hook OR from restoration)
  const [restoredResult, setRestoredResult] = useState<ISeparationResult | null>(null);

  // Model Selection
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);

  // Separation Hook
  const {
    separate,
    progress: separationProgress,
    status: separationStatus,
    message: separationMessage,
    error: separationError,
    result: separationResult,
    reset: resetSeparation
  } = useSeparation();

  // Batch Hook
  const batch = useBatchSeparation();

  const handleBatchDownload = async (item: QueueItem) => {
    if (!item.result) return;
    const baseName = item.file.name.replace(/\.[^/.]+$/, "");
    await exportAudio(item.result.vocals, 'mp3', `${baseName}_vocals.mp3`);
    await exportAudio(item.result.instrumentals, 'mp3', `${baseName}_instrumental.mp3`);
  };

  // History state
  const [historyItems, setHistoryItems] = useState<HistorySession[]>([]);

  const loadHistory = async () => {
    const sessions = await getHistorySessions();
    setHistoryItems(sessions);
  };

  // Load history on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const sessions = await getHistorySessions();
      if (mounted) {
        setHistoryItems(sessions);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  // Dispose controller on unmount
  useEffect(() => {
    return () => {
      if (controller) controller.dispose();
    };
  }, [controller]);

  // Update UI based on separation status
  useEffect(() => {
    if (separationStatus === 'completed' && separationResult) {
      // Refresh history
      loadHistory();

      // If auto-start is enabled, set buffers and go to karaoke
      if (autoStartKaraoke && controller) {
        controller.setAudioBuffers([separationResult.vocals, separationResult.instrumentals]);
        setState('karaoke');
      } else {
        // Short delay for smooth transition
        const timer = setTimeout(() => setState('results'), 500);
        return () => clearTimeout(timer);
      }
    } else if (separationStatus === 'error') {
      console.error("Separation Error:", separationError);
      setState('upload');
      alert(`Error: ${separationError || 'Unknown error'}`);
    }
  }, [separationStatus, separationResult, autoStartKaraoke, controller, separationError]);

  const handleUpload = async (files: File[], isKaraokeMode: boolean = false) => {
    if (files.length === 0) return;

    if (isKaraokeMode) {
      try {
        for (const file of files) {
          await songsStorage.saveDirectKaraoke(file);
        }
        // Navigate to library or show success
        router.push('/library');
      } catch (e) {
        console.error("Failed to save karaoke song:", e);
        alert("Failed to save song to library.");
      }
      return;
    }

    if (files.length > 1) {
      batch.addToQueue(files);
      setState('batch');
      return;
    }

    const file = files[0];
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
    if (!modelInfo) {
      alert('Selected model not found!');
      return;
    }

    try {
      setState('processing');
      await separate(file, modelInfo);
    } catch (e) {
      console.error("Upload/Separation failed immediately:", e);
    }
  };

  const handleDownload = async (track: DownloadTrack, format: 'wav' | 'mp3') => {
    if (!track.blob) {
      alert('Track data not available for download');
      return;
    }

    try {
      let buffer: AudioBuffer;

      // Handle both Blob and AudioBuffer types
      if (track.blob instanceof AudioBuffer) {
        buffer = track.blob;
      } else if (track.blob instanceof Blob) {
        // Convert Blob to AudioBuffer
        const arrayBuffer = await track.blob.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        buffer = await audioContext.decodeAudioData(arrayBuffer);
      } else {
        throw new Error('Invalid track data type');
      }

      const filename = `${track.name.toLowerCase()}_${Date.now()}.${format}`;
      await exportAudio(buffer, format, filename);
    } catch (e) {
      console.error('Download failed:', e);
      if (e instanceof MP3ExportError) {
        alert(getErrorMessage(e));
      } else {
        alert('Failed to export audio. Check console for details.');
      }
    }
  };

  const handleRestore = async (fileHash: string) => {
    try {
      const session = await restoreSession(fileHash);
      if (!session) {
        alert('Could not find session data');
        return;
      }

      const vocals = float32ArrayToAudioBuffer(new Float32Array(session.vocals), session.sampleRate, 2);
      const instrumentals = float32ArrayToAudioBuffer(new Float32Array(session.instrumentals), session.sampleRate, 2);

      setRestoredResult({
        vocals,
        instrumentals,
        originalAudio: null,
        timestamp: session.processedAt,
        fileHash: session.fileHash
      });

      setState('results');
    } catch (e) {
      console.error('Restore failed:', e);
      alert('Failed to restore session from database.');
    }
  };

  const handleRestart = () => {
    setState('upload');
    resetSeparation();
    setRestoredResult(null);
  };

  const handleTryKaraoke = () => {
    const activeResult = separationResult || restoredResult;
    if (activeResult && controller) {
      controller.setAudioBuffers([activeResult.vocals, activeResult.instrumentals]);
    }
    setState('karaoke');
  };

  const clearHistory = async () => {
    await dbClearHistory();
    setHistoryItems([]);
  };

  const renderContent = () => {
    switch (state) {
      case 'upload':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-10 duration-1000 max-w-2xl mx-auto">
            <AudioUpload
              onUpload={handleUpload}
              isLoading={separationStatus === 'processing'}
              autoStartKaraoke={autoStartKaraoke}
              onAutoStartToggle={(val) => {
                setAutoStartKaraoke(val);
                saveSettings({ autoStartKaraoke: val });
              }}
              selectedModelId={selectedModelId}
              onModelChange={setSelectedModelId}
            />
            <div className="mt-16">
              <History
                items={historyItems.map(h => ({
                  id: h.fileHash,
                  fileName: h.fileName,
                  date: new Date(h.date).toLocaleDateString(),
                  duration: `${Math.floor(h.duration / 60)}:${(h.duration % 60).toString().padStart(2, '0')}`
                }))}
                onRestore={handleRestore}
                onClear={clearHistory}
              />
            </div>
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
            <h2 className="text-3xl font-bold mb-4 text-gradient">{t('separatingAudio')}</h2>
            <p className="text-muted-foreground animate-pulse">
              {separationMessage || t('runningModels')}
            </p>

            <div className="mt-12 space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-widest px-1">
                <span>{t('status', { status: separationStatus })}</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${separationProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        );

      case 'results':
        const activeResult = separationResult || restoredResult;
        return (
          <ResultsDisplay
            tracks={[
              { id: 'original', name: t('original'), blob: activeResult?.originalAudio || null },
              { id: 'vocals', name: t('vocals'), blob: activeResult?.vocals || null },
              { id: 'instrumental', name: t('instrumental'), blob: activeResult?.instrumentals || null }
            ]}
            onDownload={handleDownload}
            onRestart={handleRestart}
            onTryKaraoke={handleTryKaraoke}
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
              {t('backToResults')}
            </button>
            {controller && <KaraokePlayer controller={controller} />}
          </div>
        );

      case 'models':
        return (
          <div className="animate-in fade-in duration-500">
            <button
              onClick={() => setState('upload')}
              className="mb-8 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('backToHome')}
            </button>
            <ModelManager />
          </div>
        );

      case 'batch':
        return (
          <div className="animate-in fade-in slide-in-from-bottom-10 duration-500">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setState('upload')} className="text-sm hover:text-white flex items-center gap-2">
                <span>←</span> {t('back')}
              </button>
              <div className="space-x-4">
                <button
                  onClick={batch.clearQueue}
                  disabled={batch.isProcessing}
                  className="text-red-400 hover:text-red-300 disabled:opacity-50 text-sm font-medium"
                >
                  {t('clearAll')}
                </button>
                <button
                  onClick={() => {
                    const model = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
                    if (model) batch.startBatch(model);
                  }}
                  disabled={batch.isProcessing || batch.queue.length === 0}
                  className="bg-primary hover:bg-primary/90 px-6 py-2 rounded-full font-bold disabled:opacity-50 transition-all"
                >
                  {batch.isProcessing ? t('processing') : t('startBatch')}
                </button>
              </div>
            </div>
            <BatchQueue
              queue={batch.queue}
              onRemove={batch.removeFromQueue}
              onDownload={handleBatchDownload}
            />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen selection:bg-primary/30 flex flex-col">
      <nav className="sticky top-0 z-40 glass border-b border-white/5 h-20 shrink-0">
        <div className="container mx-auto px-6 h-full flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-3 group focus-ring rounded-xl p-1"
            onClick={handleRestart}
            aria-label="Go to home"
          >
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <span className="text-2xl font-black tracking-tighter">MUZIKA</span>
          </button>

          <div className="hidden md:flex items-center gap-8">
            <LanguageSwitcher />
            <button
              onClick={() => router.push('/library')}
              className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1"
            >
              Library
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1"
            >
              {t('howItWorks')}
            </button>
            <button
              onClick={() => setState('models')}
              className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1"
            >
              {t('models')}
            </button>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1">{t('privacy')}</a>

            <BackendStatus />

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl hover:bg-white/5 border border-white/5 transition-all focus-ring"
              aria-label="Open settings"
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-12 md:py-20 flex-1">
        {state === 'upload' && (
          <header className="text-center max-w-3xl mx-auto mb-16 space-y-6 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest animate-float">
              {t('activeModel', { modelName: AVAILABLE_MODELS.find(m => m.id === selectedModelId)?.name || 'Unknown' })}
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight" dangerouslySetInnerHTML={{ __html: t.raw('title') }}>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              {t('subtitle')}
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

      <Onboarding
        key={showHelp ? 'manual-help' : 'auto-onboarding'}
        forceShow={showHelp}
        onClose={() => setShowHelp(false)}
      />

      <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground shrink-0">
        <p>{t('footer')}</p>
      </footer>
    </div>
  );
}
