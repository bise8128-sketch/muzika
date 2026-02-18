'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import './YouTubeInput.css';

interface YouTubeInputProps {
    onAudioExtracted: (file: File, metadata: VideoMetadata) => void;
    onUrlSubmit?: (url: string) => void;
    mode?: 'client' | 'server';
    disabled?: boolean;
}

interface VideoMetadata {
    title: string;
    duration: number;
    thumbnail: string;
    videoId: string;
}

export default function YouTubeInput({ onAudioExtracted, onUrlSubmit, mode = 'client', disabled }: YouTubeInputProps) {
    const t = useTranslations('YouTube');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    const handleSubmit = async () => {
        if (!url.trim()) {
            setError(t('emptyUrl'));
            return;
        }

        if (mode === 'server' && onUrlSubmit) {
            onUrlSubmit(url);
            return;
        }

        await extractAudio();
    };

    const extractAudio = async () => {
        if (!url.trim()) {
            setError(t('emptyUrl'));
            return;
        }

        setLoading(true);
        setError(null);
        setProgress(0);

        try {
            // Call backend API
            const apiUrl = mode === 'server' ? '/api/backend-download' : '/api/extract-youtube';
            console.log(`Sending request to ${apiUrl}`, { url });

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                throw new Error('You appear to be offline. Please check your internet connection.');
            }

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ url, format: 'mp3' }),
                cache: 'no-store'
            });

            if (!response.ok) {
                let errorMsg = t('error');
                try {
                    const error = await response.json();
                    errorMsg = error.error || error.detail || errorMsg;
                } catch (e) {
                    console.error('Failed to parse error response:', e);
                }
                throw new Error(errorMsg);
            }

            // Handle server-side response (JSON with filename/path)
            if (mode === 'server') {
                const data = await response.json();
                if (data.status === 'success') {
                    // We need to fetch the actual file now to give it back as a File object
                    // or we could change the interface to return a path.
                    // But for consistency with client mode, let's fetch it.
                    const fileUrl = `/api/backend-files/${data.path}`;
                    const fileResponse = await fetch(fileUrl);
                    if (!fileResponse.ok) throw new Error('Failed to download file from server');

                    const blob = await fileResponse.blob();
                    const file = new File([blob], data.filename, { type: 'audio/mpeg' });

                    const metadata: VideoMetadata = {
                        title: data.filename.replace(/\.[^/.]+$/, ""),
                        duration: 0,
                        thumbnail: '',
                        videoId: url.match(/(?:v=|\/)([\w-]{11})/)?.[1] || '',
                    };

                    onAudioExtracted(file, metadata);
                    setUrl('');
                    setProgress(0);
                    return;
                }
            }

            // Client mode handling...
            // Check if this is the "not implemented" response
            const contentType = response.headers.get('Content-Type');
            if (contentType?.includes('application/json')) {
                const data = await response.json();
                if (data.requiresSetup) {
                    throw new Error(data.error);
                }
            }

            // Get metadata from headers
            const title = decodeURIComponent(response.headers.get('X-Video-Title') || 'video');
            const duration = parseInt(response.headers.get('X-Video-Duration') || '0');
            const thumbnail = response.headers.get('X-Video-Thumbnail') || '';
            const contentDisposition = response.headers.get('Content-Disposition');
            const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `${title}.mp3`;

            // Read response as blob with progress
            const reader = response.body?.getReader();
            const contentLength = parseInt(response.headers.get('Content-Length') || '0');
            let receivedLength = 0;
            const chunks: BlobPart[] = [];

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunks.push(value);
                    receivedLength += value.length;

                    if (contentLength > 0) {
                        const progressPercent = Math.round((receivedLength / contentLength) * 100);
                        setProgress(progressPercent);
                    }
                }
            }

            // Create file from chunks
            const blob = new Blob(chunks, { type: 'audio/mpeg' });
            const file = new File([blob], filename, { type: 'audio/mpeg' });

            // Create metadata
            const metadata: VideoMetadata = {
                title,
                duration,
                thumbnail,
                videoId: url.match(/(?:v=|\/)([\w-]{11})/)?.[1] || '',
            };

            onAudioExtracted(file, metadata);
            setUrl('');
            setProgress(0);
        } catch (err) {
            console.error('YouTube extraction error:', err);
            let message = t('error');

            if (err instanceof Error) {
                if (err.message === 'Failed to fetch') {
                    message = `${t('error')} (Connection Failed). Please check your internet connection or try disabling ad-blockers.`;
                } else {
                    message = err.message;
                }
            } else if (typeof err === 'string') {
                message = err;
            }

            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <h3 className="text-sm font-semibold uppercase tracking-wider">{t('title')}</h3>
                {mode === 'server' && (
                    <span className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        PYTHON ENGINE
                    </span>
                )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('placeholder')}
                    disabled={disabled || loading}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    aria-label={t('placeholder')}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                />
                <button
                    onClick={handleSubmit}
                    disabled={disabled || loading || !url.trim()}
                    className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 whitespace-nowrap flex items-center justify-center min-w-[100px]"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        t('extract')
                    )}
                </button>
            </div>

            {loading && progress > 0 && (
                <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
            )}

            {error && (
                <div className="mt-3 text-sm text-red-400 flex items-center gap-2 bg-red-500/5 p-3 rounded-lg border border-red-500/10">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
