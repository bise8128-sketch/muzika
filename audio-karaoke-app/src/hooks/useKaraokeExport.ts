import { useState } from 'react';
import { LRCData } from '@/types/karaoke';
import { PlaybackController } from '@/utils/audio/playbackController';
import { VideoExporter } from '@/utils/audio/videoExport';
import { exportAudio, renderProcessedAudio, MP3ExportError, getErrorMessage } from '@/utils/audio/audioExporter';

interface UseKaraokeExportProps {
    controller: PlaybackController;
    lyrics: LRCData | null;
    recordedBuffer: AudioBuffer | null;
}

export const useKaraokeExport = ({ controller, lyrics, recordedBuffer }: UseKaraokeExportProps) => {
    const [isExportingVideo, setIsExportingVideo] = useState(false);
    const [isExportingAudio, setIsExportingAudio] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    const handleVideoExport = async () => {
        if (!lyrics) return;
        setIsExportingVideo(true);
        setExportProgress(0);

        try {
            const exporter = new VideoExporter({
                width: 1280,
                height: 720,
                fps: 30,
                lyrics,
                audioBuffers: controller.getAudioBuffers(),
                voiceBuffer: recordedBuffer
            });

            const blob = await exporter.export((p) => setExportProgress(p));
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'karaoke.webm';
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            throw error;
        } finally {
            setIsExportingVideo(false);
        }
    };

    const handleAudioDownload = async (format: 'wav' | 'mp3', effects: {
        pitch: number;
        tempo: number;
        bass: number;
        mid: number;
        treble: number;
        volumes: number[];
    }) => {
        setIsExportingAudio(true);
        try {
            const processedBuffer = await renderProcessedAudio(
                controller.getAudioBuffers(),
                effects.volumes,
                {
                    pitch: effects.pitch,
                    tempo: effects.tempo,
                    bass: effects.bass,
                    mid: effects.mid,
                    treble: effects.treble
                }
            );

            const filename = `karaoke_processed_${Date.now()}.${format}`;
            await exportAudio(processedBuffer, format, filename);
        } catch (error) {
            console.error('Audio export failed:', error);
            if (error instanceof MP3ExportError) {
                alert(getErrorMessage(error));
            } else {
                alert('Failed to export audio. Check console for details.');
            }
            throw error;
        } finally {
            setIsExportingAudio(false);
        }
    };

    return {
        isExportingVideo,
        isExportingAudio,
        exportProgress,
        handleVideoExport,
        handleAudioDownload
    };
};
