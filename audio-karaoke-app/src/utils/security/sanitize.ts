/**
 * Security Utilities for Input Sanitization and Validation
 * 
 * This module provides security utilities to prevent XSS, path traversal,
 * and other common web vulnerabilities.
 */

/**
 * Sanitizes HTML content using a whitelist approach
 * Removes all HTML tags except explicitly allowed ones
 * 
 * @param html - The HTML string to sanitize
 * @param options - Configuration options
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(
  html: string, 
  options: {
    allowedTags?: string[];
    allowedAttributes?: Record<string, string[]>;
  } = {}
): string {
  const {
    allowedTags = ['b', 'i', 'em', 'strong', 'span', 'br'],
    allowedAttributes = {}
  } = options;

  if (!html || typeof html !== 'string') {
    return '';
  }

  // First, decode any HTML entities to catch encoded attacks
  let decoded = html;
  
  // Create a temporary element to decode HTML entities
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    decoded = textarea.value;
  }

  // Remove script tags and their content
  decoded = decoded.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  decoded = decoded.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  decoded = decoded.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  
  // Remove javascript: URLs
  decoded = decoded.replace(/javascript\s*:/gi, '');
  
  // Remove data: URLs (can contain malicious content)
  decoded = decoded.replace(/data\s*:/gi, '');
  
  // Remove vbscript: URLs
  decoded = decoded.replace(/vbscript\s*:/gi, '');

  // Build a regex to match allowed tags
  const allowedTagsPattern = allowedTags.join('|');
  const tagPattern = new RegExp(
    `<(\\/?)((?!${allowedTagsPattern})[a-z][a-z0-9]*)[^>]*>`,
    'gi'
  );

  // Remove disallowed tags but keep their content
  decoded = decoded.replace(tagPattern, '');

  // Filter attributes for allowed tags
  decoded = decoded.replace(
    new RegExp(`<(${allowedTagsPattern})([^>]*)>`, 'gi'),
    (match, tagName, attributes) => {
      const allowed = allowedAttributes[tagName.toLowerCase()] || [];
      
      // If no attributes allowed, return just the tag
      if (allowed.length === 0) {
        return `<${tagName}>`;
      }

      // Filter attributes
      const filteredAttrs = allowed
        .map(attr => {
          const pattern = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
          const attrMatch = attributes.match(pattern);
          return attrMatch ? `${attr}="${escapeHtml(attrMatch[1])}"` : null;
        })
        .filter(Boolean)
        .join(' ');

      return filteredAttrs ? `<${tagName} ${filteredAttrs}>` : `<${tagName}>`;
    }
  );

  return decoded;
}

/**
 * Escapes HTML special characters to prevent XSS
 * 
 * @param str - The string to escape
 * @returns Escaped string safe for HTML context
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  const htmlEntities: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  return str.replace(/[&<>"'`=/]/g, char => htmlEntities[char] || char);
}

/**
 * Escapes special characters for use in CSS (e.g., className)
 * 
 * @param str - The string to escape
 * @returns Escaped string safe for CSS context
 */
export function escapeCss(str: string): string {
  if (!str || typeof str !== 'string') {
    return '';
  }

  // Remove any characters that aren't valid in CSS class names
  // CSS class names can contain letters, digits, hyphens, and underscores
  return str.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Validates and sanitizes a file path to prevent path traversal attacks
 * 
 * @param pathSegments - Array of path segments to validate
 * @param options - Validation options
 * @returns Object with validation result and sanitized path
 */
export function validateFilePath(
  pathSegments: string[],
  options: {
    allowedExtensions?: string[];
    maxPathLength?: number;
    allowAbsolute?: boolean;
  } = {}
): { valid: boolean; path: string; error?: string } {
  const {
    allowedExtensions = [],
    maxPathLength = 255,
    allowAbsolute = false
  } = options;

  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return { valid: false, path: '', error: 'Path segments are required' };
  }

  // Check total path length
  const fullPath = pathSegments.join('/');
  if (fullPath.length > maxPathLength) {
    return { valid: false, path: '', error: 'Path exceeds maximum length' };
  }

  // Validate each segment
  for (const segment of pathSegments) {
    // Check for path traversal attempts
    if (segment.includes('..')) {
      return { valid: false, path: '', error: 'Path traversal detected' };
    }

    // Check for null bytes
    if (segment.includes('\0')) {
      return { valid: false, path: '', error: 'Invalid null byte in path' };
    }

    // Check for absolute path attempts
    if (!allowAbsolute && (segment.startsWith('/') || segment.startsWith('\\'))) {
      return { valid: false, path: '', error: 'Absolute paths not allowed' };
    }

    // Check for Windows drive letters
    if (/^[a-zA-Z]:/.test(segment)) {
      return { valid: false, path: '', error: 'Drive letters not allowed' };
    }

    // Check for URL-encoded traversal attempts
    try {
      const decoded = decodeURIComponent(segment);
      if (decoded.includes('..') || decoded.includes('\0')) {
        return { valid: false, path: '', error: 'Encoded path traversal detected' };
      }
    } catch {
      // Invalid encoding
      return { valid: false, path: '', error: 'Invalid URL encoding in path' };
    }
  }

  // Check file extension if restrictions are set
  if (allowedExtensions.length > 0) {
    const lastSegment = pathSegments[pathSegments.length - 1];
    const extension = lastSegment.split('.').pop()?.toLowerCase();
    
    if (!extension || !allowedExtensions.includes(extension)) {
      return { 
        valid: false, 
        path: '', 
        error: `File extension not allowed. Allowed: ${allowedExtensions.join(', ')}` 
      };
    }
  }

  // Build sanitized path
  const sanitizedPath = pathSegments
    .map(segment => segment.replace(/[\/\\]/g, '')) // Remove any remaining slashes
    .filter(Boolean)
    .join('/');

  return { valid: true, path: sanitizedPath };
}

/**
 * Validates a YouTube URL and extracts the video ID
 * 
 * @param url - The URL to validate
 * @returns Object with validation result and video ID if valid
 */
export function validateYouTubeUrl(url: string): { 
  valid: boolean; 
  videoId?: string; 
  error?: string 
} {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Trim and normalize
  const normalizedUrl = url.trim();

  // Check for obviously malicious URLs
  if (normalizedUrl.includes('javascript:') || normalizedUrl.includes('data:')) {
    return { valid: false, error: 'Invalid URL scheme' };
  }

  try {
    const parsed = new URL(normalizedUrl);
    
    // Validate hostname - must be exactly youtube.com or youtu.be
    const allowedHosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];
    if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
      return { valid: false, error: 'Invalid YouTube hostname' };
    }

    // Extract video ID based on URL format
    let videoId: string | null = null;

    if (parsed.hostname === 'youtu.be') {
      // youtu.be/VIDEO_ID format
      videoId = parsed.pathname.slice(1).split('/')[0];
    } else {
      // youtube.com format
      if (parsed.pathname === '/watch') {
        videoId = parsed.searchParams.get('v');
      } else if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/')[2];
      } else if (parsed.pathname.startsWith('/v/')) {
        videoId = parsed.pathname.split('/')[2];
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/')[2];
      }
    }

    // Validate video ID format (YouTube video IDs are exactly 11 characters)
    if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return { valid: false, error: 'Invalid YouTube video ID' };
    }

    return { valid: true, videoId };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitizes error messages to prevent information leakage
 * Maps internal errors to user-friendly messages
 * 
 * @param error - The error to sanitize
 * @returns User-safe error message
 */
export function sanitizeErrorMessage(error: unknown): string {
  // Map of internal error codes to public messages
  const publicErrorMessages: Record<string, string> = {
    'ECONNREFUSED': 'Service temporarily unavailable. Please try again later.',
    'ETIMEDOUT': 'Request timed out. Please try again.',
    'ENOTFOUND': 'Service unavailable. Please try again later.',
    'ECONNRESET': 'Connection lost. Please try again.',
    'EPIPE': 'Connection closed. Please try again.',
    'CircuitOpenError': 'Service is temporarily unavailable. Please wait a moment and try again.',
    'AbortError': 'Request was cancelled or timed out.',
    'NetworkError': 'Network error. Please check your connection.',
  };

  if (error instanceof Error) {
    // Check for known error types
    for (const [code, message] of Object.entries(publicErrorMessages)) {
      if (error.name === code || error.message.includes(code)) {
        return message;
      }
    }

    // Check for HTTP status errors
    if (error.message.includes('429')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      return 'Access denied. Please check your permissions.';
    }
    if (error.message.includes('404')) {
      return 'Resource not found.';
    }
    if (error.message.includes('500')) {
      return 'Server error. Please try again later.';
    }
  }

  // Default generic message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Content Security Policy directive builder
 */
export function buildCSP(options: {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  mediaSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  workerSrc?: string[];
  frameSrc?: string[];
  reportUri?: string;
}): string {
  const {
    defaultSrc = ["'self'"],
    scriptSrc = ["'self'"],
    styleSrc = ["'self'", "'unsafe-inline'"],
    imgSrc = ["'self'", 'data:', 'blob:'],
    mediaSrc = ["'self'", 'blob:'],
    connectSrc = ["'self'"],
    fontSrc = ["'self'"],
    workerSrc = ["'self'", 'blob:'],
    frameSrc = ["'none'"],
    reportUri
  } = options;

  const directives = [
    `default-src ${defaultSrc.join(' ')}`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `img-src ${imgSrc.join(' ')}`,
    `media-src ${mediaSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
    `font-src ${fontSrc.join(' ')}`,
    `worker-src ${workerSrc.join(' ')}`,
    `frame-src ${frameSrc.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join('; ');
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (identifier: string) => string;
}

/**
 * Simple in-memory rate limiter for server-side use
 * Note: For production with multiple instances, use Redis-backed rate limiting
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up old entries periodically
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), config.windowMs);
    }
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;

    // Get existing requests for this identifier
    let timestamps = this.requests.get(key) || [];
    
    // Filter out old requests
    timestamps = timestamps.filter(ts => ts > windowStart);
    
    const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
    const resetTime = timestamps.length > 0 
      ? timestamps[0] + this.config.windowMs 
      : now + this.config.windowMs;

    if (timestamps.length >= this.config.maxRequests) {
      this.requests.set(key, timestamps);
      return { allowed: false, remaining: 0, resetTime };
    }

    // Add new request
    timestamps.push(now);
    this.requests.set(key, timestamps);

    return { allowed: true, remaining: remaining - 1, resetTime };
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(ts => ts > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }
}
