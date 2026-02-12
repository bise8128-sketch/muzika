/**
 * Backward-compatible re-export of PlaybackController.
 *
 * The implementation has been modularized into ./playback/ but this shim
 * ensures all existing `import { PlaybackController } from '@/utils/audio/playbackController'`
 * continue to work without changes.
 */
export { PlaybackController } from './playback';
