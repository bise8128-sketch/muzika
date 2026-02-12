import { setup, assign } from 'xstate';

export const appMachine = setup({
  types: {
    context: {} as {
      error: string | null;
    },
    events: {} as
      | { type: 'UPLOAD_START' }
      | { type: 'UPLOAD_COMPLETE' }
      | { type: 'UPLOAD_ERROR'; error: string }
      | { type: 'PROCESS_START' }
      | { type: 'PROCESS_COMPLETE' }
      | { type: 'PROCESS_ERROR'; error: string }
      | { type: 'START_BATCH' }
      | { type: 'START_KARAOKE' }
      | { type: 'EXIT_KARAOKE' }
      | { type: 'VIEW_MODELS' }
      | { type: 'BACK' }
      | { type: 'RETRY' }
      | { type: 'RESET' }
      | { type: 'RESTORE_SESSION' },
  },
  actions: {
    setError: assign({
      error: ({ event }) => (event.type === 'UPLOAD_ERROR' || event.type === 'PROCESS_ERROR' ? event.error : null),
    }),
    clearError: assign({
      error: null,
    }),
  },
}).createMachine({
  id: 'app',
  initial: 'idle',
  context: {
    error: null,
  },
  states: {
    idle: {
      on: {
        UPLOAD_START: 'uploading',
        PROCESS_START: 'processing', // Direct server processing
        START_BATCH: 'batchProcessing',
        VIEW_MODELS: 'models',
        RESTORE_SESSION: 'results', // Restoring history directly goes to results
      },
    },
    uploading: {
      on: {
        UPLOAD_COMPLETE: 'processing',
        UPLOAD_ERROR: {
          target: 'idle',
          actions: 'setError',
        },
      },
    },
    processing: {
      on: {
        PROCESS_COMPLETE: 'results',
        PROCESS_ERROR: {
          target: 'idle', // Or stay in processing with error? usually back to idle/upload
          actions: 'setError',
        },
      },
    },
    batchProcessing: {
      on: {
        BACK: 'idle',
        PROCESS_COMPLETE: 'results', // Or stay in batch view? keeping simple for now
      },
    },
    results: {
      on: {
        START_KARAOKE: 'karaoke',
        RESET: {
          target: 'idle',
          actions: 'clearError',
        },
        RETRY: 'idle', // If they want to try another song
      },
    },
    karaoke: {
      on: {
        EXIT_KARAOKE: 'results',
      },
    },
    models: {
      on: {
        BACK: 'idle',
      },
    },
  },
});
