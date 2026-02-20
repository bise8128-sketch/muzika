'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import dynamic from 'next/dynamic';

// Controllers and State
import { usePageOrchestrator } from '@/hooks/usePageOrchestrator';

// Views
import { UploadView } from '@/components/Page/UploadView';
import { ProcessingView } from '@/components/Page/ProcessingView';
import { ResultsView } from '@/components/Page/ResultsView';
import { KaraokeView } from '@/components/Page/KaraokeView';
import { ModelsView } from '@/components/Page/ModelsView';
import { BatchView } from '@/components/Page/BatchView';
import { PageHeader } from '@/components/Page/PageHeader';

const SettingsPanel = dynamic(() => import('@/components/UI/SettingsPanel').then(mod => mod.SettingsPanel), {
  ssr: false
});

const Onboarding = dynamic(() => import('@/components/UI/Onboarding').then(mod => mod.Onboarding), {
  ssr: false
});

export default function Home() {
  const t = useTranslations('HomePage');
  
  const {
    state,
    machineState,
    send,
    activeResult,
    handleRestart,
    handleTryKaraoke,
    isSettingsOpen,
    setIsSettingsOpen,
    showHelp,
    setShowHelp,
    selectedModelId,
    setSelectedModelId,
    AVAILABLE_MODELS,
    autoStartKaraoke,
    toggleAutoStartKaraoke,
    handleUpload,
    handleUrlSubmit,
    handleRestore,
    separation,
    batch,
    history,
    handleDownload,
    handleBatchDownload,
    controller,
  } = usePageOrchestrator();

  const renderContent = () => {
    if (machineState.matches('uploading') || machineState.matches('idle')) {
      return (
        <UploadView
          onUpload={handleUpload}
          onUrlSubmit={handleUrlSubmit}
          isLoading={machineState.matches('uploading') || separation.status === 'processing'}
          autoStartKaraoke={autoStartKaraoke}
          onAutoStartToggle={toggleAutoStartKaraoke}
          selectedModelId={selectedModelId}
          onModelChange={setSelectedModelId}
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
      <PageHeader 
        onRestart={handleRestart}
        onShowHelp={() => setShowHelp(true)}
        onShowModels={() => send({ type: 'VIEW_MODELS' })}
        onShowSettings={() => setIsSettingsOpen(true)}
      />

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
