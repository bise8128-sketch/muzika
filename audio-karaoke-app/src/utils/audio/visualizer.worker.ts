/**
 * Visualizer Worker
 * Handles Canvas rendering off the main thread
 */

// Define the type for the worker context
// This is a dedicated worker, so we use DedicatedWorkerGlobalScope
// However, TypeScript might not have it available in all contexts, so we use a loose type or specific interface if needed.
// For now, we assume standard Worker context.

interface VisualizerConfig {
    mode: 'bars' | 'waveform' | '3d-landscape' | 'spectrogram' | 'fluid';
    quality: 'high' | 'low';
    theme: any; // Using any for now to avoid dragging in complex types, or we can duplicate essential theme props
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
    windowArray[i] = a0 - a1 * Math.cos((2 * Math.PI * i) / (fftSize - 1)) + a2 * Math.cos((4 * Math.PI * i) / (fftSize - 1));
}

let config: VisualizerConfig = {
    mode: 'bars',
    quality: 'high',
    theme: {}
};

// Handle messages from main thread
self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            if (payload.canvas) {
                canvas = payload.canvas;
                ctx = canvas!.getContext('2d') as OffscreenCanvasRenderingContext2D;
            }
            break;

        case 'connect_audio':
            frequencyPort = payload.port;
            setupAudioPort();
            break;

        case 'start':
            isRunning = true;
            renderLoop();
            break;

        case 'stop':
            isRunning = false;
            if (animationId) cancelAnimationFrame(animationId);
            break;

        case 'config':
            config = { ...config, ...payload };
             // Adjust history length based on quality
            if (config.quality === 'low') {
                maxHistoryLength = 100;
            } else {
                maxHistoryLength = 200;
            }
            break;
            
        case 'resize':
             if (canvas) {
                 canvas.width = payload.width;
                 canvas.height = payload.height;
             }
             break;
    }
};

function setupAudioPort() {
    if (!frequencyPort) return;

    frequencyPort.onmessage = (e) => {
        // We now receive raw time_domain_data from the worklet
        if (e.data.type === 'time_domain_data') {
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
    const midEnd = Math.floor(binCount * 0.4);   // Mids

    for (let i = 0; i < binCount; i++) {
        const magnitude = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        
        // Convert to dB
        const db = 20 * Math.log10(magnitude + 1e-6);

        // Smooth
        const smoothedDb = smoothingTimeConstant * lastFrequencyData[i] + (1 - smoothingTimeConstant) * db;
        lastFrequencyData[i] = smoothedDb;

        // Map to 0-255
        let byteValue = 255 * (smoothedDb - minDecibels) / range;
        
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
        type: 'audio_metrics',
        payload: {
            bass: (bass / bassEnd) / 255,
            mid: (mid / (midEnd - bassEnd)) / 255,
            treble: (treble / (binCount - midEnd)) / 255,
            energy: (energy / binCount) / 255
        }
    });
}

// In-place FFT (Cooley-Tukey algorithm) mapped from worklet to worker
function fft(real: Float32Array, imag: Float32Array) {
    const n = real.length;
    
    // Bit Reversal Permutation
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
        if (i < j) {
            let temp = real[i]; real[i] = real[j]; real[j] = temp;
            temp = imag[i]; imag[i] = imag[j]; imag[j] = temp;
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
    ctx.fillStyle = 'rgba(20, 20, 20, 1)'; // Base background, might need theme
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    switch (config.mode) {
        case 'waveform':
            drawWaveform();
            break;
        case '3d-landscape':
            draw3DLandscape();
            break;
        case 'spectrogram':
            drawSpectrogram();
            break;
        case 'fluid':
            drawFluid();
            break;
        case 'bars':
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
    
    const barWidth = (canvas.width / frequencyData.length) * 2.5;
    let barHeight: number;
    let x = 0;

    for (let i = 0; i < frequencyData.length; i++) {
        barHeight = (frequencyData[i] / 255) * canvas.height;

        // Simple gradient for now
        // Can make this more complex or pass theme colors
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        const hue = (i / frequencyData.length) * 60 + 260; // Purple to Blue
        gradient.addColorStop(0, `hsla(${hue}, 100%, 60%, 1)`);
        gradient.addColorStop(1, `hsla(${hue}, 100%, 40%, 0.5)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
    }
}

function drawWaveform() {
   // For waveform, we usually need TimeDomain data.
   // The frequencyProcessor currently only sends frequency data.
   // If we want waveform, we need to update the processor to send time domain data too or separate message.
   // For now, let's skip waveform or implement a "fake" one from frequency if needed, 
   // BUT the plan assumes we might not have it yet.
   // Actually, let's just leave it empty or draw a flat line until we update the processor.
   // OR, we can implement it if the processor sends it.
   // Let's stick to what we have: Frequency data.
    if (!ctx || !canvas) return;
    
   // Placeholder text
   ctx.fillStyle = '#666';
   ctx.fillText("Waveform requires TimeDomain data", 10, 20);
}

function draw3DLandscape() {
    if (!ctx || !canvas) return;

    updateHistory();

    const rows = historyBuffer.length;
    // Downsample for performance
    const cols = frequencyData.length / (config.quality === 'low' ? 8 : 4);
    const rowStep = canvas.height / (config.quality === 'low' ? 40 : 60);
    const colStep = canvas.width / cols;

    ctx.lineWidth = 1;

    for (let i = rows - 1; i >= 0; i--) {
        const data = historyBuffer[i];
        const z = i * rowStep;
        const opacity = 1 - (i / rows);
        
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${280 + i}, 100%, 50%, ${opacity * 0.5})`;
        
        for (let j = 0; j < cols; j++) {
            const idx = config.quality === 'low' ? j << 3 : j << 2;
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
    const yIncr = config.quality === 'low' ? 8 : 4;

    for (let i = 0; i < rows; i++) {
        const data = historyBuffer[i];
        const x = canvas.width - (i * stepX);
        
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
    const particleCount = config.quality === 'low' ? 50 : 100;
    particles = [];
    if (!canvas) return;

    for(let i=0; i<particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: 0,
            vy: 0,
            size: Math.random() * 3 + 1,
            color: `hsla(${Math.random() * 60 + 200}, 100%, 50%, 0.5)`
        });
    }
}

function updateAndDrawParticles() {
    if (!ctx || !canvas || !particles) return;
    
    // Fade out
    ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let energy = 0;
    for(let i=0; i<frequencyData.length; i++) {
        energy += frequencyData[i];
    }
    energy = energy / frequencyData.length;
    const speedMultiplier = 1 + (energy / 255) * 5;

    particles.forEach((p: Particle, i: number) => {
        // Map frequency bin to particle
        const freqIndex = Math.floor((i / particles!.length) * (frequencyData.length / 2));
        const freqValue = frequencyData[freqIndex] || 0;
        
        const angle = (freqIndex / frequencyData.length) * Math.PI * 4 + performance.now() * 0.001;
        const force = (freqValue / 255) * speedMultiplier;
        
        p.vx += Math.cos(angle) * force * 0.5;
        p.vy += Math.sin(angle) * force * 0.5;
        
        p.vx *= 0.95;
        p.vy *= 0.95;
        
        p.x += p.vx;
        p.y += p.vy;

        if(p.x < 0) p.x = canvas!.width;
        if(p.x > canvas!.width) p.x = 0;
        if(p.y < 0) p.y = canvas!.height;
        if(p.y > canvas!.height) p.y = 0;

        const size = p.size * (1 + (freqValue / 255));
        const hue = 200 + (freqValue / 255) * 100;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx!.fillStyle = `hsla(${hue}, 100%, 60%, ${0.5 + (freqValue/255)*0.5})`;
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
