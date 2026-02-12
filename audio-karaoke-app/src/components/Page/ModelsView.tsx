'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

const ModelManager = dynamic(() => import('@/components/ModelManager/ModelManager').then(mod => mod.ModelManager), {
  loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground">Loading Model Manager...</div>,
  ssr: false
});

interface ModelsViewProps {
  onBack: () => void;
}

export function ModelsView({ onBack }: ModelsViewProps) {
  const t = useTranslations('HomePage');

  return (
    <div className="animate-in fade-in duration-500">
      <button
        onClick={onBack}
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
}
