# Ghost Mode: Audio-Reactive Typography Specification

## 1. Executive Summary
"Ghost Mode" is a high-performance visual effect where lyric typography reacts instantaneously to audio frequency transients (kick, bass, sibilance). This specification outlines a direct-coupling architecture that bypasses the React render cycle for 60fps+ animations, ensuring synchronization with music without layout thrashing.

## 2. Technical Architecture

### Data Flow Pipeline
1.  **Audio Source**: `AudioContext` -> `AnalyserNode` (Existing)
2.  **Analysis Loop**: `requestAnimationFrame` loop in `AudioVisualizer` extracts frequency domain data.
3.  **Feature Extraction**:
    *   **Bass/Kick**: 20-250Hz energy (drives Scale/Weight)
    *   **Energy**: Full spectrum RMS (drives Opacity)
    *   **Treble**: >4kHz energy (drives Chromatic Aberration/Offset)
4.  **Data Transport**:
    *   **Mechanism**: Direct callback pattern (`onFrame`) to `framer-motion`'s `MotionValue`.
    *   **Why**: React state updates (`useState`) are too slow (16-32ms latency + overhead) for audio reactivity. Direct mutation of MotionValues is near-zero latency.
5.  **Rendering**:
    *   **Library**: `framer-motion` + CSS Hardware Acceleration.
    *   **Properties**: `transform: scale()`, `opacity`, `filter`, `font-variation-settings`.

### State-Sharing Strategy
To synchronize kinetic typography with music efficiently:
*   **Do NOT use Context for high-frequency data**: Updating a Context provider 60 times a second will trigger re-renders in all consumers.
*   **Recommended Strategy**: **Event-Based Subscription**.
    *   The `AudioVisualizer` instance acts as the "Source of Truth".
    *   Components subscribe via a custom hook `useAudioReactivity`.
    *   The hook manages the connection and updates local `MotionValue`s.
    *   This decouples the audio engine from the UI layer.

## 3. Performance Optimization
*   **Layout Thrashing Prevention**:
    *   Only animate `transform` and `opacity`.
    *   Avoid animating `width`, `height`, `margin`, or `fontSize` (unless using `transform: scale`).
    *   Use `will-change: transform` on the active lyric layer.
*   **Variable Fonts**:
    *   If available, animate `font-variation-settings: "wght" 700` instead of swapping font files. This is performant and smooth.
*   **React Bypass**:
    *   The `useAudioReactivity` hook updates `MotionValues`.
    *   `motion.div` reads these values and updates the DOM style directly.
    *   React does **not** re-render the component during the music.

## 4. Integration Plan

### Phase 1: Core Implementation (Completed in Prototype)
*   [x] Modify `AudioVisualizer` to expose `onFrame` callback.
*   [x] Implement `useAudioReactivity` hook.
*   [x] Create `GhostModePrototype` component.

### Phase 2: Production Rollout
1.  **Refactor `LyricDisplay`**:
    *   Import `useAudioReactivity`.
    *   Wrap the `active` line render logic with the ghost mode effects.
    *   Add a toggle in `VisualSettings` for "Ghost Mode".
2.  **Variable Font Setup**:
    *   Ensure the project font supports variable weight axes for smoother weight animations.
3.  **Visual Tuning**:
    *   Adjust `spring` physics (stiffness/damping) to match the genre (e.g., tighter springs for EDM, looser for Ballads).

## 5. Prototype Code Reference
See `src/components/Karaoke/Visualizer/GhostModePrototype.tsx` for the full implementation.

### Key Snippet: Efficient Data Mapping
```typescript
// From useAudioReactivity hook
visualizer.setFrameCallback((metrics) => {
    // Direct updates, 0 allocations, 0 React renders
    bass.set(metrics.bass);
    energy.set(metrics.energy);
});

// From Component
const scale = useTransform(smoothBass, [0, 1], [1, 1.5]);
// ...
<motion.h1 style={{ scale }} />
```
