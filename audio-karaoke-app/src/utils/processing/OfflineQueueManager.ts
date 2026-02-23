import { db } from '../storage/audioDatabase';
import { separateAudio } from '../ml/separateAudio';
import { MODELS } from '@/types/model';
import { notificationManager } from '../notifications/NotificationManager';

class OfflineQueueManager {
    private isProcessing: boolean = false;

    /**
     * Add a new job to the queue and instantly start processing if idle.
     */
    async addJob(fileId: string, fileName: string, fileHash: string, modelId: string): Promise<number> {
        const jobId = await db.processingQueue.add({
            fileId,
            fileName,
            fileHash,
            modelId,
            status: 'pending',
            progress: 0,
            createdAt: Date.now()
        });
        
        // Trigger processing asynchronously
        this.processNext().catch(err => {
            console.error('[OfflineQueueManager] Background processing error:', err);
        });

        return jobId;
    }

    /**
     * Process the next available pending job in the queue.
     */
    async processNext() {
        if (this.isProcessing) return;

        // Find the oldest pending job
        const job = await db.processingQueue
            .where('status')
            .equals('pending')
            .first();

        if (!job || !job.id) {
            // Queue is empty
            return;
        }

        this.isProcessing = true;

        try {
            // Mark as processing
            await db.processingQueue.update(job.id, {
                status: 'processing',
                startedAt: Date.now(),
                progress: 0
            });

            // Fetch original file from db.audioFiles
            const fileRecord = await db.audioFiles.get(job.fileId);
            if (!fileRecord || !fileRecord.data) {
                throw new Error(`File not found in storage for ID: ${job.fileId}`);
            }

            const modelInfo = Object.values(MODELS).find(m => m.id === job.modelId);
            if (!modelInfo) {
                throw new Error(`Unknown model ID: ${job.modelId}`);
            }

            console.log(`[OfflineQueueManager] Starting job ${job.id} for file ${job.fileName}`);

            // Perform separation
            await separateAudio(fileRecord.data as File, {
                modelInfo,
                onProgress: async (progress) => {
                    // Update progress in DB so UI can observe
                    await db.processingQueue.update(job.id!, {
                        progress: progress.percentage
                    });
                }
            });

            // Mark completed
            await db.processingQueue.update(job.id, {
                status: 'completed',
                progress: 100,
                completedAt: Date.now()
            });

            console.log(`[OfflineQueueManager] Completed job ${job.id}`);
            
            // Send notification
            notificationManager.notifyJobComplete(job.fileName).catch(console.error);
            
            // Dispatch a global event so UI components (like the mixer) know to reload
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('muzika-job-completed', {
                    detail: { fileHash: job.fileHash, modelId: job.modelId }
                }));
            }

        } catch (error) {
            const errMatch = error instanceof Error ? error.message : String(error);
            console.error(`[OfflineQueueManager] Job ${job.id} failed:`, error);
            await db.processingQueue.update(job.id, {
                status: 'failed',
                error: errMatch
            });
        } finally {
            this.isProcessing = false;
            // Check for more jobs
            this.processNext().catch(console.error);
        }
    }
}

export const offlineQueueManager = new OfflineQueueManager();
