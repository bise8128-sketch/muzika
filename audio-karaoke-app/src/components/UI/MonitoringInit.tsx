'use client';

import { useEffect } from 'react';
import { initMonitoring } from '@/lib/monitoring';
import { offlineQueueManager } from '@/utils/processing/OfflineQueueManager';

import { OfflineIndicator } from './OfflineIndicator';
import { BackgroundJobsOverlay } from './BackgroundJobsOverlay';

export const MonitoringInit = () => {
    useEffect(() => {
        initMonitoring();
        
        // Start processing any pending offline jobs
        offlineQueueManager.processNext().catch(console.error);
    }, []);
    return (
        <>
            <OfflineIndicator />
            <BackgroundJobsOverlay />
        </>
    );
};
