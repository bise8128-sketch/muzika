'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import './YouTubeInput.css';

interface YouTubeInputProps {
    onAudioExtracted: (file: File, metadata: VideoMetadata) => void;
    disabled?: boolean;
}

interface VideoMetadata {
    title: string;
    duration: number;
    thumbnail: string;
    videoId: string;
}

export default function YouTubeInput({ onAudioExtracted, disabled }: YouTubeInputProps) {
    const t = useTranslations('YouTube');
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

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
            console.log('Sending request to /api/youtube/extract', { url });
            const response = await fetch('/api/youtube/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                let errorMsg = t('error');
                try {
                    const error = await response.json();
                    errorMsg = error.error || errorMsg;
                } catch (e) {
                    console.error('Failed to parse error response:', e);
                }
                throw new Error(errorMsg);
            }

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
            const chunks: Uint8Array[] = [];

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
            const blob = new Blob(chunks as any, { type: 'audio/mpeg' });
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
            setError(err instanceof Error ? err.message : t('error'));
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !loading && url.trim()) {
            extractAudio();
        }
    };

    return (
        <div className="youtube-input-container">
            <div className="youtube-input-header">
                <svg className="youtube-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <h3 className="youtube-title">{t('title')}</h3>
            </div>

            <div className="input-group">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('placeholder')}
                    disabled={disabled || loading}
                    className="youtube-url-input"
                    onKeyDown={handleKeyDown}
                />
                <button
                    onClick={extractAudio}
                    disabled={disabled || loading || !url.trim()}
                    className="extract-button"
                >
                    {loading ? t('extracting') : t('extract')}
                </button>
            </div>

            {loading && progress > 0 && (
                <div className="progress-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }}>
                        <span className="progress-text">{progress}%</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="error-message">
                    <svg className="error-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Legal Disclaimer */}
            <div className="youtube-disclaimer">
                <svg className="disclaimer-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="disclaimer-text">
                    <strong>Legal Notice:</strong> Downloading content from YouTube may violate their Terms of Service.
                    Use this feature only for content you own or have permission to use.
                    This tool is intended for educational purposes and personal use only.
                </p>
            </div>
        </div>
    );
}
