'use client';

import React from 'react';
import { useTranslations } from 'next-intl';


interface ProcessingViewProps {
  progress: number;
  message: string | null;
  status: string;
  executionBackend?: 'webgpu' | 'wasm' | 'server' | null;
}


export function ProcessingView({ progress, message, status, executionBackend }: ProcessingViewProps) {
  const t = useTranslations('HomePage');

  return (
    <div
      className="max-w-2xl mx-auto py-20 text-center animate-in zoom-in-95 duration-500"
      data-testid="processing-view"
    >
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

      {/* Backend Indicator */}
      {executionBackend && (
        <div className="mt-4 flex justify-center">
            <div
                data-testid="backend-indicator"
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                executionBackend === 'webgpu' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                executionBackend === 'server' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
               Running on {executionBackend === 'webgpu' ? 'WebGPU (Fast)' : executionBackend === 'server' ? 'Cloud Server' : 'WASM (CPU)'}
            </div>
        </div>
      )}

      <div className="mt-12 space-y-2 max-w-sm mx-auto">
        <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-widest px-1">
          <span data-testid="processing-status">{t('status', { status })}</span>
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
