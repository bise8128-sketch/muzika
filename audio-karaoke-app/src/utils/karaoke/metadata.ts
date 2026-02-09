import * as mm from 'music-metadata-browser';
import { ExtractedMetadata } from '@/types/schema';

/**
 * Extracts metadata from an audio file using music-metadata-browser
 * @param file The audio file to process
 * @returns ExtractedMetadata object
 */
export async function extractMetadata(file: File): Promise<ExtractedMetadata> {
    try {
        const metadata = await mm.parseBlob(file);

        // Calculate duration from metadata if available, otherwise it might be null
        const duration = metadata.format.duration;

        // Handle picture extraction if needed (first picture)
        let pictureData: { format: string; data: Uint8Array } | undefined;
        if (metadata.common.picture && metadata.common.picture.length > 0) {
            const pic = metadata.common.picture[0];
            pictureData = {
                format: pic.format,
                data: new Uint8Array(pic.data),
            };
        }

        return {
            title: metadata.common.title || file.name.replace(/\.[^/.]+$/, ""), // Fallback to filename
            artist: metadata.common.artist,
            album: metadata.common.album,
            duration: duration,
            genre: metadata.common.genre,
            year: metadata.common.year,
            bpm: metadata.common.bpm,
            picture: pictureData,
        };
    } catch (error) {
        console.warn(`Failed to extract metadata for ${file.name}:`, error);
        // Return minimal metadata on failure
        return {
            title: file.name.replace(/\.[^/.]+$/, ""),
        };
    }
}
