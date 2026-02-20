
/**
 * Calculates the SHA-256 hash of an ArrayBuffer.
 * @param buffer The data to hash.
 * @returns The hexadecimal representation of the hash.
 */
export async function calculateSHA256(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
