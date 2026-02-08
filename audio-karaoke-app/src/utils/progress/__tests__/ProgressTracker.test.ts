import { ProgressTracker } from '../ProgressTracker';

describe('ProgressTracker', () => {
    let tracker: ProgressTracker;
    const nowSpy = jest.spyOn(performance, 'now');

    beforeEach(() => {
        tracker = new ProgressTracker(100);
        nowSpy.mockReturnValue(1000); // Start at 1000ms
    });

    it('should initialize correctly', () => {
        tracker.start();
        expect(tracker.state.processed).toBe(0);
        expect(tracker.state.percent).toBe(0);
        expect(tracker.state.speed).toBe(0);
    });

    it('should calculate speed and eta', () => {
        tracker.start();

        // Advance time by 1s, process 10 units
        nowSpy.mockReturnValue(2000);
        tracker.update(10);

        const state = tracker.state;
        expect(state.processed).toBe(10);
        expect(state.percent).toBe(10);
        // Speed = 10 units / 1s = 10
        expect(state.speed).toBeCloseTo(10);
        // ETA = (100 - 10) / 10 = 9s
        expect(state.eta).toBeCloseTo(9);
    });

    it('should smooth speed calculation', () => {
        tracker.start(); // t=1000

        // Step 1: 10 units in 1s -> Instant speed 10
        nowSpy.mockReturnValue(2000);
        tracker.update(10);
        expect(tracker.state.speed).toBeCloseTo(10);

        // Step 2: 20 units in 1s (total 30) -> Instant speed 20
        // Smoothed speed: (20 * 0.1) + (10 * 0.9) = 2 + 9 = 11
        nowSpy.mockReturnValue(3000);
        tracker.update(30);

        expect(tracker.state.speed).toBeCloseTo(11);
    });
});
