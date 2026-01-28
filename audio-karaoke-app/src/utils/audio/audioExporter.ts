/**
 * Audio Export Utilities
 * WAV and MP3 encoding for browser-based audio export
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Singleton FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

/**
 * Initialize FFmpeg.wasm (singleton)
 */
async function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpegInstance && ffmpegLoaded) {
        return ffmpegInstance;
    }

    if (!ffmpegInstance) {
        ffmpegInstance = new FFmpeg();
    }

    if (!ffmpegLoaded) {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

        await ffmpegInstance.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        ffmpegLoaded = true;
    }

    return ffmpegInstance;
}

/**
 * Export AudioBuffer to WAV format
 * @param audioBuffer - AudioBuffer to export
 * @returns Blob containing WAV file data
 */
export async function exportToWAV(audioBuffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bytesPerSample = 2; // 16-bit PCM

    // Calculate buffer sizes
    const dataSize = length * numberOfChannels * bytesPerSample;
    const bufferSize = 44 + dataSize; // 44 byte header + data

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // Write WAV header
    writeWAVHeader(view, numberOfChannels, sampleRate, dataSize);

    // Write PCM data
    let offset = 44;
    for (let i = 0; i < length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = audioBuffer.getChannelData(channel)[i];
            // Convert Float32 (-1 to 1) to Int16 (-32768 to 32767)
            const int16Sample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
            view.setInt16(offset, int16Sample, true); // little-endian
            offset += 2;
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Write WAV header to DataView
 */
function writeWAVHeader(
    view: DataView,
    numberOfChannels: number,
    sampleRate: number,
    dataSize: number
): void {
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File size (minus 8 bytes for RIFF header)
    view.setUint32(4, 36 + dataSize, true);
    // RIFF type
    writeString(view, 8, 'WAVE');

    // fmt chunk
    writeString(view, 12, 'fmt ');
    // fmt chunk size
    view.setUint32(16, 16, true);
    // Audio format (1 = PCM)
    view.setUint16(20, 1, true);
    // Number of channels
    view.setUint16(22, numberOfChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate
    view.setUint32(28, byteRate, true);
    // Block align
    view.setUint16(32, blockAlign, true);
    // Bits per sample
    view.setUint16(34, 16, true);

    // data chunk
    writeString(view, 36, 'data');
    // data chunk size
    view.setUint32(40, dataSize, true);
}

/**
 * Write string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Export AudioBuffer to MP3 format using FFmpeg.wasm
 * @param audioBuffer - AudioBuffer to export
 * @param bitrate - MP3 bitrate in kbps (default: 320)
 * @returns Blob containing MP3 file data
 */
export async function exportToMP3(
    audioBuffer: AudioBuffer,
    bitrate: number = 320
): Promise<Blob> {
    // First convert to WAV
    const wavBlob = await exportToWAV(audioBuffer);

    // Initialize FFmpeg
    const ffmpeg = await getFFmpeg();

    // Write WAV to virtual filesystem
    const inputName = 'input.wav';
    const outputName = 'output.mp3';

    await ffmpeg.writeFile(inputName, await fetchFile(wavBlob));

    // Convert WAV to MP3
    await ffmpeg.exec([
        '-i', inputName,
        '-b:a', `${bitrate}k`,
        '-ar', '44100', // Sample rate
        outputName
    ]);

    // Read output file
    const data = await ffmpeg.readFile(outputName);

    // Cleanup virtual filesystem
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    return new Blob([data as any], { type: 'audio/mpeg' });
}

/**
 * Download a Blob as a file
 * @param blob - Blob to download
 * @param filename - Filename for download
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Cleanup object URL after a short delay
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Export audio with format selection
 */
export async function exportAudio(
    audioBuffer: AudioBuffer,
    format: 'wav' | 'mp3',
    filename: string,
    bitrate?: number
): Promise<void> {
    let blob: Blob;

    if (format === 'mp3') {
        blob = await exportToMP3(audioBuffer, bitrate);
    } else {
        blob = await exportToWAV(audioBuffer);
    }

    downloadBlob(blob, filename);
}
