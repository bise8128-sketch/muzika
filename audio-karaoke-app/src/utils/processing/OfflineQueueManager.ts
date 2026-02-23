import { db } from '../storage/audioDatabase';
import { separateAudio } from '../ml/separateAudio';
import { MODELS } from '@/types/model';
import { notificationManager } from '../notifications/NotificationManager';
import { LyricService } from '../karaoke/LyricService';
import { audioCache } from '../storage/audioCache';
import { ProcessingJob, ExtractedMetadata } from '@/types/storage';

class OfflineQueueManager {
    private isProcessing: boolean = false;

    /**
     * Add a new job to the queue and instantly start processing if idle.
     */
    async addJob(file: File, modelId: string, metadata?: ExtractedMetadata) {
        const fileHash = await audioCache.hashFile(file);
        
        const job: ProcessingJob = {
            fileHash,
            fileName: file.name,
            modelId,
            status: 'queued',
            progress: 0,
            addedAt: Date.now(),
            artist: metadata?.artist,
            title: metadata?.title || file.name.replace(/\.[^/.]+$/, ""),
            duration: metadata?.duration
        };

        const id = await db.processingQueue.add(job);
        
        // Save file to storage for background worker
        await db.files.add({
            hash: fileHash,
            data: file,
            name: file.name
        });

        this.processNext();
        return id;
    }

    /**
     * Process the next available pending job in the queue.
     */
    async processNext() {
        if (this.isProcessing) return;

        // Find the oldest pending job
        const job = await db.processingQueue
            .where('status')
            .equals('queued')
            .first();

        if (!job) return;

        this.isProcessing = true;

        try {
            await db.processingQueue.update(job.id!, { status: 'processing', startedAt: Date.now() });

            // Fetch original file from db.audioFiles
            const fileRecord = await db.files.get(job.fileHash);
            if (!fileRecord) throw new Error('File not found in storage');

            const modelInfo = MODELS.find(m => m.id === job.modelId);
            if (!modelInfo) throw new Error('Model configuration not found');

            console.log(`[OfflineQueueManager] Starting job ${job.id} for file ${job.fileName}`);

            // Perform separation
            const result = await separateAudio(fileRecord.data as File, {
                modelInfo,
                onProgress: async (progress) => {
                    // Update progress in DB so UI can observe
                    await db.processingQueue.update(job.id!, {
                        progress: progress.percentage
                    });
                }
            });

            // Automatic Lyric Alignment (Unified Service)
            try {
                console.log(`[OfflineQueueManager] Acquiring lyrics for ${job.fileName}`);
                const lrc = await LyricService.acquireLyrics(result.vocals, {
                    artist: job.artist,
                    title: job.title,
                    duration: job.duration
                });

                if (lrc) {
                    await db.cachedAudio
                        .where('[fileHash+modelUsed]')
                        .equals([job.fileHash, job.modelId])
                        .modify({ lyrics: lrc });
                    
                    console.log(`[OfflineQueueManager] Lyrics acquired for ${job.fileName}`);
                }
            } catch (lyricError) {
                console.warn('[OfflineQueueManager] Lyric acquisition failed:', lyricError);
            }

            // Mark completed
            await db.processingQueue.update(job.id, {
                status: 'completed',
                progress: 100,
                completedAt: Date.now()
            });

            console.log(`[OfflineQueueManager] Completed job ${job.id}`);
            
            // Send notification
            notificationManager.notifyJobComplete(job.fileName, job.fileHash, job.modelId).catch(console.error);
            
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
