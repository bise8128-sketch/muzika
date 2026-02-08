import { IFileSource } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Implementation of IFileSource for Node.js file system.
 */
export class NodeFileSource implements IFileSource {
    private readonly filePath: string;
    private handle: fs.promises.FileHandle | null = null;
    private _size: number = 0;

    constructor(filePath: string) {
        this.filePath = filePath;
    }

    async init() {
        const stats = await fs.promises.stat(this.filePath);
        this._size = stats.size;
        this.handle = await fs.promises.open(this.filePath, 'r');
    }

    get size(): number {
        return this._size;
    }

    get name(): string {
        return path.basename(this.filePath);
    }

    async slice(start: number, end: number): Promise<ArrayBuffer> {
        if (!this.handle) await this.init();

        const length = end - start;
        const buffer = Buffer.alloc(length);
        await this.handle!.read(buffer, 0, length, start);

        // Convert Buffer to ArrayBuffer
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }

    getStream(): ReadableStream<Uint8Array> {
        // Node Readable to Web ReadableStream
        // Simplified implementation using basic read stream
        const nodeStream = fs.createReadStream(this.filePath);

        return new ReadableStream({
            start(controller) {
                nodeStream.on('data', (chunk) => {
                    if (Buffer.isBuffer(chunk)) {
                        controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                    } else {
                        // string? shouldn't happen with default encoding
                        controller.enqueue(new TextEncoder().encode(chunk as string));
                    }
                });
                nodeStream.on('end', () => controller.close());
                nodeStream.on('error', (err) => controller.error(err));
            },
            cancel() {
                nodeStream.destroy();
            }
        });
    }

    close(): void {
        if (this.handle) {
            this.handle.close();
            this.handle = null;
        }
    }
}
