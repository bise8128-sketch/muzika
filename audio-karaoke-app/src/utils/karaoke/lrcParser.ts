/**
 * LRC Parser Utility (Refactored)
 * Parses .lrc files into structured JSON format
 * 
 * Security improvements:
 * - File size limits to prevent DoS
 * - Line count limits
 * - Content sanitization
 */

import { LRCData, LyricLine } from '@/types/karaoke';
import { escapeHtml } from '@/utils/security/sanitize';

/**
 * Parser configuration limits
 */
const PARSER_LIMITS = {
    /** Maximum file size in bytes (1MB) */
    MAX_FILE_SIZE: 1024 * 1024,
    /** Maximum number of lines to parse */
    MAX_LINES: 10000,
    /** Maximum line length in characters */
    MAX_LINE_LENGTH: 1000,
    /** Maximum text content length per line */
    MAX_TEXT_LENGTH: 500,
    /** Maximum metadata value length */
    MAX_METADATA_LENGTH: 200,
};

/**
 * Parse result with validation info
 */
interface ParseResult extends LRCData {
    warnings: string[];
    truncated: boolean;
}

/**
 * Sanitizes text content by removing potentially dangerous characters
 * and limiting length
 * 
 * @param text - Text to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized text
 */
function sanitizeText(text: string, maxLength: number = PARSER_LIMITS.MAX_TEXT_LENGTH): string {
    if (!text || typeof text !== 'string') {
        return '';
    }

    // Trim and limit length
    let sanitized = text.trim().slice(0, maxLength);

    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Escape HTML to prevent XSS when rendered
    sanitized = escapeHtml(sanitized);

    return sanitized;
}

/**
 * Validates file content before parsing
 * 
 * @param content - The raw LRC content
 * @returns Object with validation result and warnings
 */
function validateContent(content: string): { 
    valid: boolean; 
    warnings: string[];
    truncated: boolean;
} {
    const warnings: string[] = [];
    const truncated = false;

    // Check if content is a string
    if (typeof content !== 'string') {
        return { valid: false, warnings: ['Content must be a string'], truncated: false };
    }

    // Check file size
    if (content.length > PARSER_LIMITS.MAX_FILE_SIZE) {
        warnings.push(`File exceeds maximum size of ${PARSER_LIMITS.MAX_FILE_SIZE} bytes`);
        return { valid: false, warnings, truncated: false };
    }

    // Check for null bytes (potential binary file)
    if (content.includes('\0')) {
        warnings.push('File contains null bytes, may be corrupted or binary');
        return { valid: false, warnings, truncated: false };
    }

    return { valid: true, warnings, truncated };
}

/**
 * Parse an LRC file content string
 * 
 * @param content - The raw LRC content
 * @returns Parsed LRC data with warnings
 */
export function parseLRC(content: string): ParseResult {
    const result: ParseResult = {
        lines: [],
        metadata: {},
        warnings: [],
        truncated: false
    };

    // Validate content
    const validation = validateContent(content);
    if (!validation.valid) {
        result.warnings = validation.warnings;
        return result;
    }
    result.warnings = validation.warnings;

    // Split into lines
    const lines = content.split(/\r?\n/);
    
    // Check line count
    if (lines.length > PARSER_LIMITS.MAX_LINES) {
        result.warnings.push(`File has too many lines (${lines.length}), truncating to ${PARSER_LIMITS.MAX_LINES}`);
        result.truncated = true;
        lines.length = PARSER_LIMITS.MAX_LINES;
    }

    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
    const metadataRegex = /^\[([a-zA-Z][a-zA-Z0-9]*):(.*)\]$/;

    const parsedLines: LyricLine[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check line length
        if (line.length > PARSER_LIMITS.MAX_LINE_LENGTH) {
            result.warnings.push(`Line ${i + 1} exceeds maximum length, truncating`);
            lines[i] = line.slice(0, PARSER_LIMITS.MAX_LINE_LENGTH);
        }

        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Check for metadata
        const metadataMatch = trimmedLine.match(metadataRegex);
        if (metadataMatch && !trimmedLine.match(timeRegex)) {
            const key = metadataMatch[1].toLowerCase();
            const value = sanitizeText(metadataMatch[2], PARSER_LIMITS.MAX_METADATA_LENGTH);
            
            // Only allow known metadata keys
            const allowedMetadataKeys = ['ti', 'ar', 'al', 'au', 'length', 'by', 'offset', 're', 've'];
            if (allowedMetadataKeys.includes(key)) {
                result.metadata[key] = value;
            }
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

            // Validate time values
            if (minutes > 999 || seconds > 59 || milliseconds > 999) {
                result.warnings.push(`Line ${i + 1} has invalid timestamp values`);
                continue;
            }

            const totalSeconds = (minutes * 60) + seconds + (milliseconds / 1000);
            
            // Sanity check: timestamps should be reasonable (max 24 hours)
            if (totalSeconds > 86400) {
                result.warnings.push(`Line ${i + 1} has timestamp exceeding 24 hours`);
                continue;
            }

            lineTimestamps.push(totalSeconds);
            lastTimestampEnd = timeRegex.lastIndex;
        }

        if (lineTimestamps.length > 0) {
            // Extract and sanitize text
            const text = sanitizeText(trimmedLine.replace(timeRegex, '').trim());
            
            // Limit duplicate timestamps (same line with multiple timestamps)
            const maxTimestampsPerLine = 10;
            const timestampsToProcess = lineTimestamps.slice(0, maxTimestampsPerLine);
            
            if (lineTimestamps.length > maxTimestampsPerLine) {
                result.warnings.push(`Line ${i + 1} has too many timestamps, using first ${maxTimestampsPerLine}`);
            }

            for (const startTime of timestampsToProcess) {
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
            parsedLines[i].endTime = parsedLines[i].startTime + 5;
        }
    }

    result.lines = parsedLines;

    // Add warning if no lines were parsed
    if (parsedLines.length === 0) {
        result.warnings.push('No valid lyric lines found in file');
    }

    return result;
}

/**
 * Parse LRC with strict validation (throws on errors)
 * 
 * @param content - The raw LRC content
 * @returns Parsed LRC data
 * @throws Error if parsing fails or content is invalid
 */
export function parseLRCStrict(content: string): LRCData {
    const result = parseLRC(content);
    
    if (result.warnings.length > 0) {
        console.warn('LRC Parser warnings:', result.warnings);
    }
    
    if (result.lines.length === 0) {
        throw new Error('No valid lyric lines found in LRC file');
    }
    
    return {
        lines: result.lines,
        metadata: result.metadata
    };
}

/**
 * Format time in seconds to LRC timestamp [mm:ss.xx]
 * 
 * @param seconds - Time in seconds
 * @returns Formatted timestamp
 */
export function formatLRCTimestamp(seconds: number): string {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
        return '[00:00.00]';
    }

    // Cap at reasonable maximum
    const cappedSeconds = Math.min(seconds, 86400);
    
    const mins = Math.floor(cappedSeconds / 60);
    const secs = Math.floor(cappedSeconds % 60);
    const ms = Math.floor((cappedSeconds % 1) * 100);

    return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
}

/**
 * Validate an LRC file before parsing
 * 
 * @param file - File object to validate
 * @returns Object with validation result
 */
export function validateLRCFile(file: File): { 
    valid: boolean; 
    error?: string;
} {
    // Check file type
    if (!file.name.toLowerCase().endsWith('.lrc')) {
        return { valid: false, error: 'File must have .lrc extension' };
    }

    // Check file size
    if (file.size > PARSER_LIMITS.MAX_FILE_SIZE) {
        return { 
            valid: false, 
            error: `File exceeds maximum size of ${Math.round(PARSER_LIMITS.MAX_FILE_SIZE / 1024)}KB` 
        };
    }

    // Check MIME type if available
    if (file.type && file.type !== 'text/plain' && !file.type.includes('text')) {
        return { valid: false, error: 'Invalid file type. Expected text file.' };
    }

    return { valid: true };
}

/**
 * Export limits for external use
 */
export const getParserLimits = () => ({ ...PARSER_LIMITS });
