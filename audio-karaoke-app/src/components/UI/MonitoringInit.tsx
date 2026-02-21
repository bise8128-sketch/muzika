'use client';

import { useEffect } from 'react';
import { initMonitoring } from '@/lib/monitoring';

import { OfflineIndicator } from './OfflineIndicator';

export const MonitoringInit = () => {
    useEffect(() => {
        initMonitoring();
    }, []);
    return <OfflineIndicator />;
};
