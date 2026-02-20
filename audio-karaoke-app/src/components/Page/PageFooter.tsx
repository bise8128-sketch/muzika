import React from 'react';
import { useTranslations } from 'next-intl';

export function PageFooter() {
  const t = useTranslations('HomePage');

  return (
    <footer className="py-12 border-t border-white/5 text-center text-sm text-muted-foreground shrink-0">
      <p>{t('footer')}</p>
    </footer>
  );
}
