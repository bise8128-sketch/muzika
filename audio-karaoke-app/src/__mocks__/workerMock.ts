export class MockWorker {
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(stringUrl: string) {
      this.url = stringUrl;
  }

  postMessage(msg: any) {
      // Logic to simulate worker response can be added here
      // For now, we leave it empty or trigger a specific response if needed
  }

  terminate() {}
  
  addEventListener(type: string, listener: any) {
      if (type === 'message') this.onmessage = listener;
      if (type === 'error') this.onerror = listener;
  }
  
  removeEventListener(type: string, listener: any) {
      if (type === 'message' && this.onmessage === listener) this.onmessage = null;
      if (type === 'error' && this.onerror === listener) this.onerror = null;
  }
}
