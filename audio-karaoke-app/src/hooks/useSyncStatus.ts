import { useState, useEffect } from 'react';
import { SyncManager, SyncStatus } from '../utils/storage/SyncManager';

/**
 * Hook to access the global synchronization status
 */
export function useSyncStatus() {
    const syncManager = SyncManager.getInstance();
    const [status, setStatus] = useState<SyncStatus>(syncManager.getStatus());

    useEffect(() => {
        const unsubscribe = syncManager.subscribe((newStatus) => {
            setStatus(newStatus);
        });
        return unsubscribe;
    }, [syncManager]);

    const isSyncing = status === 'syncing';
    
    return {
        status,
        isSyncing,
        syncAll: () => syncManager.syncAll()
    };
}
