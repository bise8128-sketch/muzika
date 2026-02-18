// Service Worker registration
// This script is intentionally kept as a separate file to avoid
// using dangerouslySetInnerHTML in layout.tsx (XSS prevention).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
