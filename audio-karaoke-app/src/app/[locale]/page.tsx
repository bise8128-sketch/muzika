'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import dynamic from 'next/dynamic';

// Controllers and State
import { usePageOrchestrator } from '@/hooks/usePageOrchestrator';

// Components
import { PageHeader } from '@/components/Page/PageHeader';
import { PageFooter } from '@/components/Page/PageFooter';
import { UploadView } from '@/components/Page/UploadView';
import { ProcessingView } from '@/components/Page/ProcessingView';
import { ResultsView } from '@/components/Page/ResultsView';
import { KaraokeView } from '@/components/Page/KaraokeView';
import { ModelsView } from '@/components/Page/ModelsView';
import { BatchView } from '@/components/Page/BatchView';

const SettingsPanel = dynamic(() => import('@/components/UI/SettingsPanel').then(mod => mod.SettingsPanel), {
  ssr: false
});

const Onboarding = dynamic(() => import('@/components/UI/Onboarding').then(mod => mod.Onboarding), {
  ssr: false
});

export default function Home() {
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
    handleBack,
    handleExitKaraoke,
    handleViewModels,
  } = usePageOrchestrator();

  const activeModelName = AVAILABLE_MODELS.find(m => m.id === selectedModelId)?.name || 'Unknown';

  const renderContent = () => {
    if (machineState.matches('models')) {
      return <ModelsView onBack={handleBack} />;
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
          onBack={handleBack}
          selectedModelId={selectedModelId}
          models={AVAILABLE_MODELS}
        />
      );
    }

    // Default to UploadView for idle/uploading
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
        activeModelName={activeModelName}
      />
    );
  };

  return (
    <div className="min-h-screen selection:bg-primary/30 flex flex-col">
      <PageHeader 
        onRestart={handleRestart}
        onShowHelp={() => setShowHelp(true)}
        onShowModels={handleViewModels}
        onShowSettings={() => setIsSettingsOpen(true)}
      />

      <main className="container mx-auto px-6 py-12 md:py-20 flex-1">
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

      <PageFooter />
    </div>
  );
}
