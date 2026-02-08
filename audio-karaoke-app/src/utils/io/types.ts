
/**
 * Interface for reading file contents in a chunked manner.
 * Designed to be compatible with both Browser (File/Blob) and Node (fs).
 */
export interface IFileSource {
    /**
     * Total size of the file in bytes.
     */
    readonly size: number;

    /**
     * Name of the file (if available).
     */
    readonly name?: string;

    /**
     * MIME type of the file (if available).
     */
    readonly type?: string;

    /**
     * Read a chunk of data from the file.
     * @param start Byte offset to start reading from.
     * @param end Byte offset to stop reading (exclusive).
     * @returns Promise resolving to the chunk data as ArrayBuffer.
     */
    slice(start: number, end: number): Promise<ArrayBuffer>;

    /**
     * Get a readable stream for the entire file.
     */
    getStream(): ReadableStream<Uint8Array>;

    /**
     * Close any open resources.
     */
    close(): void;
}
