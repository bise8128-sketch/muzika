import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import LanguageSwitcher from '@/components/UI/LanguageSwitcher';

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

interface PageHeaderProps {
  onRestart: () => void;
  onShowHelp: () => void;
  onShowModels: () => void;
  onShowSettings: () => void;
}

export function PageHeader({
  onRestart,
  onShowHelp,
  onShowModels,
  onShowSettings
}: PageHeaderProps) {
  const t = useTranslations('HomePage');
  const router = useRouter();

  return (
    <nav className="sticky top-0 z-40 glass border-b border-white/5 h-20 shrink-0">
      <div className="container mx-auto px-6 h-full flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-3 group focus-ring rounded-xl p-1"
          onClick={onRestart}
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
            onClick={onShowHelp}
            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1"
          >
            {t('howItWorks')}
          </button>
          
          <button
            onClick={onShowModels}
            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1"
          >
            {t('models')}
          </button>
          
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors focus-ring rounded-lg px-2 py-1">
            {t('privacy')}
          </a>

          <BackendStatus />

          <button
            onClick={onShowSettings}
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
  );
}
