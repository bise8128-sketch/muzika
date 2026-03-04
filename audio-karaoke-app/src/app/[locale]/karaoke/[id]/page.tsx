'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAudio } from '@/context/AudioProvider';
import { KaraokePlayer } from '@/components/Karaoke/KaraokePlayer';
import { useRouter } from '@/i18n/routing';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function KaraokePage() {
    const params = useParams();
    const id = params.id as string;
    const { activeResult, loadResultFromStorage } = useAudio();
    const router = useRouter();
    const t = useTranslations('HomePage');
    const [isRestoring, setIsRestoring] = useState(false);

    useEffect(() => {
        const restore = async () => {
            if (!activeResult && id) {
                setIsRestoring(true);
                const success = await loadResultFromStorage(id);
                if (!success) {
                    console.error('Failed to restore audio state for ID:', id);
                    // router.push('/'); // Fallback to home if not found
                }
                setIsRestoring(false);
            }
        };
        restore();
    }, [id, activeResult, loadResultFromStorage, router]);

    if (isRestoring) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-white/60 font-medium">Restoring Studio Session...</p>
            </div>
        );
    }

    if (!activeResult && !isRestoring) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
                <div className="p-4 bg-red-500/10 rounded-full text-red-400">
                    <ArrowLeft className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Session Not Found</h2>
                    <p className="text-white/60 max-w-md">
                        We couldn&apos;t find an active audio session for this track. Please try processing the song again.
                    </p>
                </div>
                <button 
                    onClick={() => router.push('/')}
                    className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all font-bold"
                >
                    Return to Studio
                </button>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <button
                onClick={() => router.back()}
                className="mb-8 flex items-center gap-2 text-white/40 hover:text-white transition-colors group"
            >
                <div className="p-2 rounded-xl bg-white/5 group-hover:bg-primary/10 transition-all">
                    <ArrowLeft className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold uppercase tracking-widest">{t('backToResults')}</span>
            </button>
            <KaraokePlayer />
        </div>
    );
}
