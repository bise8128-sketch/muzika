# Muzika Debugging Strategy

This guide provides engineers with structured techniques for debugging the Muzika application, covering both the Next.js frontend and the Python audio processing backend.

## 🎤 Frontend Debugging (Next.js)

### 1. Browser Development Tools

The majority of Muzika's logic runs in the browser.

* Browser Development Tools: Look for errors related to WASM loading, ONNX Runtime inference, or Web Audio API suspension. Use the filter to search for `[ONNX]` or `[AudioContext]`.
* Network Tab:
  * Filter by `Fetch/XHR` to monitor API calls to the Python backend.
  * Verify that `.onnx` models and WASM binaries are being served with correct `Cache-Control` headers.
* Application Tab (Storage):
  * IndexedDB: Inspect the `MuzikaDB` (handled via Dexie.js). You can manually view or clear stored songs and processed stems.

### 2. Audio Graph Inspection

Since Muzika uses complex `AudioWorklet` nodes and multi-stem mixing:

* Install the **Web Audio Inspector** chrome extension.
* Verify that the `AudioContext` is `running` and that nodes are correctly connected.

### 3. Error Boundaries

If a component crashes, the `ErrorBoundary` will catch it and display a "Signal Interrupted" screen.

* In **Development Mode**, the raw error stack trace is visible at the bottom of the error screen.
* Check `src/components/UI/ErrorBoundary.tsx` to add custom error handling for new components.

---

## 🐍 Backend Debugging (Python/FastAPI)

### 1. Backend Logs

The Python backend logs to both the terminal and `server.log`.

* Run `tail -f server.log` to watch progress in real-time.
* Progress logs for `HTDemucs` show the percentage completion of each separation job.

### 2. Interactive API Docs

FastAPI provides a built-in Swagger UI:

* Navigate to `http://localhost:8000/docs`.
* Test `/api/separate` or `/api/download` individually without needing the frontend.

### 3. Step-through Debugging

For complex logic in `separator.py`:

1. Insert `import pdb; pdb.set_trace()` at the point of interest.
2. Run the server in a terminal where you can interact with the PDB prompt.

---

## 🛰️ Full-Stack Traceability

### 1. Monitoring (Production)

Muzika uses Sentry and LogRocket for production visibility.

* **Sentry**: Aggregates errors from both the Next.js client and Python server.
* **LogRocket**: Provides session replays to correlate user actions with frontend crashes.

### 2. Integration Testing Mode

To debug the interaction between frontend and backend locally:

```bash
# Run with integration environment variable
cd audio-karaoke-app
INTEGRATION=true npx playwright test e2e/integration.spec.ts --ui
```

This allows you to see the real-time browser state alongside backend processing.
