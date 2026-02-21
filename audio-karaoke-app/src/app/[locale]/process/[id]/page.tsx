'use client';

import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ProcessingView } from '@/components/Page/ProcessingView';
import { usePageOrchestrator } from '@/hooks/usePageOrchestrator';
import { useRouter } from '@/i18n/routing';

export default function ProcessingPage() {
    const params = useParams();
    const id = params.id as string;
    const { separation, machineState } = usePageOrchestrator();
    const router = useRouter();

    // If we are no longer processing or mismatch, we might need to redirect
    useEffect(() => {
        if (machineState.matches('results')) {
            router.replace(`/results/${id}`);
        } else if (machineState.matches('idle') && separation.status === 'idle') {
            // router.replace('/');
        }
    }, [machineState, id, router, separation.status]);

    return (
        <div className="animate-in fade-in duration-700">
            <ProcessingView
                progress={separation.progress}
                message={separation.message}
                status={separation.status}
                executionBackend={separation.executionBackend}
            />
        </div>
    );
}
