'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import dynamic from 'next/dynamic';

import { PlaybackController } from '@/utils/audio/playbackController';
import { getSettings, saveSettings } from '@/utils/storage/settingsStore';
import { songsStorage } from '@/utils/storage/songsStorage';
import { DEFAULT_MODEL_ID } from '@/utils/constants';

// Hooks
import { useSeparation } from '@/hooks/useSeparation';
import { useBatchSeparation } from '@/hooks/useBatchSeparation';
import { useModels } from '@/hooks/useModels';
import { useServerProcessing } from '@/hooks/useServerProcessing';
import { useHistoryManagement } from '@/hooks/useHistoryManagement';
import { useAudioExport } from '@/hooks/useAudioExport';
import { useAppState } from '@/hooks/useAppState';

// Views
import { UploadView } from '@/components/Page/UploadView';
import { ProcessingView } from '@/components/Page/ProcessingView';
import { ResultsView } from '@/components/Page/ResultsView';
import { KaraokeView } from '@/components/Page/KaraokeView';
import { ModelsView } from '@/components/Page/ModelsView';
import { BatchView } from '@/components/Page/BatchView';

import { ExtractedMetadata } from '@/types/schema';
import LanguageSwitcher from '@/components/UI/LanguageSwitcher';

const SettingsPanel = dynamic(() => import('@/components/UI/SettingsPanel').then(mod => mod.SettingsPanel), {
  ssr: false
});

const Onboarding = dynamic(() => import('@/components/UI/Onboarding').then(mod => mod.Onboarding), {
  ssr: false
});

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
    const interval = setInterval(checkStatus, 30000);
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

  // PlaybackController
  const [controller, setController] = useState<PlaybackController | null>(null);
  useEffect(() => {
    setController(new PlaybackController());
  }, []);
  useEffect(() => {
    return () => { if (controller) controller.dispose(); };
  }, [controller]);

  // UI state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [autoStartKaraoke, setAutoStartKaraoke] = useState(() => {
    if (typeof window !== 'undefined') return getSettings().autoStartKaraoke;
    return false;
  });
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);

  // Domain hooks
  const separation = useSeparation();
  const batch = useBatchSeparation();
  const serverProcessing = useServerProcessing();
  const history = useHistoryManagement();
  const { handleDownload, handleBatchDownload } = useAudioExport();

  const { state, machineState, send, activeResult, handleRestart, handleTryKaraoke } = useAppState({
    separationStatus: separation.status,
    separationResult: separation.result,
    separationError: separation.error,
    serverProcessingResult: serverProcessing.result,
    serverProcessingError: serverProcessing.error,
    autoStartKaraoke,
    controller,
    onHistoryRefresh: history.loadHistory,
    onResetSeparation: separation.reset,
    onResetServerProcessing: serverProcessing.reset,
    onClearRestoredResult: history.clearRestoredResult,
    restoredResult: history.restoredResult,
  });

  // Upload handler
  const handleUpload = async (files: File[], isKaraokeMode: boolean = false, metadata?: ExtractedMetadata[]) => {
    if (files.length === 0) return;

    if (isKaraokeMode) {
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileMetadata = metadata ? metadata[i] : undefined;
          await songsStorage.saveDirectKaraoke(file, fileMetadata);
        }
        router.push('/library');
      } catch (e) {
        console.error("Failed to save karaoke song:", e);
        alert("Failed to save song to library.");
      }
      return;
    }

    if (files.length > 1) {
      batch.addToQueue(files);
      send({ type: 'START_BATCH' });
      return;
    }

    const file = files[0];
    const modelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
    if (!modelInfo) {
      alert('Selected model not found!');
      return;
    }

    try {
      send({ type: 'PROCESS_START' });
      await separation.separate(file, modelInfo);
      // 'UPLOAD_COMPLETE' sent by useAppState on successful separation/processing
    } catch (e) {
      console.error("Upload/Separation failed immediately:", e);
      send({ type: 'UPLOAD_ERROR', error: String(e) });
    }
  };

  // Restore handler
  const handleRestore = async (fileHash: string) => {
    try {
      await history.handleRestore(fileHash);
      send({ type: 'RESTORE_SESSION' });
    } catch {
      alert('Failed to restore session from database.');
    }
  };

  // Server processing handler
  const handleServerProcessing = async (url: string, config: { model: string; format: string }) => {
    send({ type: 'PROCESS_START' });
    await serverProcessing.handleServerProcessing(url, config);
  };

  const renderContent = () => {
    if (machineState.matches('uploading') || machineState.matches('idle')) {
      return (
        <UploadView
          onUpload={handleUpload}
          isLoading={machineState.matches('uploading') || separation.status === 'processing'}
          autoStartKaraoke={autoStartKaraoke}
          onAutoStartToggle={(val) => {
            setAutoStartKaraoke(val);
            saveSettings({ autoStartKaraoke: val });
          }}
          selectedModelId={selectedModelId}
          onModelChange={setSelectedModelId}
          onServerProcessing={handleServerProcessing}
          historyItems={history.historyItems}
          onRestore={handleRestore}
          onClearHistory={history.clearHistory}
        />
      );
    }

    if (machineState.matches('processing')) {
      return (

        <ProcessingView
          progress={separation.progress}
          message={separation.message}
          status={separation.status}
          executionBackend={separation.executionBackend}
        />
      );
    }

    if (machineState.matches('results')) {
      return (
        <ResultsView
          activeResult={activeResult}
          onDownload={handleDownload}
          onRestart={handleRestart}
          onTryKaraoke={handleTryKaraoke}
        />
      );
    }

    if (machineState.matches('karaoke')) {
      return controller ? (
        <KaraokeView
          controller={controller}
          onBack={() => send({ type: 'EXIT_KARAOKE' })}
        />
      ) : null;
    }

    if (machineState.matches('models')) {
      return (
        <ModelsView onBack={() => send({ type: 'BACK' })} />
      );
    }

    if (machineState.matches('batchProcessing')) {
      return (
        <BatchView
          queue={batch.queue}
          isProcessing={batch.isProcessing}
          onRemove={batch.removeFromQueue}
          onClear={batch.clearQueue}
          onStartBatch={batch.startBatch}
          onBatchDownload={handleBatchDownload}
          onBack={() => send({ type: 'BACK' })}
          selectedModelId={selectedModelId}
          models={AVAILABLE_MODELS}
        />
      );
    }

    return null;
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
              onClick={() => send({ type: 'VIEW_MODELS' })}
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
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight">
              {t.rich('title', {
                br: () => <br />,
                gradient: (chunks) => <span className="text-gradient">{chunks}</span>
              })}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
              {t('subtitle')}
            </p>
          </header>
        )}

        <ErrorBoundary>
          {renderContent()}
        </ErrorBoundary>
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
