'use client';

import { useEffect } from 'react';
import { initMonitoring } from '@/lib/monitoring';
import { offlineQueueManager } from '@/utils/processing/OfflineQueueManager';
import { notificationManager } from '@/utils/notifications/NotificationManager';

import { OfflineIndicator } from './OfflineIndicator';
import { BackgroundJobsOverlay } from './BackgroundJobsOverlay';

export const MonitoringInit = () => {
    useEffect(() => {
        initMonitoring();
        
        // Request notification permissions early
        notificationManager.requestPermission().catch(console.error);
        
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
