import { LyricLine } from '@/types/karaoke';
import { formatLRCTimestamp } from './lrcParser';

/**
 * Generates the string content for an LRC file.
 * 
 * @param lines The lyric lines with valid timing.
 * @param metadata Additional metadata like title, artist to be added at the top.
 * @returns Formatted LRC string content.
 */
export function generateLRCContent(lines: LyricLine[], metadata?: Record<string, string>): string {
    let content = '';

    if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
            content += `[${key}:${value}]\n`;
        });
    }

    lines.forEach(line => {
        content += `${formatLRCTimestamp(line.startTime)}${line.text}\n`;
    });

    return content;
}

/**
 * Downloads a string content as an LRC file directly from the browser.
 * 
 * @param content The string content of the LRC file.
 * @param filename The default file name to save as.
 */
export function downloadLRCFile(content: string, filename: string = 'lyrics.lrc'): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); // Required for Firefox and some other browsers
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
