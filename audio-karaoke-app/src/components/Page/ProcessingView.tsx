'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface ProcessingViewProps {
  progress: number;
  message: string | null;
  status: string;
}

export function ProcessingView({ progress, message, status }: ProcessingViewProps) {
  const t = useTranslations('HomePage');

  return (
    <div className="max-w-2xl mx-auto py-20 text-center animate-in zoom-in-95 duration-500">
      <div className="relative inline-block mb-12">
        <div className="w-32 h-32 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center font-bold text-2xl">
          {Math.round(progress)}%
        </div>
      </div>
      <h2 className="text-3xl font-bold mb-4 text-gradient">{t('separatingAudio')}</h2>
      <p className="text-muted-foreground animate-pulse">
        {message || t('runningModels')}
      </p>

      <div className="mt-12 space-y-2 max-w-sm mx-auto">
        <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-widest px-1">
          <span>{t('status', { status })}</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
