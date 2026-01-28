/**
 * Buffer Pool for Memory Optimization
 * Reuses Float32Array buffers to reduce allocations during audio processing
 */

interface PooledBuffer {
    buffer: Float32Array;
    inUse: boolean;
}

class BufferPool {
    private pool: Map<number, PooledBuffer[]> = new Map();
    private maxPoolSize = 10; // Maximum buffers per size to prevent memory bloat

    /**
     * Acquire a buffer from the pool or create a new one
     * @param size - Required buffer size
     * @returns Float32Array buffer
     */
    acquire(size: number): Float32Array {
        const sizePool = this.pool.get(size);

        if (sizePool) {
            // Find an available buffer
            const available = sizePool.find(pb => !pb.inUse);
            if (available) {
                available.inUse = true;
                return available.buffer;
            }
        }

        // No available buffer, create new one
        const buffer = new Float32Array(size);

        // Add to pool if not at max size
        if (!sizePool) {
            this.pool.set(size, [{ buffer, inUse: true }]);
        } else if (sizePool.length < this.maxPoolSize) {
            sizePool.push({ buffer, inUse: true });
        }

        return buffer;
    }

    /**
     * Release a buffer back to the pool
     * @param buffer - Buffer to release
     */
    release(buffer: Float32Array): void {
        const size = buffer.length;
        const sizePool = this.pool.get(size);

        if (sizePool) {
            const pooledBuffer = sizePool.find(pb => pb.buffer === buffer);
            if (pooledBuffer) {
                pooledBuffer.inUse = false;
                // Clear buffer data for security
                buffer.fill(0);
            }
        }
    }

    /**
     * Clear all buffers from the pool
     */
    clear(): void {
        this.pool.clear();
    }

    /**
     * Get pool statistics for monitoring
     */
    getStats() {
        const stats: { size: number; total: number; inUse: number }[] = [];

        this.pool.forEach((buffers, size) => {
            stats.push({
                size,
                total: buffers.length,
                inUse: buffers.filter(b => b.inUse).length,
            });
        });

        return stats;
    }
}

// Singleton instance
export const bufferPool = new BufferPool();
