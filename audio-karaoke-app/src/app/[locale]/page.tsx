'use client';

import React from 'react';
import { ErrorBoundary } from '@/components/UI/ErrorBoundary';
import dynamic from 'next/dynamic';

// Controllers and State
import { usePageOrchestrator } from '@/hooks/usePageOrchestrator';

// Components
import { PageHeader } from '@/components/Page/PageHeader';
import { LandingHero } from '@/components/Page/LandingHero';
import { PageContent } from '@/components/Page/PageContent';
import { PageFooter } from '@/components/Page/PageFooter';

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

  return (
    <div className="min-h-screen selection:bg-primary/30 flex flex-col">
      <PageHeader 
        onRestart={handleRestart}
        onShowHelp={() => setShowHelp(true)}
        onShowModels={handleViewModels}
        onShowSettings={() => setIsSettingsOpen(true)}
      />

      <main className="container mx-auto px-6 py-12 md:py-20 flex-1">
        {state === 'upload' && (
          <LandingHero activeModelName={activeModelName} />
        )}

        <ErrorBoundary>
          <PageContent
            machineState={machineState}
            separation={separation}
            batch={batch}
            history={history}
            activeResult={activeResult}
            controller={controller}
            selectedModelId={selectedModelId}
            availableModels={AVAILABLE_MODELS}
            autoStartKaraoke={autoStartKaraoke}
            onUpload={handleUpload}
            onUrlSubmit={handleUrlSubmit}
            onAutoStartToggle={toggleAutoStartKaraoke}
            onModelChange={setSelectedModelId}
            onRestore={handleRestore}
            onDownload={handleDownload}
            onBatchDownload={handleBatchDownload}
            onRestart={handleRestart}
            onTryKaraoke={handleTryKaraoke}
            onBack={handleBack}
            onExitKaraoke={handleExitKaraoke}
          />
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
