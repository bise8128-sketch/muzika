# Audio Processing & Web Audio API Integration

## 1. Web Audio API Osnove

Web Audio API je moćan API za procesiranje zvuka direktno u pregledniku.

```
┌─────────────────────────────┐
│   Audio Input Sources        │
│   - File input               │
│   - Microphone               │
│   - HTML5 audio element      │
└────────────┬────────────────┘
             │ decode
┌────────────▼────────────────┐
│   AudioContext               │
│   - Sample Rate (44.1/48kHz) │
│   - Create nodes             │
└────────────┬────────────────┘
             │
┌────────────▼────────────────┐
│   Audio Graph Nodes          │
│   - BufferSource             │
│   - Gain (volume)            │
│   - Analyser (visualization) │
│   - Custom (AudioWorklet)    │
└────────────┬────────────────┘
             │
┌────────────▼────────────────┐
│   Audio Output               │
│   - Speakers / Headphones    │
│   - WAV/MP3 File Export      │
└─────────────────────────────┘
```

---

## 2. AudioContext i BufferSource Setup

### File: `src/utils/audio/audioContext.ts`

```typescript
export interface AudioContextConfig {
  sampleRate?: number; // 44100 ili 48000
  numChannels?: number; // 1 (mono) ili 2 (stereo)
}

export class AudioContextManager {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;

  constructor(config?: AudioContextConfig) {
    // Kreiraj audio context
    this.audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)({
      sampleRate: config?.sampleRate || 44100,
    });

    // Kreiraj gain node za kontrolu volumena
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    console.log(`AudioContext initialized: ${this.audioContext.sampleRate}Hz`);
  }

  getContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    return this.audioContext;
  }

  getGainNode(): GainNode {
    if (!this.gainNode) {
      throw new Error('GainNode not initialized');
    }
    return this.gainNode;
  }

  async suspendContext(): Promise<void> {
    if (this.audioContext?.state === 'running') {
      await this.audioContext.suspend();
      console.log('AudioContext suspended');
    }
  }

  async resumeContext(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
      console.log('AudioContext resumed');
    }
  }
}
```

---

## 3. Dekodiranje audio datoteka

### File: `src/utils/audio/audioDecoder.ts`

```typescript
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const audioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)();

  try {
    // Čitaj file kao ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Dekodiraj audio
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    console.log(`✅ Audio decoded: ${audioBuffer.duration.toFixed(2)}s @ ${audioBuffer.sampleRate}Hz`);

    return audioBuffer;
  } catch (error) {
    console.error('Audio decoding failed:', error);
    throw new Error(`Failed to decode audio: ${error.message}`);
  }
}

// Primjer korištenja
const audioFile = document.getElementById('audio-input') as HTMLInputElement;
const file = audioFile.files?.[0];

if (file) {
  const audioBuffer = await decodeAudioFile(file);
  console.log(audioBuffer);
}
```

---

## 4. Playback Controller

### File: `src/utils/audio/playbackController.ts`

```typescript
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
}

export class PlaybackController {
  private audioContext: AudioContext;
  private sourceNode: AudioBufferAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private audioBuffer: AudioBuffer;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private isPlaying: boolean = false;
  private listeners: Map<string, Function[]> = new Map();

  constructor(audioBuffer: AudioBuffer, audioContext: AudioContext) {
    this.audioBuffer = audioBuffer;
    this.audioContext = audioContext;
    this.setupAudioGraph();
  }

  private setupAudioGraph(): void {
    // Kreiraj buffer source
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;

    // Kreiraj gain node (za kontrolu volumena)
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0; // 100% volumen

    // Kreiraj destination (zvučnici)
    const destination = this.audioContext.destination;

    // Spoji čvorove: sourceNode → gainNode → destination
    this.sourceNode.connect(this.gainNode);
    this.gainNode.connect(destination);

    // Slušaj završetak
    this.sourceNode.onended = () => {
      this.isPlaying = false;
      this.emit('ended');
    };
  }

  play(): void {
    if (this.isPlaying) return;

    // Kreiraj novi buffer source (ne može se ponovno koristiti)
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode!);
    this.sourceNode.onended = () => {
      this.isPlaying = false;
      this.emit('ended');
    };

    // Izračunaj koliko trebam preskoči
    const offset = this.pausedTime;

    // Pokreni playback
    this.sourceNode.start(0, offset);
    this.startTime = this.audioContext.currentTime - offset;
    this.isPlaying = true;

    this.emit('play');
    this.startTimeUpdateInterval();
  }

  pause(): void {
    if (!this.isPlaying) return;

    this.sourceNode?.stop();
    this.pausedTime = this.audioContext.currentTime - this.startTime;
    this.isPlaying = false;

    this.emit('pause');
    this.stopTimeUpdateInterval();
  }

  stop(): void {
    this.pause();
    this.pausedTime = 0;
    this.emit('stop');
  }

  setVolume(level: number): void {
    const clipped = Math.max(0, Math.min(1, level)); // 0-1
    if (this.gainNode) {
      this.gainNode.gain.value = clipped;
      this.emit('volumechange', clipped);
    }
  }

  setPlaybackRate(rate: number): void {
    // Note: Web Audio API ne podržava playback rate direktno
    // Trebate koristiti biblioteku kao SoundTouchJS
    console.warn('Direct playback rate not supported. Use SoundTouchJS for tempo control.');
  }

  setCurrentTime(seconds: number): void {
    const clipped = Math.max(
      0,
      Math.min(seconds, this.audioBuffer.duration)
    );

    if (this.isPlaying) {
      this.pause();
      this.pausedTime = clipped;
      this.play();
    } else {
      this.pausedTime = clipped;
    }

    this.emit('seek', clipped);
  }

  getCurrentTime(): number {
    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pausedTime;
  }

  getDuration(): number {
    return this.audioBuffer.duration;
  }

  private timeUpdateInterval: number | null = null;

  private startTimeUpdateInterval(): void {
    this.timeUpdateInterval = window.setInterval(() => {
      this.emit('timeupdate', this.getCurrentTime());
    }, 100);
  }

  private stopTimeUpdateInterval(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  // Event emitter
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(...args));
    }
  }
}
```

---

## 5. AudioWorklet za niskolatencijsku obradu

### File: `src/workers/audioProcessorWorklet.ts`

AudioWorklet omogućuje obradu zvuka na zasebnoj niti bez latencije glavnog threada.

```typescript
class AudioProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array;
  private bufferIndex: number = 0;

  constructor(options?: AudioWorkletNodeOptions) {
    super();
    // Alokacija buffer-a za audio
    this.buffer = new Float32Array(8192);

    // Primaj poruke od glavnog threada
    this.port.onmessage = (event) => {
      const { type, data } = event.data;

      if (type === 'PROCESS_AUDIO') {
        // Prilagođena obrada
        this.processAudio(data);
      }
    };
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (input.length === 0) {
      return true; // Nastavi procesiranje
    }

    // Obrada audio podataka
    const inputChannel = input[0];

    for (let i = 0; i < inputChannel.length; i++) {
      // Primjer: jednostavno kopiranje
      output[0][i] = inputChannel[i];

      // Pošalji buffer na glavni thread periodički
      if (this.bufferIndex < this.buffer.length) {
        this.buffer[this.bufferIndex++] = inputChannel[i];
      } else {
        this.port.postMessage({
          type: 'AUDIO_CHUNK',
          data: this.buffer.slice(0, this.bufferIndex),
        });
        this.bufferIndex = 0;
      }
    }

    return true; // Nastavi procesiranje
  }

  private processAudio(data: Float32Array): void {
    // Prilagođena obrada
    for (let i = 0; i < data.length; i++) {
      data[i] *= 0.5; // Primjer: smanji volumen
    }
  }
}

registerProcessor('audio-processor', AudioProcessor);
```

### Registracija AudioWorklet-a

```typescript
// src/utils/audio/audioWorkletManager.ts

export async function setupAudioWorklet(
  audioContext: AudioContext
): Promise<AudioWorkletNode> {
  // Učitaj worklet kod
  await audioContext.audioWorklet.addModule(
    '/workers/audioProcessorWorklet.ts'
  );

  // Kreiraj AudioWorkletNode
  const workletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    channelCount: 2,
  });

  return workletNode;
}
```

---

## 6. FFmpeg WASM za audio konverziju

### File: `src/utils/audio/ffmpegProcessor.ts`

```typescript
import { FFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

const ffmpeg = new FFmpeg();

export async function initFFmpeg(): Promise<void> {
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
    console.log('✅ FFmpeg loaded');
  }
}

export async function extractAudioFromVideo(videoFile: File): Promise<Blob> {
  await initFFmpeg();

  // Učitaj video datoteku
  ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));

  // Ekstrahira samo audio (MP3)
  await ffmpeg.run(
    '-i', 'input.mp4',
    '-q:a', '0',
    '-map', 'a',
    'output.mp3'
  );

  // Čitaj output datoteku
  const data = ffmpeg.FS('readFile', 'output.mp3');

  // Očisti
  ffmpeg.FS('unlink', 'input.mp4');
  ffmpeg.FS('unlink', 'output.mp3');

  return new Blob([data.buffer], { type: 'audio/mpeg' });
}

export async function convertAudioFormat(
  audioFile: File,
  outputFormat: 'mp3' | 'wav' | 'ogg'
): Promise<Blob> {
  await initFFmpeg();

  const inputName = 'input.' + audioFile.type.split('/')[1];
  const outputName = 'output.' + outputFormat;

  ffmpeg.FS('writeFile', inputName, await fetchFile(audioFile));

  await ffmpeg.run('-i', inputName, outputName);

  const data = ffmpeg.FS('readFile', outputName);

  ffmpeg.FS('unlink', inputName);
  ffmpeg.FS('unlink', outputName);

  return new Blob([data.buffer], {
    type: `audio/${outputFormat}`,
  });
}
```

---

## 7. Pitch Shifting i Time Stretching (SoundTouchJS)

### File: `src/utils/audio/soundTouchProcessor.ts`

```typescript
import SoundTouchJS from 'soundtouchjs';

export class SoundTouchProcessor {
  private soundTouch: any;

  constructor(sampleRate: number = 44100) {
    this.soundTouch = new SoundTouchJS.SoundTouch(sampleRate);
  }

  /**
   * Promijeni tonalnost bez promjene tempa
   * @param semitones Broj polustepena (-12 do +12)
   */
  setPitchSemitones(semitones: number): void {
    const pitchShift = Math.pow(2, semitones / 12);
    this.soundTouch.pitch = pitchShift;
    console.log(`Pitch shift: ${semitones} semitones (factor: ${pitchShift.toFixed(3)})`);
  }

  /**
   * Promijeni tempo bez promjene tonalnosti
   * @param tempo Faktor (0.5 = 50%, 1.0 = normalno, 2.0 = 200%)
   */
  setTempo(tempo: number): void {
    const clipped = Math.max(0.5, Math.min(2.0, tempo));
    this.soundTouch.tempo = clipped;
    console.log(`Tempo: ${(clipped * 100).toFixed(0)}%`);
  }

  /**
   * Procesira audio podatke
   */
  process(
    inLeft: Float32Array,
    inRight?: Float32Array
  ): { outLeft: Float32Array; outRight: Float32Array } {
    // Postavi input kanale
    this.soundTouch.inputBuffer.clear();

    if (inRight) {
      // Stereo
      this.soundTouch.inputBuffer.putSamples(inLeft, inRight);
    } else {
      // Mono (dupliciraj za stereo)
      this.soundTouch.inputBuffer.putSamples(inLeft, inLeft);
    }

    // Procesira
    this.soundTouch.process();

    // Ekstrahira output
    const outLeft = new Float32Array(inLeft.length);
    const outRight = new Float32Array(inLeft.length);

    this.soundTouch.outputBuffer.receiveSamples(outLeft, outRight);

    return { outLeft, outRight };
  }

  /**
   * Primjer: Karaoke (tonalnost + tempo)
   */
  setupKaraoke(pitchShift: number, tempoFactor: number): void {
    this.setPitchSemitones(pitchShift);
    this.setTempo(tempoFactor);
    console.log(`🎤 Karaoke setup: pitch=${pitchShift}, tempo=${tempoFactor}`);
  }

  reset(): void {
    this.soundTouch.clear();
  }
}

// Primjer korištenja
const processor = new SoundTouchProcessor(44100);
processor.setupKaraoke(5, 0.95); // +5 polutepena, 95% tempa
const result = processor.process(vocalsBuffer, vocalsBuffer);
```

---

## 8. Audio Visualization (Waveform & Spectrogram)

### File: `src/utils/audio/visualization.ts`

```typescript
export class AudioVisualizer {
  private analyser: AnalyserNode;
  private canvas: HTMLCanvasElement;
  private canvasContext: CanvasRenderingContext2D;
  private animationId: number | null = null;

  constructor(audioContext: AudioContext, canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.canvasContext = canvas.getContext('2d')!;

    // Kreiraj analyser node
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
  }

  connectToSource(sourceNode: AudioNode): void {
    sourceNode.connect(this.analyser);
  }

  drawWaveform(): void {
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);

      this.analyser.getByteFrequencyData(dataArray);

      // Očisti canvas
      this.canvasContext.fillStyle = 'rgb(200, 200, 200)';
      this.canvasContext.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Crtaj frekvencije
      const barWidth = (this.canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      this.canvasContext.fillStyle = 'rgb(200, 0, 0)';

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * this.canvas.height;

        this.canvasContext.fillRect(x, this.canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
```

---

## 9. Export audio u WAV/MP3

### File: `src/utils/audio/audioExporter.ts`

```typescript
export async function exportToWAV(
  audioBuffer: AudioBuffer,
  filename: string = 'audio.wav'
): Promise<void> {
  const audioData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // Kreiraj WAV datoteku
  const wavBuffer = encodeWAV(audioData, sampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });

  // Preuzmi datoteku
  downloadBlob(blob, filename);
}

function encodeWAV(
  samples: Float32Array,
  sampleRate: number
): ArrayBuffer {
  const frame = interleave(samples);
  const dataLength = frame.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // bitDepth
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  // Audio data
  let offset = 44;
  for (let i = 0; i < frame.length; i++) {
    view.setInt16(offset, frame[i] * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function interleave(left: Float32Array, right?: Float32Array): Float32Array {
  const length = left.length + (right ? right.length : 0);
  const result = new Float32Array(length);

  let index = 0;

  for (let i = 0; i < left.length; i++) {
    result[index++] = left[i];
    if (right) {
      result[index++] = right[i];
    }
  }

  return result;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## 10. Primjer React Hook-a

```typescript
// src/hooks/useAudioPlayback.ts
import { useEffect, useRef, useState } from 'react';
import { PlaybackController } from '@/utils/audio/playbackController';

export function useAudioPlayback(audioBuffer: AudioBuffer | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const playerRef = useRef<PlaybackController | null>(null);

  useEffect(() => {
    if (!audioBuffer) return;

    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    playerRef.current = new PlaybackController(audioBuffer, audioContext);

    playerRef.current.on('play', () => setIsPlaying(true));
    playerRef.current.on('pause', () => setIsPlaying(false));
    playerRef.current.on('timeupdate', (time: number) => setCurrentTime(time));

    return () => {
      playerRef.current?.stop();
    };
  }, [audioBuffer]);

  return {
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    setCurrentTime: (time: number) => playerRef.current?.setCurrentTime(time),
    setVolume: (vol: number) => {
      playerRef.current?.setVolume(vol);
      setVolume(vol);
    },
    isPlaying,
    currentTime,
    duration: audioBuffer?.duration || 0,
    volume,
  };
}
```

