import { LRCData } from '@/types/karaoke';

export interface VideoExportOptions {
    width: number;
    height: number;
    fps: number;
    audioBuffers: AudioBuffer[];
    voiceBuffer?: AudioBuffer | null;
    lyrics: LRCData | null;
}

export class VideoExporter {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private options: VideoExportOptions;

    constructor(options: VideoExportOptions) {
        this.options = options;
        this.canvas = document.createElement('canvas');
        this.canvas.width = options.width;
        this.canvas.height = options.height;
        const ctx = this.canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        this.ctx = ctx;
    }

    async export(onProgress?: (progress: number) => void): Promise<Blob> {
        const { width, height, fps, lyrics, audioBuffers, voiceBuffer } = this.options;
        const duration = audioBuffers[0]?.duration || 0;

        // Setup Audio Stream
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();

        // Play all buffers into the destination
        audioBuffers.forEach(buffer => {
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(dest);
            source.start(0);
        });

        if (voiceBuffer) {
            const voiceSource = audioCtx.createBufferSource();
            voiceSource.buffer = voiceBuffer;
            voiceSource.connect(dest);
            voiceSource.start(0);
        }

        // Setup Video Stream
        const canvasStream = this.canvas.captureStream(fps);
        const combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...dest.stream.getAudioTracks()
        ]);

        const recorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9,opus'
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);

        return new Promise((resolve, reject) => {
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                audioCtx.close();
                resolve(blob);
            };

            recorder.start();

            // Render loop (Manual drive for export speed/consistency)
            let currentTime = 0;
            const frameDuration = 1 / fps;

            const renderFrame = () => {
                if (currentTime >= duration) {
                    recorder.stop();
                    return;
                }

                this.drawFrame(currentTime);
                currentTime += frameDuration;
                if (onProgress) onProgress(currentTime / duration);

                // Small delay to keep UI responsive during heavy export
                setTimeout(renderFrame, 0);
            };

            renderFrame();
        });
    }

    private drawFrame(time: number) {
        const { width, height, lyrics } = this.options;
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);

        // Draw Visualization (Placeholder for now, just some pulses)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(width / 2, height / 2, 50 + i * 20 + Math.sin(time * 5) * 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (lyrics) {
            const activeLineIndex = lyrics.lines.findIndex((line, i) => {
                const next = lyrics.lines[i + 1];
                return time >= line.startTime && (!next || time < next.startTime);
            });

            if (activeLineIndex !== -1) {
                const line = lyrics.lines[activeLineIndex];

                // Draw Current Line (Large, Centered)
                ctx.font = 'bold 48px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Shadow
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 10;
                ctx.fillStyle = 'white';
                ctx.fillText(line.text, width / 2, height / 2);

                // Draw Next Line (Subtle)
                const nextLine = lyrics.lines[activeLineIndex + 1];
                if (nextLine) {
                    ctx.font = '24px Inter, sans-serif';
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.fillText(nextLine.text, width / 2, height / 2 + 80);
                }
            }
        }
    }
}
