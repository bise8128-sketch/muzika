# Security and Performance Refactoring Guide

This document provides the refactored code and implementation guide for addressing the security and performance issues identified in the audit report.

## Summary of Changes

| Issue | Severity | File | Status |
|-------|----------|------|--------|
| XSS via dangerouslySetInnerHTML | Critical | `page.tsx` | ✅ Fixed |
| Path Traversal | Critical | `backend-files/[...path]/route.ts` | ✅ Fixed |
| Overly Permissive CORS | Critical | `middleware.ts` | ✅ Fixed |
| Missing Input Validation | High | `python-processing/route.ts` | ✅ Fixed |
| Insufficient YouTube URL Validation | High | `extract-youtube/route.ts` | ✅ Fixed |
| LRC Parser Vulnerabilities | Medium | `lrcParser.ts` | ✅ Fixed |
| Missing CSP Headers | Medium | `middleware.ts` | ✅ Fixed |
| Memory Management | High | New file | ✅ Created |
| Error Message Sanitization | High | New file | ✅ Created |

---

## 1. Security Utilities Module

**New File:** `audio-karaoke-app/src/utils/security/sanitize.ts`

This module provides comprehensive security utilities:

### Key Functions:

- **`sanitizeHtml()`** - Whitelist-based HTML sanitization
- **`escapeHtml()`** - HTML entity encoding
- **`validateFilePath()`** - Path traversal prevention
- **`validateYouTubeUrl()`** - YouTube URL validation with video ID extraction
- **`sanitizeErrorMessage()`** - Error message sanitization to prevent information leakage
- **`buildCSP()`** - Content Security Policy builder
- **`RateLimiter`** - In-memory rate limiting class

### Usage Examples:

```typescript
import { 
    validateFilePath, 
    validateYouTubeUrl, 
    sanitizeErrorMessage 
} from '@/utils/security/sanitize';

// Validate file path
const result = validateFilePath(['path', 'to', 'file.mp3'], {
    allowedExtensions: ['mp3', 'wav'],
    maxPathLength: 255
});
if (!result.valid) {
    throw new Error(result.error);
}

// Validate YouTube URL
const urlResult = validateYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ');
if (urlResult.valid) {
    console.log('Video ID:', urlResult.videoId);
}

// Sanitize error for client response
const safeMessage = sanitizeErrorMessage(internalError);
```

---

## 2. Middleware Security Headers

**Modified File:** `audio-karaoke-app/src/middleware.ts`

### Changes:

1. **Origin Whitelisting** - CORS now validates origins against a whitelist
2. **Content Security Policy** - Added CSP headers for non-API routes
3. **Environment-based Configuration** - Origins configurable via environment variables

### Environment Variables:

```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOW_VERCEL_PREVIEWS=true  # For preview deployments
```

---

## 3. Backend Files API - Path Traversal Fix

**Modified File:** `audio-karaoke-app/src/app/api/backend-files/[...path]/route.ts`

### Security Improvements:

1. **Path Validation** - Uses `validateFilePath()` to prevent traversal
2. **Extension Whitelist** - Only allows specific file types
3. **File Size Limit** - Maximum 50MB file size
4. **Timeout Protection** - 30 second request timeout
5. **Sanitized Error Messages** - No internal details exposed

### Allowed Extensions:
```typescript
const ALLOWED_EXTENSIONS = [
    'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma',
    'json', 'txt'
];
```

---

## 4. YouTube Extraction API

**Modified File:** `audio-karaoke-app/src/app/api/extract-youtube/route.ts`

### Security Improvements:

1. **Strict URL Validation** - Validates hostname and extracts video ID
2. **Video ID Format Check** - Ensures 11-character alphanumeric ID
3. **Rate Limiting** - 10 requests per minute per IP
4. **Format Validation** - Only allows specific audio formats
5. **Response Path Validation** - Validates returned file paths

### Rate Limit Configuration:
```typescript
const rateLimiter = new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10
});
```

---

## 5. Python Processing API

**Modified File:** `audio-karaoke-app/src/app/api/python-processing/route.ts`

### Security Improvements:

1. **Request Schema Validation** - Validates all input parameters
2. **Model Whitelist** - Only allows known separation models
3. **Format Whitelist** - Only allows specific output formats
4. **Filename Validation** - Prevents path traversal in filenames
5. **Rate Limiting** - 5 requests per 5 minutes per IP
6. **Stem Path Validation** - Validates returned stem paths

### Allowed Models:
```typescript
const ALLOWED_MODELS = [
    'htdemucs', 'htdemucs_ft', 'mdx', 'mdx_extra',
    'mdx_q', 'mdx_extra_q', 'bs_roformer'
];
```

---

## 6. LRC Parser Security

**Modified File:** `audio-karaoke-app/src/utils/karaoke/lrcParser.ts`

### Security Improvements:

1. **File Size Limit** - Maximum 1MB file size
2. **Line Count Limit** - Maximum 10,000 lines
3. **Line Length Limit** - Maximum 1,000 characters per line
4. **Text Sanitization** - HTML escaping for lyric text
5. **Timestamp Validation** - Reasonable time value checks
6. **Metadata Key Whitelist** - Only allows known metadata keys

### Parser Limits:
```typescript
const PARSER_LIMITS = {
    MAX_FILE_SIZE: 1024 * 1024,    // 1MB
    MAX_LINES: 10000,
    MAX_LINE_LENGTH: 1000,
    MAX_TEXT_LENGTH: 500,
};
```

---

## 7. Memory Management

**New File:** `audio-karaoke-app/src/utils/audio/memoryManager.ts`

### Features:

1. **Memory Estimation** - Calculate required memory before processing
2. **Memory Monitoring** - Track heap usage (Chrome)
3. **Buffer Pooling** - Reuse audio buffers to reduce allocations
4. **Resource Cleanup** - Proper disposal of audio resources

### Usage:

```typescript
import { 
    validateAudioFile, 
    cleanupAudioResources,
    audioBufferPool 
} from '@/utils/audio/memoryManager';

// Validate before processing
const validation = validateAudioFile(duration, fileSize);
if (!validation.valid) {
    throw new Error(validation.error);
}
if (validation.warning) {
    console.warn(validation.warning);
}

// Clean up after processing
cleanupAudioResources(audioContext, [vocalsBuffer, instrumentalBuffer], blobUrls);
```

---

## 8. Toast Notification System

**New File:** `audio-karaoke-app/src/utils/notifications/toast.tsx`

### Features:

- Replaces browser `alert()` with styled toast notifications
- Accessible with ARIA attributes
- Auto-dismiss with configurable duration
- Multiple notification types (success, error, warning, info)

### Usage:

```tsx
// In layout or _app.tsx
import { ToastProvider } from '@/utils/notifications/toast';

export default function RootLayout({ children }) {
    return (
        <ToastProvider>
            {children}
        </ToastProvider>
    );
}

// In components
import { useToast, createErrorToast } from '@/utils/notifications/toast';

function MyComponent() {
    const { addToast } = useToast();
    
    const handleError = (error: unknown) => {
        addToast(createErrorToast(error));
    };
    
    const handleSuccess = () => {
        addToast({
            type: 'success',
            title: 'Processing complete',
            message: 'Your audio has been separated'
        });
    };
}
```

---

## Implementation Checklist

### Immediate Actions (P0)

- [x] Remove `dangerouslySetInnerHTML` from page.tsx
- [x] Implement path validation in backend-files API
- [x] Configure CORS origin whitelist
- [x] Add Content-Security-Policy headers

### Short-term Actions (P1)

- [x] Add input validation to all API routes
- [x] Implement rate limiting
- [x] Add memory management for audio processing
- [x] Create toast notification system

### Medium-term Actions (P2)

- [x] Secure LRC parser with limits
- [x] Add error message sanitization
- [ ] Implement user authentication
- [ ] Add authorization checks to API routes

### Long-term Actions (P3)

- [ ] Implement Redis-backed rate limiting for production
- [ ] Add request logging and monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Add E2E tests for security scenarios

---

## Environment Variables Required

Add these to your `.env` file:

```env
# Security
NEXT_PUBLIC_APP_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOW_VERCEL_PREVIEWS=false

# Rate Limiting (for Redis in production)
# REDIS_URL=redis://localhost:6379

# Timeouts
SEPARATION_TIMEOUT_MS=300000
```

---

## Testing Security Fixes

### Test Path Traversal Prevention:

```bash
# Should return 400 error
curl "http://localhost:3000/api/backend-files/../../../etc/passwd"
curl "http://localhost:3000/api/backend-files/..%2F..%2F..%2Fetc%2Fpasswd"
```

### Test YouTube URL Validation:

```bash
# Should return 400 error
curl -X POST http://localhost:3000/api/extract-youtube \
  -H "Content-Type: application/json" \
  -d '{"url": "https://evil.com/fake"}'
```

### Test Rate Limiting:

```bash
# Should return 429 after limit exceeded
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/extract-youtube \
    -H "Content-Type: application/json" \
    -d '{"url": "https://youtube.com/watch?v=test"}'
done
```

---

## Migration Notes

1. **Translation Files**: If the title in translation files contains HTML formatting, update the translation files to use plain text or split into separate keys.

2. **CORS Origins**: Ensure all legitimate origins are added to the whitelist before deploying to production.

3. **Rate Limiting**: The in-memory rate limiter is suitable for single-instance deployments. For production with multiple instances, implement Redis-backed rate limiting.

4. **Memory Management**: Large audio files (>30 minutes) will now be rejected. Communicate this limitation to users.

---

## Files Modified

| File | Action |
|------|--------|
| `src/middleware.ts` | Modified |
| `src/app/[locale]/page.tsx` | Modified |
| `src/app/api/backend-files/[...path]/route.ts` | Modified |
| `src/app/api/extract-youtube/route.ts` | Modified |
| `src/app/api/python-processing/route.ts` | Modified |
| `src/utils/karaoke/lrcParser.ts` | Modified |
| `src/utils/security/sanitize.ts` | Created |
| `src/utils/audio/memoryManager.ts` | Created |
| `src/utils/notifications/toast.tsx` | Created |
