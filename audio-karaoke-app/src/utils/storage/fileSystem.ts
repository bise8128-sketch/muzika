/**
 * File System Service (OPFS Wrapper)
 * Handles storing large audio files in the Origin Private File System
 * instead of IndexedDB to improve performance and reduce memory usage.
 */

export class FileSystemService {
    private root: FileSystemDirectoryHandle | null = null;
    private initialized = false;

    /**
     * Initialize the file system connection
     */
    async init() {
        if (this.initialized) return;

        try {
            this.root = await navigator.storage.getDirectory();
            this.initialized = true;
            console.log('✅ Connected to OPFS');
        } catch (error) {
            console.error('❌ Failed to connect to OPFS:', error);
            throw new Error('FileSystem API not supported or blocked');
        }
    }

    /**
     * Ensure the service is initialized
     */
    private async ensureInit() {
        if (!this.initialized) {
            await this.init();
        }
    }

    /**
     * Save a file to OPFS
     * @param path - Relative path (e.g., "songs/123/vocals.wav")
     * @param data - The file data (Blob or ArrayBuffer)
     * @returns The full path where it was saved
     */
    async saveFile(path: string, data: Blob | ArrayBuffer): Promise<string> {
        await this.ensureInit();
        if (!this.root) throw new Error('FileSystem not initialized');

        try {
            // Split path into directory and filename
            const parts = path.split('/');
            const filename = parts.pop()!;
            let currentDir = this.root;

            // Create directories if they don't exist
            for (const part of parts) {
                currentDir = await currentDir.getDirectoryHandle(part, { create: true });
            }

            // Create file handle
            const fileHandle = await currentDir.getFileHandle(filename, { create: true });
            
            // Create a writable stream and write data
            const writable = await fileHandle.createWritable();
            await writable.write(data);
            await writable.close();
            
            return path;
        } catch (error) {
            console.error(`❌ Failed to save file to ${path}:`, error);
            throw error;
        }
    }

    /**
     * Get a file from OPFS as a Blob
     */
    async getFile(path: string): Promise<Blob> {
        await this.ensureInit();
        if (!this.root) throw new Error('FileSystem not initialized');

        try {
            const parts = path.split('/');
            const filename = parts.pop()!;
            let currentDir = this.root;

            for (const part of parts) {
                currentDir = await currentDir.getDirectoryHandle(part);
            }

            const fileHandle = await currentDir.getFileHandle(filename);
            return await fileHandle.getFile();
        } catch (error) {
            console.error(`❌ Failed to read file ${path}:`, error);
            throw new Error(`File not found: ${path}`);
        }
    }

    /**
     * Get a temporary object URL for a file
     * NOTE: You must revoke this URL when done!
     */
    async getFileUrl(path: string): Promise<string> {
        const blob = await this.getFile(path);
        return URL.createObjectURL(blob);
    }

    /**
     * Delete a file from OPFS
     */
    async deleteFile(path: string): Promise<void> {
        await this.ensureInit();
        if (!this.root) throw new Error('FileSystem not initialized');

        try {
            const parts = path.split('/');
            const filename = parts.pop()!;
            let currentDir = this.root;

            for (const part of parts) {
                currentDir = await currentDir.getDirectoryHandle(part);
            }

            await currentDir.removeEntry(filename);
        } catch (error) {
            console.warn(`⚠️ Failed to delete file ${path} (might not exist):`, error);
        }
    }

    /**
     * Check if a file exists
     */
    async exists(path: string): Promise<boolean> {
        await this.ensureInit();
        if (!this.root) return false;

        try {
            const parts = path.split('/');
            const filename = parts.pop()!;
            let currentDir = this.root;

            for (const part of parts) {
                currentDir = await currentDir.getDirectoryHandle(part);
            }

            await currentDir.getFileHandle(filename);
            return true;
        } catch {
            return false;
        }
    }
}

export const fileSystem = new FileSystemService();
