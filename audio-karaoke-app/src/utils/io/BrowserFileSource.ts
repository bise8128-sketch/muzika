import { IFileSource } from './types';

/**
 * Implementation of IFileSource for Browser File/Blob objects.
 */
export class BrowserFileSource implements IFileSource {
    private readonly blob: Blob;
    private readonly filename?: string;

    constructor(source: Blob | File) {
        this.blob = source;
        if (source instanceof File) {
            this.filename = source.name;
        }
    }

    get size(): number {
        return this.blob.size;
    }

    get name(): string | undefined {
        return this.filename;
    }

    get type(): string {
        return this.blob.type;
    }

    async slice(start: number, end: number): Promise<ArrayBuffer> {
        const chunk = this.blob.slice(start, end);
        return chunk.arrayBuffer();
    }

    getStream(): ReadableStream<Uint8Array> {
        return this.blob.stream();
    }

    close(): void {
        // Blobs don't need explicit closing in browser
    }
}
