
import { renderHook, act } from '@testing-library/react';
import { usePlayback } from '../usePlayback';
import { PlaybackController } from '@/utils/audio/playbackController';

// Mock PlaybackController
jest.mock('@/utils/audio/playbackController', () => {
    return {
        PlaybackController: jest.fn().mockImplementation(() => {
            const listeners: any = {};
            return {
                on: jest.fn((event, cb) => {
                    listeners[event] = listeners[event] || [];
                    listeners[event].push(cb);
                }),
                off: jest.fn((event, cb) => {
                    if (listeners[event]) {
                        listeners[event] = listeners[event].filter((l: any) => l !== cb);
                    }
                }),
                play: jest.fn(),
                pause: jest.fn(),
                stop: jest.fn(),
                setCurrentTime: jest.fn(),
                setVolume: jest.fn(),
                getIsPlaying: jest.fn().mockReturnValue(false),
                getCurrentTime: jest.fn().mockReturnValue(0),
                getDuration: jest.fn().mockReturnValue(0),
                // Helper for tests to trigger events
                _trigger: (event: string, data?: any) => {
                    if (listeners[event]) {
                        listeners[event].forEach((cb: any) => cb(data));
                    }
                }
            };
        })
    };
});

describe('usePlayback', () => {
    let mockController: any;

    beforeEach(() => {
        mockController = new PlaybackController();
    });

    it('initializes with default values', () => {
        const { result } = renderHook(() => usePlayback(mockController));

        expect(result.current.isPlaying).toBe(false);
        expect(result.current.currentTime).toBe(0);
        expect(result.current.duration).toBe(0);
        expect(result.current.vocalsVolume).toBe(1);
        expect(result.current.instrumentalVolume).toBe(1);
    });

    it('updates isPlaying when controller emits play/pause', () => {
        const { result } = renderHook(() => usePlayback(mockController));

        act(() => {
            mockController._trigger('play');
        });
        expect(result.current.isPlaying).toBe(true);

        act(() => {
            mockController._trigger('pause');
        });
        expect(result.current.isPlaying).toBe(false);
    });

    it('updates currentTime when controller emits timeupdate', () => {
        const { result } = renderHook(() => usePlayback(mockController));

        act(() => {
            mockController._trigger('timeupdate', { currentTime: 10, duration: 100 });
        });

        expect(result.current.currentTime).toBe(10);
        expect(result.current.duration).toBe(100);
    });

    it('calls controller methods when hook methods are called', () => {
        const { result } = renderHook(() => usePlayback(mockController));

        act(() => {
            result.current.play();
        });
        expect(mockController.play).toHaveBeenCalled();

        act(() => {
            result.current.seek(50);
        });
        expect(mockController.setCurrentTime).toHaveBeenCalledWith(50);

        act(() => {
            result.current.setVolume(0.5, 0);
        });
        expect(mockController.setVolume).toHaveBeenCalledWith(0.5, 0);
    });
});
