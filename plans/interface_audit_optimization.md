# Muzika Interface Audit & Optimization Plan

## 1. Visual Hierarchy & Layout Optimization

**Analysis:**

- The current layout relies heavily on fixed `pt-32` and `fixed` navigation, which may cause overlapping issues on smaller viewports or when font sizes are scaled.
- The use of `glass` and `glass-card` classes provides a premium feel but lacks consistent spacing and padding across different states.
- The "active model" badge and title in `Home` provide good context, but the primary CTA (the upload area) is physically separated from the model selection (hidden in settings).

**Recommendations:**

- **Refined Navigation:** Replace `fixed` with `sticky` or use a dynamic header height to prevent content overlap.
- **Model Visibility:** Move the model selection from the `SettingsPanel` directly into the `AudioUpload` component or adjacent to it. Users should see which model they are using *before* they upload.
- **Micro-interactions:** Add hover states for the "Active Model" badge to explain *what* that model does (e.g., "UVR-MDX-NET: Best for clean vocals").

## 2. Accessibility (a11y) Compliance

**Analysis:**

- **Navigation:** The logo `div` has an `onClick` but lacks a `button` role or `aria-label` for screen readers.
- **Focus Management:** Modals (Settings, Onboarding) don't appear to implement focus trapping or "Escape" key handling consistently within the component logic (though some might be handled by Next.js/React internals).
- **Contrast:** The `text-muted-foreground` (`#a1a1aa`) on `background` (`#050505`) has a contrast ratio of ~4.5:1, which is the bare minimum for WCAG AA. Some secondary texts in `text-xs` may fail.
- **Form Controls:** Checkboxes in `AudioUpload` and `SettingsPanel` use `peer-sr-only` but lack proper `aria-labelledby` or descriptions.

**Recommendations:**

- **Semantic HTML:** Ensure all clickable elements use `<button>` or `<a>` tags.
- **Focus Trapping:** Implement a `useFocusTrap` hook or use a library like `Headless UI` / `Radix UI` for modals.
- **Color Contrast:** Boost the brightness of `muted-foreground` to at least `#d1d1d6` for better readability.
- **ARIA Labels:** Add `aria-live` regions for the processing state so screen readers announce "25%... 50%..." as it progresses.

## 3. Responsive Behavior

**Analysis:**

- The `KaraokePlayer` uses `aspect-video md:aspect-[21/9]`, which might be too tall on mobile, pushing controls off-screen.
- The `ResultsDisplay` uses `grid-cols-1 md:grid-cols-2`. On tablets, the "ComparisonPlayer" might feel cramped.
- Global padding (`px-6`) is consistent but might be too much on narrow mobile screens (320px-360px).

**Recommendations:**

- **Dynamic Sizing:** Use `vh` units for the Karaoke viewport on mobile to ensure controls are always visible at the bottom.
- **Adaptive Grid:** Use `lg:grid-cols-2` for results to allow more breathing room on medium-sized screens.
- **Touch Targets:** Ensure all buttons have a minimum height of `44px` for touch devices.

## 4. User Journey & Friction Points

**Analysis:**

- **The "Model Gap":** Users choose a model in Settings, then upload. If the separation fails, they have to navigate back to Settings to try another.
- **Post-Processing Confusion:** After separation, the user is in "Results". They see "WAV/MP3" downloads. The "Try Karaoke" button is at the bottom. If they just want to sing, they have to scroll past the downloads.
- **Error States:** Errors are currently handled via `alert()`, which is disruptive and non-themed.

**Recommendations:**

- **Integrated Model Switcher:** Add a "Change Model" button directly inside the `ResultsDisplay` to quickly re-process the current file.
- **Primary CTA Prioritization:** In `ResultsDisplay`, make "Try Karaoke" more prominent than downloads if the user journey is "Upload -> Sing".
- **Inline Error Handling:** Replace `alert()` with a themed toast system or inline error banners within the `AudioUpload` card.

## 5. Modern Frontend Patterns & Performance

**Analysis:**

- **Dynamic Imports:** Currently used for `KaraokePlayer`, etc. This is good for initial bundle size.
- **State Management:** Using `useState` in `Home` for state logic (`'upload' | 'processing' | ...`). As the app grows, this will become hard to manage.
- **Web Workers:** Already utilized for heavy lifting, which is excellent.

**Recommendations:**

- **Finite State Machine (FSM):** Use `XState` or a simpler reducer-based FSM to manage the complex transitions between upload, processing, results, and karaoke.
- **Asset Preloading:** Preload the `KaraokePlayer` and its associated WASM/Model files while the user is uploading the audio to reduce the perceived wait time.
- **Component Library:** Consider migrating core UI components (buttons, sliders, modals) to `shadcn/ui` for better consistency and a11y out of the box.

## 6. Interaction Design Enhancements

- **Waveform Visualization:** Replace the "Fake Waveform" in `ResultsDisplay` with a real waveform generated from the processed `AudioBuffer`.
- **Haptic Feedback:** (For mobile) Add subtle haptic feedback on button presses or when processing completes.
- **Visual Cues:** When "Auto-start Karaoke" is enabled, add a small visual indicator to the "Processing" screen (e.g., "Singing starts in 3... 2... 1...").

---
**Plan for Implementation:**

1. **Phase 1: Foundation & A11y** (Semantic HTML, Focus, Contrast)
2. **Phase 2: Layout & Responsiveness** (Sticky nav, mobile viewport fixes)
3. **Phase 3: User Journey** (Integrated model switcher, CTAs, Error handling)
4. **Phase 4: Visual Polish** (Real waveforms, micro-interactions)
