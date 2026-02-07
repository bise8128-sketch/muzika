/**
 * Simple hash function to generate a unique-ish ID from a string
 * Not a real MD5, but sufficient for file identification in this context
 */
export function md5(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16) + '-' + Date.now().toString(16);
}
