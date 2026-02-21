import { createMachine, assign } from 'xstate';

export interface KaraokeContext {
  songId: string | null;
  error: string | null;
  progress: number;
}

export type KaraokeEvent =
  | { type: 'LOAD'; id: string }
  | { type: 'READY' }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'EXPORT' }
  | { type: 'EXPORT_DONE' }
  | { type: 'ERROR'; message: string };

export const karaokeMachine = createMachine({
  id: 'karaoke',
  initial: 'idle',
  types: {} as {
    context: KaraokeContext;
    events: KaraokeEvent;
  },
  context: {
    songId: null,
    error: null,
    progress: 0,
  },
  states: {
    idle: {
      on: {
        LOAD: {
          target: 'loading',
          actions: assign({
            songId: ({ event }) => event.id,
            error: null,
          }),
        },
      },
    },
    loading: {
      on: {
        READY: 'ready',
        ERROR: {
          target: 'idle',
          actions: assign({
            error: ({ event }) => event.message,
          }),
        },
      },
    },
    ready: {
      on: {
        PLAY: {
          target: 'playing',
          actions: 'onPlay',
        },
        EXPORT: {
          target: 'exporting',
          actions: 'onExport',
        },
        LOAD: 'loading',
      },
    },
    playing: {
      on: {
        PAUSE: {
          target: 'paused',
          actions: 'onPause',
        },
        STOP: {
          target: 'ready',
          actions: 'onStop',
        },
        ERROR: 'ready',
      },
    },
    paused: {
      on: {
        PLAY: {
          target: 'playing',
          actions: 'onPlay',
        },
        STOP: {
          target: 'ready',
          actions: 'onStop',
        },
      },
    },
    exporting: {
      on: {
        EXPORT_DONE: 'ready',
        ERROR: 'ready',
      },
    },
  },
});
