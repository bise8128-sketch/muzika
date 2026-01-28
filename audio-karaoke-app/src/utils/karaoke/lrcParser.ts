/**
 * LRC Parser Utility
 * Parses .lrc files into structured JSON format
 */

import { LRCData, LyricLine } from '@/types/karaoke';

/**
 * Parse an LRC file content string
 * @param content - The raw LRC content
 * @returns Parsed LRC data
 */
export function parseLRC(content: string): LRCData {
    const lines = content.split(/\r?\n/);
    const result: LRCData = {
        lines: [],
        metadata: {}
    };

    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    const metadataRegex = /\[([a-z]+):(.*)\]/;

    const parsedLines: LyricLine[] = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check for metadata
        const metadataMatch = trimmedLine.match(metadataRegex);
        if (metadataMatch && !trimmedLine.match(timeRegex)) {
            const key = metadataMatch[1];
            const value = metadataMatch[2].trim();
            result.metadata[key] = value;
            continue;
        }

        // Check for timestamps
        let match;
        const lineTimestamps: number[] = [];
        let lastTimestampEnd = 0;

        // Reset regex index
        timeRegex.lastIndex = 0;

        while ((match = timeRegex.exec(trimmedLine)) !== null) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;

            const totalSeconds = (minutes * 60) + seconds + (milliseconds / 1000);
            lineTimestamps.push(totalSeconds);
            lastTimestampEnd = timeRegex.lastIndex;
        }

        if (lineTimestamps.length > 0) {
            const text = trimmedLine.replace(timeRegex, '').trim();
            for (const startTime of lineTimestamps) {
                parsedLines.push({
                    startTime,
                    endTime: 0, // Will be calculated after sorting
                    text
                });
            }
        }
    }

    // Sort lines by startTime
    parsedLines.sort((a, b) => a.startTime - b.startTime);

    // Calculate endTimes
    for (let i = 0; i < parsedLines.length; i++) {
        if (i < parsedLines.length - 1) {
            parsedLines[i].endTime = parsedLines[i + 1].startTime;
        } else {
            // Last line lasts for 5 seconds or until the end of the song
            // (Setting to 0 for now, UI should handle this)
            parsedLines[i].endTime = parsedLines[i].startTime + 5;
        }
    }

    result.lines = parsedLines;
    return result;
}

/**
 * Format time in seconds to LRC timestamp [mm:ss.xx]
 * @param seconds - Time in seconds
 * @returns Formatted timestamp
 */
export function formatLRCTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);

    return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
}
