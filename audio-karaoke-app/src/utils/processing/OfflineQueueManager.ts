import { db } from '../storage/audioDatabase';
import { separateAudio } from '../ml/separateAudio';
import { MODELS, ModelType } from '@/types/model';
import { notificationManager } from '../notifications/NotificationManager';
import { resampleAudio } from '../audio/audioBufferUtils';
import { WhisperEngine } from '../ml/whisperEngine';
import { LyricFetcher } from '../karaoke/LyricFetcher';
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

        if (!job || !job.id) {
            // Queue is empty
            return;
        }

        this.isProcessing = true;

        try {
            // Mark as processing
            await db.processingQueue.update(job.id!, {
                status: 'processing',
                startedAt: Date.now(),
                progress: 0
            });

            // Fetch original file from db.audioFiles
            const fileRecord = await db.files.get(job.fileHash);
            if (!fileRecord || !fileRecord.data) {
                throw new Error(`File not found in storage for ID: ${job.fileHash}`);
            }

            const modelInfo = MODELS.find(m => m.id === job.modelId);
            if (!modelInfo) {
                throw new Error(`Unknown model ID: ${job.modelId}`);
            }

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

            // Automatic Lyric Alignment (Transcription or Fetching)
            try {
                let lrc: string | null = null;

                // 1. Try fetching from LRCLIB first if we have metadata
                if (job.artist && job.title) {
                    console.log(`[OfflineQueueManager] Attempting to fetch lyrics for ${job.artist} - ${job.title}`);
                    lrc = await LyricFetcher.fetchLyrics(job.artist, job.title, job.duration);
                }

                // 2. Fallback to Whisper transcription if fetching failed
                if (!lrc) {
                    console.log(`[OfflineQueueManager] Falling back to transcription for ${job.fileName}`);
                    // Resample vocals to 16kHz for Whisper
                    const resampled = await resampleAudio(result.vocals, 16000);
                    const monoData = resampled.getChannelData(0);

                    const whisper = new WhisperEngine();
                    await whisper.load({
                        id: 'whisper-tiny-en',
                        type: ModelType.WHISPER,
                        name: 'Whisper Tiny (EN)',
                        version: '1.0.0',
                        size: 40 * 1024 * 1024
                    });

                    lrc = await whisper.transcribeToLrc(monoData);
                }

                if (lrc) {
                    // Update the cachedAudio entry with generated lyrics
                    await db.cachedAudio
                        .where('[fileHash+modelUsed]')
                        .equals([job.fileHash, job.modelId])
                        .modify({ lyrics: lrc });
                    
                    console.log(`[OfflineQueueManager] Lyrics acquired for ${job.fileName}`);
                }
            } catch (transcriptionError) {
                console.warn('[OfflineQueueManager] Lyric acquisition failed:', transcriptionError);
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
