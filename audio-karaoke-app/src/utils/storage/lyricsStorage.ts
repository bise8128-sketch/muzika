/**
 * Lyrics Storage Utility
 * Manages saving and loading lyrics from the database
 */

import { db } from './audioDatabase';

/**
 * Save lyrics for a specific file hash
 * @param fileHash - The file hash
 * @param lyrics - Raw LRC content
 */
export async function saveLyrics(fileHash: string, lyrics: string): Promise<void> {
    const record = await db.cachedAudio.where({ fileHash }).first();
    if (record && record.id) {
        await db.cachedAudio.update(record.id, { lyrics });
    } else {
        console.warn(`Cannot save lyrics: No cached audio found for hash ${fileHash}`);
    }
}

/**
 * Load lyrics for a specific file hash
 * @param fileHash - The file hash
 * @returns Raw LRC content or undefined
 */
export async function loadLyrics(fileHash: string): Promise<string | undefined> {
    const record = await db.cachedAudio.where({ fileHash }).first();
    return record?.lyrics;
}
