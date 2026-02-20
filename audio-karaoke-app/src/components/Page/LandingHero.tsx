import React from 'react';
import { useTranslations } from 'next-intl';

interface LandingHeroProps {
  activeModelName: string;
}

export function LandingHero({ activeModelName }: LandingHeroProps) {
  const t = useTranslations('HomePage');

  return (
    <header className="text-center max-w-3xl mx-auto mb-16 space-y-6 animate-in fade-in slide-in-from-top-4 duration-1000">
      <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest animate-float">
        {t('activeModel', { modelName: activeModelName })}
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
  );
}
