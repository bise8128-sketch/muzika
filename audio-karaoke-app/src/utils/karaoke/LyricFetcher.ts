/**
 * Utility to fetch synced lyrics from LRCLIB (https://lrclib.net/)
 */
export interface LrcLibResponse {
    id: number;
    name: string;
    trackName: string;
    artistName: string;
    albumName: string;
    duration: number;
    instrumental: boolean;
    plainLyrics: string;
    syncedLyrics: string;
}

export class LyricFetcher {
    private static API_BASE = 'https://lrclib.net/api';

    /**
     * Search for synced lyrics on LRCLIB
     */
    static async fetchLyrics(artist: string, title: string, duration?: number): Promise<string | null> {
        try {
            const query = new URLSearchParams({
                artist_name: artist,
                track_name: title,
            });

            if (duration) {
                query.append('duration', Math.round(duration).toString());
            }

            // Using "get" endpoint for best match by exact metadata
            const response = await fetch(`${this.API_BASE}/get?${query.toString()}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`[LyricFetcher] No exact match for ${artist} - ${title}`);
                    return this.searchFallback(artist, title);
                }
                return null;
            }

            const data: LrcLibResponse = await response.json();
            return data.syncedLyrics || null;
        } catch (error) {
            console.warn('[LyricFetcher] Error fetching lyrics:', error);
            return null;
        }
    }

    /**
     * Fallback to search endpoint if exact match fails
     */
    private static async searchFallback(artist: string, title: string): Promise<string | null> {
        try {
            const query = new URLSearchParams({
                q: `${artist} ${title}`
            });

            const response = await fetch(`${this.API_BASE}/search?${query.toString()}`);
            if (!response.ok) return null;

            const results: LrcLibResponse[] = await response.json();
            
            // Return first result that actually has synced lyrics
            const match = results.find(r => r.syncedLyrics);
            return match?.syncedLyrics || null;
        } catch (error) {
            return null;
        }
    }
}
