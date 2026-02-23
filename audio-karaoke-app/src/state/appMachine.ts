import { setup, assign } from 'xstate';

export const appMachine = setup({
  types: {
    context: {} as {
      error: string | null;
      fileHash: string | null;
      selectedModelId: string | null;
      autoStartKaraoke: boolean;
    },
    events: {} as
      | { type: 'UPLOAD_START' }
      | { type: 'UPLOAD_COMPLETE' }
      | { type: 'UPLOAD_ERROR'; error: string }
      | { type: 'PROCESS_START'; fileHash?: string; modelId?: string }
      | { type: 'PROCESS_COMPLETE'; fileHash?: string }
      | { type: 'PROCESS_ERROR'; error: string }
      | { type: 'START_SYNCING' }
      | { type: 'SYNC_COMPLETE' }
      | { type: 'SYNC_ERROR'; error: string }
      | { type: 'START_BATCH' }
      | { type: 'START_KARAOKE' }
      | { type: 'EXIT_KARAOKE' }
      | { type: 'VIEW_MODELS' }
      | { type: 'BACK' }
      | { type: 'RETRY' }
      | { type: 'RESET' }
      | { type: 'RESTORE_SESSION'; fileHash?: string }
      | { type: 'SET_AUTO_START'; value: boolean }
      | { type: 'SET_MODEL'; modelId: string }
      | { type: 'SET_FILE_HASH'; fileHash: string },
  },
  actions: {
    setError: assign({
      error: ({ event }) => (
        event.type === 'UPLOAD_ERROR' || 
        event.type === 'PROCESS_ERROR' || 
        event.type === 'SYNC_ERROR' ? event.error : null
      ),
    }),
    clearError: assign({
      error: null,
    }),
    setContextData: assign({
      fileHash: ({ context, event }) => {
        if (event.type === 'PROCESS_START' || event.type === 'PROCESS_COMPLETE' || event.type === 'RESTORE_SESSION') {
          return event.fileHash || context.fileHash;
        }
        if (event.type === 'SET_FILE_HASH') return event.fileHash;
        return context.fileHash;
      },
      selectedModelId: ({ context, event }) => {
        if (event.type === 'PROCESS_START') {
          return event.modelId || context.selectedModelId;
        }
        if (event.type === 'SET_MODEL') return event.modelId;
        return context.selectedModelId;
      },
    }),
    setAutoStart: assign({
      autoStartKaraoke: ({ event }) => event.type === 'SET_AUTO_START' ? event.value : false,
    }),
    clearContextData: assign({
      fileHash: null,
      error: null,
    }),
  },
}).createMachine({
  id: 'app',
  initial: 'idle',
  context: {
    error: null,
    fileHash: null,
    selectedModelId: null,
    autoStartKaraoke: false,
  },
  states: {
    idle: {
      on: {
        UPLOAD_START: 'uploading',
        PROCESS_START: {
          target: 'processing',
          actions: 'setContextData',
        },
        START_BATCH: 'batchProcessing',
        VIEW_MODELS: 'models',
        RESTORE_SESSION: {
          target: 'results',
          actions: 'setContextData',
        },
        SET_AUTO_START: {
          actions: 'setAutoStart',
        },
        SET_MODEL: {
          actions: 'setContextData',
        },
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
        PROCESS_COMPLETE: {
          target: 'syncing', // Move to syncing before results
          actions: 'setContextData',
        },
        PROCESS_ERROR: {
          target: 'idle',
          actions: 'setError',
        },
      },
    },
    syncing: {
      on: {
        SYNC_COMPLETE: 'results',
        SYNC_ERROR: {
          target: 'results', // Go to results anyway, maybe without lyrics
          actions: 'setError',
        },
      },
    },
    batchProcessing: {
      on: {
        BACK: 'idle',
        PROCESS_COMPLETE: 'results',
        PROCESS_ERROR: {
          actions: 'setError',
        },
      },
    },
    results: {
      on: {
        START_KARAOKE: 'karaoke',
        RESET: {
          target: 'idle',
          actions: 'clearContextData',
        },
        RETRY: {
          target: 'idle',
          actions: 'clearContextData',
        },
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
