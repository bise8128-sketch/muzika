/**
 * Visualizer Worker
 * Handles Canvas rendering off the main thread
 */

// Define the type for the worker context
// This is a dedicated worker, so we use DedicatedWorkerGlobalScope
// However, TypeScript might not have it available in all contexts, so we use a loose type or specific interface if needed.
// For now, we assume standard Worker context.

interface VisualizerConfig {
  mode:
    | "bars"
    | "waveform"
    | "3d-landscape"
    | "spectrogram"
    | "fluid"
    | "singstar";
  quality: "high" | "low";
  theme: any; 
  vocalEnergy: number;
  voicePreset: string;
}

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let frequencyPort: MessagePort | null = null;

let isRunning = false;
let animationId: number | null = null;

// State needed for rendering
let frequencyData: Uint8Array = new Uint8Array(1024);
let timeDomainData: Float32Array = new Float32Array(2048);
const historyBuffer: Uint8Array[] = [];
let maxHistoryLength = 200;

// FFT State
const fftSize = 2048;
const smoothingTimeConstant = 0.8;
let lastFrequencyData = new Float32Array(fftSize / 2);
let windowArray = new Float32Array(fftSize);
let real = new Float32Array(fftSize);
let imag = new Float32Array(fftSize);

// Pre-compute Blackman window
for (let i = 0; i < fftSize; i++) {
  const alpha = 0.16;
  const a0 = (1 - alpha) / 2;
  const a1 = 0.5;
  const a2 = alpha / 2;
  windowArray[i] =
    a0 -
    a1 * Math.cos((2 * Math.PI * i) / (fftSize - 1)) +
    a2 * Math.cos((4 * Math.PI * i) / (fftSize - 1));
}

// SingStar specific state
let latestPitchHistory: any[] = [];
let latestPitchTargets: any[] = [];
let referencePitchMap: { timestamp: number; pitch: number; midi: number }[] = [];
const VISIBLE_HISTORY = 100;
const MIDI_RANGE = 36;
const MIDI_MIN = 36;

let config: VisualizerConfig = {
  mode: "bars",
  quality: "high",
  theme: {},
  vocalEnergy: 0,
  voicePreset: "original",
};

/**
 * Get reactive colors based on voice preset
 */
function getAccentColors(): { primary: string; secondary: string; hue: number } {
  const { voicePreset } = config;

  switch (voicePreset) {
    case 'robot':
      return { primary: 'hsla(190, 100%, 60%, 1)', secondary: 'hsla(210, 100%, 40%, 1)', hue: 190 };
    case 'deep':
      return { primary: 'hsla(340, 100%, 50%, 1)', secondary: 'hsla(280, 100%, 30%, 1)', hue: 340 };
    case 'high':
      return { primary: 'hsla(300, 100%, 70%, 1)', secondary: 'hsla(260, 100%, 50%, 1)', hue: 300 };
    case 'chipmunk':
      return { primary: 'hsla(45, 100%, 60%, 1)', secondary: 'hsla(20, 100%, 50%, 1)', hue: 45 };
    case 'harmony':
      return { primary: 'hsla(50, 100%, 55%, 1)', secondary: 'hsla(35, 100%, 45%, 1)', hue: 50 };
    default:
      return { primary: 'hsla(280, 100%, 60%, 1)', secondary: 'hsla(260, 100%, 40%, 1)', hue: 280 };
  }
}

// Handle messages from main thread
self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  switch (type) {
    case "init":
      if (payload.canvas) {
        canvas = payload.canvas;
        ctx = canvas!.getContext("2d") as OffscreenCanvasRenderingContext2D;
      }
      break;

    case "connect_audio":
      frequencyPort = payload.port;
      setupAudioPort();
      break;

    case "start":
      isRunning = true;
      renderLoop();
      break;

    case "stop":
      isRunning = false;
      if (animationId) cancelAnimationFrame(animationId);
      break;

    case "config":
      config = { ...config, ...payload };
      // Adjust history length based on quality
      if (config.quality === "low") {
        maxHistoryLength = 100;
      } else {
        maxHistoryLength = 200;
      }
      break;

    case "resize":
      if (canvas) {
        canvas.width = payload.width;
        canvas.height = payload.height;
      }
      break;

    case "pitch_history":
      latestPitchHistory = payload;
      break;

    case "pitch_targets":
      latestPitchTargets = payload;
      break;

    case "reference_pitch_map":
      referencePitchMap = payload;
      break;
  }
};

function setupAudioPort() {
  if (!frequencyPort) return;

  frequencyPort.onmessage = (e) => {
    // We now receive raw time_domain_data from the worklet
    if (e.data.type === "time_domain_data") {
      const newData = e.data.data;
      if (timeDomainData.length !== newData.length) {
        timeDomainData = new Float32Array(newData.length);
      }
      timeDomainData.set(newData);
      // Run FFT asynchronously off the main audio thread
      performFFT();
    }
  };
}

function performFFT() {
  // Apply Window & Prepare Complex Arrays
  for (let i = 0; i < fftSize; i++) {
    real[i] = timeDomainData[i] * windowArray[i];
    imag[i] = 0;
  }

  // Compute FFT
  fft(real, imag);

  // Compute Magnitude & Smooth
  const binCount = fftSize / 2;

  // AnalyserNode: minDecibels = -100, maxDecibels = -30
  const minDecibels = -100;
  const maxDecibels = -30;
  const range = maxDecibels - minDecibels;

  if (frequencyData.length !== binCount) {
    frequencyData = new Uint8Array(binCount);
  }

  let bass = 0;
  let mid = 0;
  let treble = 0;
  let energy = 0;

  const bassEnd = Math.floor(binCount * 0.05); // Low frequency
  const midEnd = Math.floor(binCount * 0.4); // Mids

  for (let i = 0; i < binCount; i++) {
    const magnitude = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);

    // Convert to dB
    const db = 20 * Math.log10(magnitude + 1e-6);

    // Smooth
    const smoothedDb =
      smoothingTimeConstant * lastFrequencyData[i] +
      (1 - smoothingTimeConstant) * db;
    lastFrequencyData[i] = smoothedDb;

    // Map to 0-255
    let byteValue = (255 * (smoothedDb - minDecibels)) / range;

    // Clamp
    if (byteValue < 0) byteValue = 0;
    if (byteValue > 255) byteValue = 255;

    frequencyData[i] = byteValue;

    // Metrics accumulations
    energy += byteValue;
    if (i < bassEnd) bass += byteValue;
    else if (i < midEnd) mid += byteValue;
    else treble += byteValue;
  }

  // Send computed metrics back to main thread for game logic
  postMessage({
    type: "audio_metrics",
    payload: {
      bass: bass / bassEnd / 255,
      mid: mid / (midEnd - bassEnd) / 255,
      treble: treble / (binCount - midEnd) / 255,
      energy: energy / binCount / 255,
    },
  });
}

// In-place FFT (Cooley-Tukey algorithm) mapped from worklet to worker
function fft(real: Float32Array, imag: Float32Array) {
  const n = real.length;

  // Bit Reversal Permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      let temp = real[i];
      real[i] = real[j];
      real[j] = temp;
      temp = imag[i];
      imag[i] = imag[j];
      imag[j] = temp;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Butterfly Operations
  let step = 1;
  while (step < n) {
    const jump = step << 1;
    const deltaAngle = -Math.PI / step;

    const alpha = 2.0 * Math.pow(Math.sin(deltaAngle * 0.5), 2);
    const beta = Math.sin(deltaAngle);

    let wr = 1.0;
    let wi = 0.0;

    for (let i = 0; i < step; i++) {
      for (let j = i; j < n; j += jump) {
        const k = j + step;

        const tr = wr * real[k] - wi * imag[k];
        const ti = wr * imag[k] + wi * real[k];

        real[k] = real[j] - tr;
        imag[k] = imag[j] - ti;
        real[j] += tr;
        imag[j] += ti;
      }

      const tempp = wr;
      wr = wr - (alpha * wr + beta * wi);
      wi = wi - (alpha * wi - beta * tempp);
    }
    step = jump;
  }
}

function renderLoop() {
  if (!isRunning || !ctx || !canvas) return;

  // Clear canvas
  ctx.fillStyle = "rgba(20, 20, 20, 1)"; // Base background, might need theme
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  switch (config.mode) {
    case "waveform":
      drawWaveform();
      break;
    case "3d-landscape":
      draw3DLandscape();
      break;
    case "spectrogram":
      drawSpectrogram();
      break;
    case "fluid":
      drawFluid();
      break;
    case "singstar":
      drawSingStar();
      break;
    case "bars":
    default:
      drawBars();
      break;
  }

  animationId = requestAnimationFrame(renderLoop);
}

// Drawing implementations adapted from AudioVisualizer.ts
// Note: We don't have access to HTMLCanvasElement, only OffscreenCanvas.
// Most 2D context methods are identical.

function drawBars() {
  if (!ctx || !canvas) return;

  const { primary, secondary, hue } = getAccentColors();
  const energyScale = 1 + config.vocalEnergy * 0.5;
  const barWidth = (canvas.width / frequencyData.length) * 2.5;
  let barHeight: number;
  let x = 0;

  for (let i = 0; i < frequencyData.length; i++) {
    barHeight = (frequencyData[i] / 255) * canvas.height * energyScale;

    const gradient = ctx.createLinearGradient(
      0,
      canvas.height - barHeight,
      0,
      canvas.height,
    );
    
    gradient.addColorStop(0, primary);
    gradient.addColorStop(1, secondary);

    ctx.fillStyle = gradient;
    ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

    x += barWidth + 1;
  }
}

function drawWaveform() {
  if (!ctx || !canvas) return;

  const { primary } = getAccentColors();
  const energyScale = 1 + config.vocalEnergy * 0.8;

  ctx.fillStyle = "rgba(10, 10, 15, 0.4)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 3 * energyScale;
  ctx.strokeStyle = primary;
  ctx.shadowBlur = 10 * energyScale;
  ctx.shadowColor = primary;
  ctx.beginPath();

  const sliceWidth = canvas.width / timeDomainData.length;
  let x = 0;

  for (let i = 0; i < timeDomainData.length; i++) {
    const v = timeDomainData[i] * 0.5 * energyScale + 0.5;
    const y = v * canvas.height;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.stroke();
  ctx.shadowBlur = 0;
}

function draw3DLandscape() {
  if (!ctx || !canvas) return;

  updateHistory();

  const rows = historyBuffer.length;
  // Downsample for performance
  const cols = frequencyData.length / (config.quality === "low" ? 8 : 4);
  const rowStep = canvas.height / (config.quality === "low" ? 40 : 60);
  const colStep = canvas.width / cols;

  ctx.lineWidth = 1;

  for (let i = rows - 1; i >= 0; i--) {
    const data = historyBuffer[i];
    const z = i * rowStep;
    const opacity = 1 - i / rows;

    ctx.beginPath();
    ctx.strokeStyle = `hsla(${280 + i}, 100%, 50%, ${opacity * 0.5})`;

    for (let j = 0; j < cols; j++) {
      const idx = config.quality === "low" ? j << 3 : j << 2;
      // Guard against out of bounds if data size changed
      if (idx >= data.length) break;

      const val = data[idx];
      const h = (val / 255) * 100 * (1 - i / rows);
      const x = j * colStep;
      const y = canvas.height - z - h - 50;

      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawSpectrogram() {
  if (!ctx || !canvas) return;

  updateHistory();

  const rows = historyBuffer.length;
  const stepX = canvas.width / rows;
  const yIncr = config.quality === "low" ? 8 : 4;

  for (let i = 0; i < rows; i++) {
    const data = historyBuffer[i];
    const x = canvas.width - i * stepX;

    for (let j = 0; j < canvas.height; j += yIncr) {
      const freqIdx = Math.floor((j / canvas.height) * (data.length / 2));
      if (freqIdx >= data.length) continue;

      const val = data[freqIdx];
      ctx.fillStyle = `hsla(${240 - (val / 255) * 240}, 100%, 50%, 1)`;
      ctx.fillRect(x, canvas.height - j, stepX, yIncr);
    }
  }
}

function drawFluid() {
  if (!ctx || !canvas) return;

  // Simplistic fluid implementation for now
  // The original maintained particle state.
  // We need to maintain particle state here too.
  if (!particles) {
    initParticles();
  }

  updateAndDrawParticles();
}

// Particle state for fluid
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
}

let particles: Particle[] | null = null;

function initParticles() {
  const particleCount = config.quality === "low" ? 50 : 100;
  particles = [];
  if (!canvas) return;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: 0,
      vy: 0,
      size: Math.random() * 3 + 1,
      color: `hsla(${Math.random() * 60 + 200}, 100%, 50%, 0.5)`,
    });
  }
}

function updateAndDrawParticles() {
  if (!ctx || !canvas || !particles) return;

  const { hue: accentHue } = getAccentColors();
  const energyScale = 1 + config.vocalEnergy * 2;

  // Fade out
  ctx.fillStyle = "rgba(10, 10, 15, 0.2)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let energy = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    energy += frequencyData[i];
  }
  energy = energy / frequencyData.length;
  const speedMultiplier = (1 + (energy / 255) * 5) * energyScale;

  particles.forEach((p: Particle, i: number) => {
    const freqIndex = Math.floor(
      (i / particles!.length) * (frequencyData.length / 2),
    );
    const freqValue = frequencyData[freqIndex] || 0;

    const angle =
      (freqIndex / frequencyData.length) * Math.PI * 4 +
      performance.now() * 0.001;
    const force = (freqValue / 255) * speedMultiplier;

    p.vx += Math.cos(angle) * force * 0.5;
    p.vy += Math.sin(angle) * force * 0.5;

    p.vx *= 0.95;
    p.vy *= 0.95;

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0) p.x = canvas!.width;
    if (p.x > canvas!.width) p.x = 0;
    if (p.y < 0) p.y = canvas!.height;
    if (p.y > canvas!.height) p.y = 0;

    const size = p.size * (1 + freqValue / 255) * (energyScale * 0.5);
    const hue = accentHue + (freqValue / 255) * 40;

    ctx!.beginPath();
    ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx!.fillStyle = `hsla(${hue}, 100%, 60%, ${0.5 + (freqValue / 255) * 0.5})`;
    ctx!.fill();
  });
}

function updateHistory() {
  // Clone current data for history
  const snapshot = new Uint8Array(frequencyData);
  historyBuffer.unshift(snapshot);
  if (historyBuffer.length > maxHistoryLength) {
    historyBuffer.pop();
  }
}

function drawSingStar() {
  const context = ctx;
  if (!context || !canvas) return;

  const w = canvas.width;
  const h = canvas.height;

  // Smooth background with slight opacity for trailing effect (glassmorphism/glow base)
  context.fillStyle = "rgba(10, 10, 15, 0.4)";
  context.fillRect(0, 0, w, h);

  if (!latestPitchHistory || latestPitchHistory.length < 2) return;

  // Time-based rendering for rhythm game feel
  const now = latestPitchHistory[latestPitchHistory.length - 1].timestamp;
  // Position "NOW" line at 30% from the left to show more future
  const currentX = w * 0.3;
  // Zoom level: 4 seconds visible across the screen
  const pixelsPerSecond = w * 0.25;

  // Constrain visualizer to top 40% of screen to leave room for lyrics below
  const trackTop = h * 0.05;
  const trackBottom = h * 0.45;
  const trackHeight = trackBottom - trackTop;

  const timeToX = (t: number) => currentX + (t - now) * pixelsPerSecond;
  const midiToY = (m: number) => trackBottom - ((m - MIDI_MIN) / MIDI_RANGE) * trackHeight;

  // Draw Highway Background Lane
  context.fillStyle = "rgba(0, 0, 0, 0.3)";
  context.fillRect(0, trackTop, w, trackHeight);
  context.strokeStyle = "rgba(255, 255, 255, 0.1)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, trackTop);
  context.lineTo(w, trackTop);
  context.moveTo(0, trackBottom);
  context.lineTo(w, trackBottom);
  context.stroke();

  // Grid lines (Horizontal Octaves)
  context.strokeStyle = "rgba(255,255,255,0.05)";
  context.lineWidth = 1;
  for (let midi = MIDI_MIN; midi <= MIDI_MIN + MIDI_RANGE; midi += 12) {
    const y = midiToY(midi);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(w, y);
    context.stroke();
  }

  // --- 1. Draw Reference Highway (The "Snake") ---
  if (referencePitchMap && referencePitchMap.length > 0) {
    // Determine visible window
    const startTime = now - 1.5; // Look back 1.5s
    const endTime = now + 4.5;   // Look ahead 4.5s (more future)
    
    // Binary search/Index approximation for performance (assuming sorted timestamps)
    // For now, simple filter since map size isn't massive (a few thousand points)
    // Optimization: find start index
    let startIndex = 0;
    // Find roughly where to start (optimization for long arrays)
    if (referencePitchMap.length > 1000) {
        const estIndex = Math.floor((startTime / (referencePitchMap[referencePitchMap.length-1].timestamp)) * referencePitchMap.length);
        startIndex = Math.max(0, Math.min(estIndex - 500, referencePitchMap.length - 1));
    }

    context.lineCap = "round";
    context.lineJoin = "round";

    // Draw the "Glow" (Outer path)
    context.shadowBlur = 20;
    context.shadowColor = "rgba(59, 130, 246, 0.5)"; // Blue glow
    context.strokeStyle = "rgba(59, 130, 246, 0.3)";
    context.lineWidth = 12; // Thick highway
    context.beginPath();

    let started = false;
    for (let i = startIndex; i < referencePitchMap.length; i++) {
        const p = referencePitchMap[i];
        if (p.timestamp > endTime) break;
        if (p.timestamp < startTime) continue;
        
        // Skip silence/invalid pitch
        if (p.midi <= 0) {
            started = false;
            continue;
        }

        const x = timeToX(p.timestamp);
        const y = midiToY(p.midi);

        if (!started) {
            context.moveTo(x, y);
            started = true;
        } else {
            context.lineTo(x, y);
        }
    }
    context.stroke();

    // Draw the "Core" (Inner path)
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(96, 165, 250, 0.8)"; // Brighter blue
    context.lineWidth = 4;
    context.beginPath();

    started = false;
    for (let i = startIndex; i < referencePitchMap.length; i++) {
        const p = referencePitchMap[i];
        if (p.timestamp > endTime) break;
        if (p.timestamp < startTime) continue;
        
        if (p.midi <= 0) {
            started = false;
            continue;
        }

        const x = timeToX(p.timestamp);
        const y = midiToY(p.midi);

        if (!started) {
            context.moveTo(x, y);
            started = true;
        } else {
            context.lineTo(x, y);
        }
    }
    context.stroke();
  }

  // Draw user pitch trail with aesthetic gradient
  context.lineWidth = 5;
  context.lineCap = "round";
  context.lineJoin = "round";

  visibleData.forEach((d, i) => {
    if (i === 0 || d.detectedMidi <= 0) return;
    const prev = visibleData[i - 1];
    if (prev.detectedMidi <= 0) return;

    const x0 = timeToX(prev.timestamp);
    const y0 = midiToY(prev.detectedMidi);
    const x1 = timeToX(d.timestamp);
    const y1 = midiToY(d.detectedMidi);

    const acc = d.accuracy;
    const r = acc >= 70 ? 147 : acc >= 40 ? 251 : 239;
    const g = acc >= 70 ? 51 : acc >= 40 ? 191 : 68;
    const b = acc >= 70 ? 234 : acc >= 40 ? 36 : 68;

    // Premium glow effect
    context.shadowBlur = 15;
    context.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
    context.strokeStyle = `rgba(${r}, ${g}, ${b}, 1)`;

    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.stroke();
  });

  // Reset shadow
  context.shadowBlur = 0;
}
