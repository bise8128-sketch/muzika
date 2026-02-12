---
name: premium-visuals
description: Design guidelines for high-quality, premium Karaoke UI components.
metadata:
  version: "1.0.0"
  category: interface
  usage-context: "ui", "glassmorphism", "visualizer"
---

# Premium Visuals

The `premium-visuals` skill ensures that all UI components in the Muzika Karaoke app meet a "wow" level of design excellence.

## Design Principles

### 1. Glassmorphism & Depth
- Use semi-transparent backgrounds with `backdrop-filter: blur(10px)`.
- Implement subtle borders (1px) with high-contrast colors (e.g., `rgba(255, 255, 255, 0.1)`).
- Layer components using `z-index` to create a sense of three-dimensional space.

### 2. Dynamic Audio Visualizers
- Visualizers should feel "alive" and reactive to frequency data.
- Use vibrant gradients (e.g., Deep Purple to Neon Blue) rather than solid colors.
- Implementation reference: `VisualizerContainer.tsx`.

### 3. Micro-Animations
- Hover states should include scale and glow effects.
- Transitions between karaoke states (e.g., Intro -> Verse) should be smooth (minimum 300ms).

## Best Practices
- Avoid browser defaults. Use modern typography (e.g., 'Inter', 'Outfit').
- Ensure accessibility: maintaining contrast ratios even with blur effects.
- Use `requestAnimationFrame` for all visual updates to maintain 60FPS.
