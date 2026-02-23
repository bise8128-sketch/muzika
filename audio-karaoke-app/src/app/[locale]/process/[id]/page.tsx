'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ProcessingView } from '@/components/Page/ProcessingView';
import { usePageOrchestrator } from '@/hooks/usePageOrchestrator';
import { useAudio } from '@/context/AudioProvider';
import { useRouter } from '@/i18n/routing';

export default function ProcessingPage() {
    const params = useParams();
    const id = params.id as string;
    const { separation, machineState } = usePageOrchestrator();
    const { lyricSync } = useAudio();
    const router = useRouter();

    useEffect(() => {
        // If we reached results or idle, the AudioProvider effect handles the main routing.
        // We only redirect if it's explicitly idle and we shouldn't be here.
        if (machineState.matches('idle') && separation.status === 'idle') {
            router.replace('/');
        }
    }, [machineState, machineState.value, id, router, separation.status]);

    const isSyncing = machineState.matches('syncing');

    return (
        <div className="animate-in fade-in duration-700">
            {isSyncing ? (
                <ProcessingView
                    progress={lyricSync.progress}
                    message={lyricSync.error ? `Sync Error: ${lyricSync.error}` : "Synchronizing lyrics..."}
                    status={lyricSync.isProcessing ? "syncing" : "completed"}
                />
            ) : (
                <ProcessingView
                    progress={separation.progress}
                    message={separation.message}
                    status={separation.status}
                    executionBackend={separation.executionBackend}
                />
            )}
        </div>
    );
}
