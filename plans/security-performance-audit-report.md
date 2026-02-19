# Security and Performance Audit Report
## Muzika Karaoke Web Application

**Audit Date:** 2026-02-12  
**Auditor:** Kilo Code Architect  
**Scope:** Front-end codebase and client-side API integration logic

---

## Executive Summary

This audit identified **23 issues** across security and performance domains. The most critical findings include a confirmed XSS vulnerability, path traversal risks in file serving, overly permissive CORS configuration, and memory management issues that could lead to application crashes with large audio files.

### Risk Classification

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 3 | Immediate remediation required |
| **High** | 6 | Should be addressed promptly |
| **Medium** | 8 | Should be addressed in upcoming sprints |
| **Low** | 6 | Best practice improvements |

---

## Critical Findings

### 1. XSS Vulnerability via `dangerouslySetInnerHTML`

**Location:** [`audio-karaoke-app/src/app/[locale]/page.tsx:662`](../audio-karaoke-app/src/app/[locale]/page.tsx)

**Code:**
```tsx
<h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight" dangerouslySetInnerHTML={{ __html: t.raw('title') }}>
</h1>
```

**Impact:** If translation files are compromised or if user input can influence translation content, arbitrary JavaScript can be executed in the user's browser context. This could lead to:
- Session hijacking
- Credential theft
- Malicious redirects
- Keylogging

**Root Cause:** The translation system uses `t.raw('title')` which returns raw HTML that is injected without sanitization. While Next.js internationalization typically loads translations from static JSON files, any compromise of these files or dynamic injection would result in XSS.

**Recommendation:** Remove `dangerouslySetInnerHTML` and use React's built-in text rendering. If HTML formatting is required, use a sanitization library like DOMPurify.

---

### 2. Path Traversal Vulnerability in File Proxy

**Location:** [`audio-karaoke-app/src/app/api/backend-files/[...path]/route.ts:9-11`](../audio-karaoke-app/src/app/api/backend-files/[...path]/route.ts)

**Code:**
```typescript
const { path } = await params;
const filePath = path.join('/');
const url = `${PYTHON_SERVICE_URL}/files/${filePath}`;
```

**Impact:** An attacker could potentially access arbitrary files on the backend Python service by crafting URLs like:
- `/api/backend-files/../../../etc/passwd`
- `/api/backend-files/..%2F..%2F..%2Fetc%2Fpasswd`

**Root Cause:** No validation or sanitization of the path segments before constructing the backend URL. The catch-all route accepts any path without restrictions.

**Recommendation:** Implement strict path validation:
1. Reject paths containing `..` segments
2. Reject paths starting with `/` or `\`
3. Whitelist allowed file extensions
4. Validate against a base directory

---

### 3. Overly Permissive CORS Configuration

**Location:** [`audio-karaoke-app/next.config.ts`](../audio-karaoke-app/next.config.ts)

**Code:**
```typescript
response.headers.set('Access-Control-Allow-Origin', '*');
```

**Also in:** `audio-karaoke-app/src/app/api/extract-youtube/route.ts:114` (Deleted)

**Impact:** 
- Any website can make cross-origin requests to your API
- CSRF attacks become easier to execute
- Sensitive data could be exfiltrated through malicious websites
- Rate limiting can be bypassed through distributed attacks

**Root Cause:** Using wildcard `*` for `Access-Control-Allow-Origin` allows any origin to access the API.

**Recommendation:** Implement origin whitelisting:
```typescript
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com',
  process.env.NEXT_PUBLIC_APP_URL
].filter(Boolean);

const origin = request.headers.get('origin');
if (origin && allowedOrigins.includes(origin)) {
  response.headers.set('Access-Control-Allow-Origin', origin);
}
```

---

## High Severity Findings

### 4. Missing Input Validation in Python Processing API

**Location:** [`audio-karaoke-app/src/app/api/python-processing/route.ts:19`](../audio-karaoke-app/src/app/api/python-processing/route.ts)

**Code:**
```typescript
const { url, filename, model = 'htdemucs', format = 'mp3' } = body;
```

**Impact:** 
- The `url` parameter is only checked for presence, not validity
- The `model` parameter could be manipulated to access unintended models
- No validation of `filename` format or path characters

**Root Cause:** Missing schema validation using Zod or similar library.

**Recommendation:** Implement Zod schema validation:
```typescript
const processSchema = z.object({
  url: z.string().url().optional(),
  filename: z.string().regex(/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/).optional(),
  model: z.enum(['htdemucs', 'htdemucs_ft', 'bs_roformer']),
  format: z.enum(['mp3', 'wav'])
});
```

---

### 5. Memory Exhaustion with Large Audio Files

**Location:** [`audio-karaoke-app/src/utils/audio/audioEngine.ts`](../audio-karaoke-app/src/utils/audio/audioEngine.ts)

**Code:**
```typescript
const finalBuffers = bufferManager.getAllAudioBuffers();
// ...
return {
    vocals: finalBuffers.vocals,
    instrumentals: finalBuffers.instrumentals,
    // ...
};
```

**Impact:**
- Processing large audio files (>30 minutes) can exhaust browser memory
- Application crash without graceful degradation
- User data loss (unsaved processing results)

**Root Cause:** The streaming architecture processes chunks but aggregates all results in memory before returning. No memory limits or chunked output options.

**Recommendation:** 
1. Implement memory usage monitoring
2. Add file duration limits with user warnings
3. Consider streaming results to IndexedDB incrementally
4. Add progress-based cancellation for large files

---

### 6. Worker Pool Memory Leak

**Location:** [`audio-karaoke-app/src/utils/audio/audioExporter.ts:337-371`](../audio-karaoke-app/src/utils/audio/audioExporter.ts)

**Code:**
```typescript
async acquire(): Promise<Worker> {
    // ...
    if (this.workers.length < this.maxWorkers) {
        const worker = new Worker(this.workerUrl);
        this.workers.push(worker);
        return worker;
    }
    // ...
}

release(worker: Worker): void {
    if (this.availableWorkers.length < this.maxWorkers) {
        this.availableWorkers.push(worker);
    } else {
        worker.terminate();
        // ...
    }
}
```

**Impact:**
- Workers may not be properly terminated in error scenarios
- Memory and CPU resources remain allocated
- Browser tab performance degrades over time

**Root Cause:** 
1. No timeout for worker acquisition
2. Workers are reused indefinitely without refresh
3. Error paths may skip worker release

**Recommendation:**
1. Add timeout to worker acquisition
2. Implement worker "refresh" after N uses
3. Use try-finally pattern for guaranteed release
4. Add cleanup on page visibility change

---

### 7. Missing Rate Limiting on Expensive Operations

**Location:** Multiple API routes

**Affected Endpoints:**
- `/api/extract-youtube` - YouTube downloads
- `/api/python-processing` - Audio separation
- `/api/backend-download` - File downloads

**Impact:**
- Resource exhaustion attacks
- Backend service overload
- Potential bill shock from cloud provider costs

**Root Cause:** No rate limiting middleware implemented.

**Recommendation:** Implement rate limiting using:
- `next-rate-limit` package
- Redis-backed rate limiting for distributed deployments
- Per-IP and per-user limits

---

### 8. Insecure Error Messages Expose Internal Details

**Location:** [`audio-karaoke-app/src/app/api/python-processing/route.ts:124`](../audio-karaoke-app/src/app/api/python-processing/route.ts)

**Code:**
```typescript
return NextResponse.json(
    { error: `Failed to connect to audio separation service: ${message}` },
    { status: 503 }
);
```

**Impact:**
- Internal service URLs may be exposed
- Stack traces could leak implementation details
- Aids attackers in reconnaissance

**Root Cause:** Raw error messages from internal services are passed through to clients.

**Recommendation:** Sanitize error messages:
```typescript
const publicErrors: Record<string, string> = {
    'ECONNREFUSED': 'Service temporarily unavailable',
    'ETIMEDOUT': 'Request timeout, please try again',
    'default': 'An unexpected error occurred'
};
```

---

### 9. YouTube URL Validation Insufficient

**Location:** `audio-karaoke-app/src/app/api/extract-youtube/route.ts:18-25` (Deleted)

**Code:**
```typescript
function isValidYouTubeUrl(url: string): boolean {
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/,
        // ...
    ];
    return patterns.some(pattern => pattern.test(url));
}
```

**Impact:**
- Accepts any URL that looks like YouTube
- Could be bypassed with `youtube.com.evil.com`
- No validation of actual video ID format

**Root Cause:** Regex patterns are too permissive and don't validate the actual video ID.

**Recommendation:**
```typescript
function isValidYouTubeUrl(url: string): { valid: boolean; videoId?: string } {
    try {
        const parsed = new URL(url);
        if (!['youtube.com', 'www.youtube.com', 'youtu.be'].includes(parsed.hostname)) {
            return { valid: false };
        }
        const videoId = extractVideoId(parsed);
        if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return { valid: false };
        }
        return { valid: true, videoId };
    } catch {
        return { valid: false };
    }
}
```

---

## Medium Severity Findings

### 10. Client-Side Only File Validation

**Location:** [`audio-karaoke-app/src/components/AudioUpload/AudioUpload.tsx:39-67`](../audio-karaoke-app/src/components/AudioUpload/AudioUpload.tsx)

**Impact:** Validation can be bypassed by:
- Modifying the client-side code
- Directly calling the API endpoint
- Using tools like curl or Postman

**Recommendation:** Implement server-side validation in all file upload API routes.

---

### 11. LRC Parser Vulnerable to Malicious Content

**Location:** [`audio-karaoke-app/src/utils/karaoke/lrcParser.ts:13-84`](../audio-karaoke-app/src/utils/karaoke/lrcParser.ts)

**Code:**
```typescript
const text = trimmedLine.replace(timeRegex, '').trim();
// ...
parsedLines.push({
    startTime,
    endTime: 0,
    text  // No sanitization
});
```

**Impact:** Malicious LRC files could contain:
- Excessive line counts causing DoS
- Extremely long lines consuming memory
- Script injection if rendered unsafely

**Recommendation:**
1. Limit maximum file size
2. Limit maximum line count
3. Truncate excessively long lines
4. Sanitize text content

---

### 12. Missing Content Security Policy

**Location:** [`audio-karaoke-app/next.config.ts`](../audio-karaoke-app/next.config.ts)

**Impact:** Without CSP, the application is more vulnerable to:
- XSS attacks
- Clickjacking
- Form hijacking

**Recommendation:** Add CSP headers:
```typescript
'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self' https://*.your-domain.com"
```

---

### 13. Batch Processing Race Conditions

**Location:** [`audio-karaoke-app/src/hooks/useBatchSeparation.ts:141-191`](../audio-karaoke-app/src/hooks/useBatchSeparation.ts:141)

**Code:**
```typescript
const runBatchLoop = async (model: ModelInfo) => {
    // ...
    const nextIdx = queueRef.current.findIndex(i => i.status === 'pending');
    // ...
    updateItemStatus(item.id, { status: 'processing', message: 'Starting...' });
```

**Impact:**
- State inconsistencies between ref and state
- Items could be processed twice
- UI may show incorrect status

**Root Cause:** Mixing refs and state for the same data creates synchronization issues.

**Recommendation:** Use a single source of truth with useReducer or a state machine.

---

### 14. AudioContext Not Properly Closed

**Location:** [`audio-karaoke-app/src/app/[locale]/page.tsx:158-162`](../audio-karaoke-app/src/app/[locale]/page.tsx)

**Code:**
```typescript
const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
if (!AudioContextClass) {
    throw new Error("AudioContext not supported");
}
const ctx = new AudioContextClass();
```

**Impact:**
- AudioContext instances accumulate
- Browser audio resources exhausted
- Memory leak

**Recommendation:** Always close AudioContext after use:
```typescript
try {
    // ... use context
} finally {
    await ctx.close();
}
```

---

### 15. Missing Authorization Checks

**Location:** All API routes

**Impact:** Any user can:
- Access any cached audio
- Delete any song from the library
- Modify any playlist

**Recommendation:** Implement user authentication and authorization checks.

---

### 16. Unbounded History Storage

**Location:** [`audio-karaoke-app/src/utils/storage/historyStore.ts`](../audio-karaoke-app/src/utils/storage/historyStore.ts)

**Impact:**
- IndexedDB grows unbounded
- Performance degrades over time
- User storage quota exceeded

**Recommendation:** Implement automatic cleanup:
- Limit to last N sessions
- Add expiration dates
- Provide user control over storage

---

### 17. Missing Input Sanitization in LyricDisplay

**Location:** [`audio-karaoke-app/src/components/Karaoke/LyricDisplay.tsx:131-133`](../audio-karaoke-app/src/components/Karaoke/LyricDisplay.tsx)

**Code:**
```tsx
<p className={isActive ? (visualSettings?.highlightColor || 'text-yellow-400') : ''}>
    {line.text}
</p>
```

**Impact:** While React escapes by default, the `highlightColor` is used as a className which could be manipulated.

**Recommendation:** Validate `highlightColor` against a whitelist.

---

## Low Severity Findings

### 18. Using `alert()` for Error Display

**Location:** Multiple files (page.tsx, YouTubeInput.tsx, etc.)

**Impact:** Poor user experience, blocks UI thread.

**Recommendation:** Implement toast notifications using a library like react-hot-toast.

---

### 19. Console Logging in Production

**Location:** Multiple files

**Impact:** 
- Information leakage
- Performance impact
- Unprofessional appearance

**Recommendation:** Use environment-based logging:
```typescript
const logger = {
    debug: process.env.NODE_ENV === 'development' ? console.log : () => {},
    error: console.error,
    warn: console.warn
};
```

---

### 20. Missing TypeScript Strict Checks

**Location:** [`audio-karaoke-app/tsconfig.json`](../audio-karaoke-app/tsconfig.json)

**Impact:** Potential runtime errors from type coercion.

**Recommendation:** Enable strict mode and address all errors.

---

### 21. Hardcoded Timeout Values

**Location:** Multiple files

**Examples:**
- `setTimeout(() => controller.abort(), 60000)` - 60 seconds
- `setTimeout(() => controller.abort(), 300000)` - 5 minutes

**Recommendation:** Make timeouts configurable via environment variables.

---

### 22. Missing AbortController Cleanup

**Location:** [`audio-karaoke-app/src/hooks/useSeparation.ts:111-117`](../audio-karaoke-app/src/hooks/useSeparation.ts:111)

**Code:**
```typescript
useEffect(() => {
    return () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };
}, []);
```

**Impact:** AbortController is aborted but not reset, potential issues with subsequent requests.

**Recommendation:** Reset the ref after abort.

---

### 23. Inconsistent Error Handling Patterns

**Location:** Throughout codebase

**Impact:** Some errors are caught and displayed, others crash the app.

**Recommendation:** Implement a consistent error boundary and error handling pattern.

---

## Performance Issues

### Rendering Performance

1. **Unnecessary Re-renders in KaraokePlayer**
   - Location: [`KaraokePlayer.tsx`](../audio-karaoke-app/src/components/Karaoke/KaraokePlayer.tsx)
   - Multiple useEffect hooks trigger state updates that cause cascading re-renders
   - Consider using useMemo and useCallback more extensively

2. **Large List Rendering Without Virtualization**
   - Location: [`LibraryGrid.tsx`](../audio-karaoke-app/src/components/Library/LibraryGrid.tsx)
   - All songs rendered in DOM simultaneously
   - Consider react-window or react-virtualized for large libraries

3. **Heavy Computations on Main Thread**
   - Location: [`audioExporter.ts`](../audio-karaoke-app/src/utils/audio/audioExporter.ts)
   - WAV encoding done synchronously
   - Already uses workers for MP3, extend to WAV

### Network Performance

1. **No Request Deduplication**
   - Multiple identical requests can be in-flight
   - Implement request caching/deduplication

2. **Missing Compression Headers**
   - API responses don't specify compression preferences
   - Add `Accept-Encoding: gzip, deflate, br`

### Memory Performance

1. **Audio Buffer Accumulation**
   - Processed audio stays in memory until manually cleared
   - Implement automatic memory management

2. **Worker Blob URLs Not Revoked**
   - Location: [`audioExporter.ts:334`](../audio-karaoke-app/src/utils/audio/audioExporter.ts:334)
   - Blob URLs created but never revoked

---

## Architectural Recommendations

1. **Implement Proper State Management**
   - Current mix of useState, useRef, and context is error-prone
   - Consider Zustand or Jotai for global state

2. **Add Error Boundaries**
   - Wrap major components in error boundaries
   - Provide graceful fallbacks

3. **Implement Proper Logging**
   - Add structured logging with levels
   - Send errors to monitoring service (Sentry, LogRocket)

4. **Add Feature Flags**
   - Enable gradual rollout of new features
   - Allow quick rollback of problematic features

5. **Implement Proper Testing**
   - Add integration tests for API routes
   - Add E2E tests for critical user flows

---

## Remediation Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | XSS Vulnerability | Low |
| P0 | Path Traversal | Medium |
| P0 | CORS Configuration | Low |
| P1 | Input Validation | Medium |
| P1 | Memory Management | High |
| P1 | Rate Limiting | Medium |
| P2 | Error Handling | Medium |
| P2 | CSP Headers | Low |
| P2 | Authorization | High |

---

## Conclusion

This audit reveals several security vulnerabilities that require immediate attention, particularly the XSS vulnerability and path traversal issues. The performance concerns, while not immediately critical, will become more pronounced as the application scales. Implementing the recommended fixes will significantly improve the security posture and performance characteristics of the application.

The next step is to generate the refactored code to address each identified issue.

---

## Remediation Progress

> **Last Updated**: February 2026 — Update this table as issues are resolved.

| ID | Priority | Issue | Status | Notes |
|----|----------|-------|--------|-------|
| #1 | **P0** | XSS via `dangerouslySetInnerHTML` in `layout.tsx` | ✅ Fixed | `page.tsx` already used `t.rich()`. `layout.tsx` SW registration moved to `public/sw-register.js` via `next/script`. |
| #2 | **P0** | Path traversal in `backend-files/[...path]/route.ts` | ✅ Fixed | `validateFilePath()` in `utils/security/sanitize.ts` — blocks `..`, null bytes, encoded traversal, non-whitelisted extensions. |
| #3 | **P0** | Wildcard CORS `Access-Control-Allow-Origin: *` | ✅ Fixed | `middleware.ts` implements origin whitelisting via `getAllowedOrigins()` + `isOriginAllowed()`. No wildcard remains. |
| #4 | P1 | Missing input validation in `python-processing/route.ts` | 🔜 Open | Add Zod schema validation |
| #5 | P1 | Memory exhaustion with large audio files | 🔜 Open | Stream results to IndexedDB incrementally |
| #6 | P1 | Worker pool memory leak in `audioExporter.ts` | 🔜 Open | Add try-finally for guaranteed release |
| #7 | P1 | Missing rate limiting on expensive API routes | 🔜 Open | Add `next-rate-limit` or Redis-backed limiter |
| #8 | P1 | Insecure error messages expose internal details | 🔜 Open | Sanitize error messages to user-safe strings |
| #9 | P1 | YouTube URL validation insufficient | 🔜 Open | Validate via `new URL()` + video ID regex |
| #10 | P2 | Client-side only file validation | 🔜 Open | Add server-side validation in API routes |
| #11 | P2 | LRC parser DoS via malicious content | 🔜 Open | Add line count and file size limits |
| #12 | P2 | Missing Content Security Policy | 🔜 Open | Add CSP headers in `next.config.ts` |
| #13 | P2 | Batch processing race conditions | 🔜 Open | Use `useReducer` single source of truth |
| #14 | P2 | AudioContext not closed after use | 🔜 Open | Use try-finally pattern |
| #18 | Low | `alert()` for error display | 🔜 Open | Replace with toast notifications |
| #19 | Low | Console logging in production | 🔜 Open | Add environment-based logger |
| #20 | Low | Missing TypeScript strict checks | 🔜 Open | Enable strict mode in `tsconfig.json` |

