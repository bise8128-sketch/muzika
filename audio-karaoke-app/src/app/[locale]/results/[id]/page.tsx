'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useAudio } from '@/context/AudioProvider';
import { ResultsView } from '@/components/Page/ResultsView';
import { useRouter } from '@/i18n/routing';
import { useAudioExport } from '@/hooks/useAudioExport';

export default function ResultsPage() {
    const params = useParams();
    const id = params.id as string;
    const { activeResult } = useAudio();
    const router = useRouter();
    const { handleDownload } = useAudioExport();

    if (!activeResult || activeResult.fileHash !== id) {
        // In a full implementation, we would load from songsStorage here
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-white/60">Loading session results...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in duration-700">
            <ResultsView 
                activeResult={activeResult}
                onDownload={handleDownload}
                onRestart={() => router.push('/')}
                onTryKaraoke={() => router.push(`/karaoke/${id}`)}
            />
        </div>
    );
}
