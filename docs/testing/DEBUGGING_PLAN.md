# 🤖 AGENT DEBUGGING PLAN: Test Resolution & Quality Assurance

> [!IMPORTANT]
> This document provides specific instructions for coding agents (like Antigravity) to debug and fix test failures in the Muzika codebase.

## 1. Pre-Debugging Checklist
Before attempting to fix any test, the agent MUST verify the environment:
1. **GPU Availability**: Check if WebGPU is available in the testing environment.
2. **Audio Mocking**: Ensure the `web-audio-api` mocks are correctly initialized in Jest.
3. **Database State**: Clear IndexedDB before running storage-related tests.

## 2. Common Failure Patterns & Solutions

| Failure Symptom | Likely Cause | Recommended Action |
|-----------------|--------------|-------------------|
| `Timeout waiting for selector` (E2E) | Component is decomposing/refactoring (AR-01) | Verify the component structure in `src/components/Page/` and update the selector to use `data-testid`. |
| `AudioContext is suspended` | iOS/Safari interaction policy (CF-07) | Ensure the test triggers a user gesture (click) before any audio operation. |
| `ONNX Runtime: Failed to load model` | Network issue or missing `.wasm` files | Verify `public/wasm/` contains required binaries and that the mock server (if any) is responding. |
| `Hydration failed` (SSR) | IndexedDB accessed too early (CF-05) | Wrap IndexedDB access in `useEffect` or use the SSR-safe proxy pattern established in `src/utils/storage/`. |

## 3. Mandatory Agent Instructions for Fixes
When assigned to "Fix a test failure", the agent should follow this tool chain:

1. **Research (view_file)**: Read the failing test file and the corresponding source file.
2. **Diagnostics (run_command)**: Run the specific test with `--verbose` or `--debug`.
3. **Strategy (thought)**: Analyze why the failure occurred (is it code logic, environment, or a brittle test?).
4. **Fix (replace_file_content)**: Implement the fix in the source code.
5. **Verify (run_command)**: Run the failing test PLUS the full regression suite for that module.
6. **Documentation (walkthrough)**: Document the root cause and the fix in a walkthrough artifact.

## 4. Regression Checklist (Post-Fix)
Any fix that touches the following files REQUIRES running the associated tests:
- `playbackController.ts` → Run all `e2e/separation-playback.spec.ts`.
- `inference.ts` → Run `e2e/webgpu-fallback.spec.ts`.
- `audioDatabase.ts` → Run `src/utils/storage/__tests__/`.

## 5. Performance Guardrails
If a fix increases the processing time of audio separation by >10%, the agent MUST notify the user and provide a justification.
