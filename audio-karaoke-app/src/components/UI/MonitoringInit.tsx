'use client';

import { useEffect } from 'react';
import { initMonitoring } from '@/lib/monitoring';

export const MonitoringInit = () => {
    useEffect(() => {
        initMonitoring();
    }, []);
    return null;
};
