
import { CDGParser, CDGInstruction } from '../utils/karaoke/cdgParser';
import { LRCData } from '../types/karaoke';

// State Interfaces
interface KaraokeState {
    isPlaying: boolean;
    currentTime: number; // Current playback time in seconds
    lastSyncTime: number; // Audio time at last sync
    lastSyncTimestamp: number; // performance.now() at last sync
    playbackRate: number;
    currentPacketIndex: number;
}

interface WorkerContext {
    lrcData: LRCData | null;
    cdgData: Uint8Array | null;
    cdgParser: CDGParser | null;
    canvas: OffscreenCanvas | null;
    ctx: OffscreenCanvasRenderingContext2D | null;
    visualSettings: any;
    
    // CDG State
    cdgState: {
        colorTable: Uint32Array;
        pixels: Uint8Array;
    };
    
    // Lyric State
    lyricState: {
        currentLineIndex: number;
        currentWordIndex: number;
    };
}

// Global State
let state: KaraokeState = {
    isPlaying: false,
    currentTime: 0,
    lastSyncTime: 0,
    lastSyncTimestamp: 0,
    playbackRate: 1.0,
    currentPacketIndex: 0
};

let context: WorkerContext = {
    lrcData: null,
    cdgData: null,
    cdgParser: null,
    canvas: null,
    ctx: null,
    visualSettings: {},
    cdgState: {
        colorTable: new Uint32Array(16),
        pixels: new Uint8Array(300 * 216)
    },
    lyricState: {
        currentLineIndex: -1,
        currentWordIndex: -1
    }
};

// CDG Constants
const CDG_WIDTH = 300;
const CDG_HEIGHT = 216;
const PACKETS_PER_SECOND = 300;

// Animation Loop
let animationFrameId: number | null = null;

const loop = () => {
    if (!state.isPlaying) return;

    // Calculate current time
    const now = performance.now();
    const elapsed = (now - state.lastSyncTimestamp) / 1000; // seconds
    state.currentTime = state.lastSyncTime + (elapsed * state.playbackRate);

    // 1. Process CDG
    if (context.cdgParser && context.ctx) {
        renderCDG(state.currentTime);
    }

    // 2. Process Lyrics
    if (context.lrcData) {
        processLyrics(state.currentTime);
    }

    // Schedule next frame
    if (self.requestAnimationFrame) {
        animationFrameId = self.requestAnimationFrame(loop);
    } else {
        animationFrameId = self.setTimeout(loop, 16) as any;
    }
};

const renderCDG = (time: number) => {
    if (!context.cdgParser || !context.ctx) return;

    const targetPacketIndex = Math.floor(time * PACKETS_PER_SECOND);

    // SEEKING BACKWARDS
    if (targetPacketIndex < state.currentPacketIndex) {
        // Reset state
        state.currentPacketIndex = 0;
        context.cdgState.pixels.fill(0);
        context.cdgState.colorTable.fill(0);
        // Reset parser (create new one to reset index)
        if (context.cdgData) {
            context.cdgParser = new CDGParser(context.cdgData);
        }
    }

    // PROCESS PACKETS (Forward or Catch-up)
    const packetsToProcess = targetPacketIndex - state.currentPacketIndex;
    
    if (packetsToProcess > 0) {
        // Limit catch-up to avoid freezing (e.g. if tab was backgrounded for long time)
        // If we are > 5 seconds behind, maybe just skip drawing? But CDG is stateful so we MUST process.
        // We will process all. Worker won't freeze UI.
        
        for (let i = 0; i < packetsToProcess; i++) {
            const packet = context.cdgParser.getNextPacket();
            if (!packet) break;
            
            processCDGPacket(packet);
            state.currentPacketIndex++;
        }
        
        // Draw to Canvas
        drawCDGToCanvas();
    }
};

const processCDGPacket = (packet: any) => {
    const { colorTable, pixels } = context.cdgState;

    switch (packet.instruction) {
        case CDGInstruction.LoadColorTableLow:
        case CDGInstruction.LoadColorTableHigh:
            const offset = packet.instruction === CDGInstruction.LoadColorTableHigh ? 8 : 0;
            for (let i = 0; i < 8; i++) {
                const color = (packet.data[i * 2] << 8) | packet.data[i * 2 + 1];
                // CDG uses 4-bit RGB (0-15), scale to 8-bit (0-255)
                const r = ((color >> 8) & 0x0F) * 17;
                const g = ((color >> 4) & 0x0F) * 17;
                const b = (color & 0x0F) * 17;
                // ABGR format for Uint32 Little Endian (Canvas ImageData)
                colorTable[offset + i] = (255 << 24) | (b << 16) | (g << 8) | r;
            }
            break;
            
        case CDGInstruction.MemoryPreset:
            const colorIndex = packet.data[0] & 0x0F;
            // Fill all pixels with color index
            pixels.fill(colorIndex);
            break;
            
        case CDGInstruction.BorderPreset:
             // TODO: Implement border
             // For now, ignore or simple fill
             // const borderColor = packet.data[0] & 0x0F;
             break;

        case CDGInstruction.TileBlockNormal:
            // Standard 6x12 pixel tile
            // Byte 0: color0 (background), color1 (foreground)
            // Byte 1: row (0-17)
            // Byte 2: col (0-49)
            // Bytes 4-15: 12 rows of 6 pixels (bits)
            {
                const color0 = packet.data[0] & 0x0F;
                const color1 = packet.data[1] & 0x0F;
                const row = packet.data[2] & 0x1F;
                const col = packet.data[3] & 0x3F;
                
                if (row >= 18 || col >= 50) break; // Out of bounds

                const startX = col * 6;
                const startY = row * 12;

                for (let y = 0; y < 12; y++) {
                    const byte = packet.data[4 + y];
                    for (let x = 0; x < 6; x++) {
                        // Check bit (5-x) because 0 is MSB usually in CDG docs but let's verify standard
                        // Standard CDG: bit 5 is leftmost pixel
                        const bit = (byte >> (5 - x)) & 0x01;
                        const color = bit ? color1 : color0;
                        
                        const px = startX + x;
                        const py = startY + y;
                        
                        if (px < CDG_WIDTH && py < CDG_HEIGHT) {
                            pixels[py * CDG_WIDTH + px] = color;
                        }
                    }
                }
            }
            break;
            
        // TODO: Implement other instructions (Scroll, XOR, etc)
    }
};

const drawCDGToCanvas = () => {
    if (!context.ctx) return;
    
    // Create ImageData (or reuse buffer)
    const imageData = context.ctx.createImageData(CDG_WIDTH, CDG_HEIGHT);
    const buf32 = new Uint32Array(imageData.data.buffer);
    const { pixels, colorTable } = context.cdgState;

    for (let i = 0; i < pixels.length; i++) {
        buf32[i] = colorTable[pixels[i]];
    }

    context.ctx.putImageData(imageData, 0, 0);
};

const processLyrics = (time: number) => {
    if (!context.lrcData) return;
    
    // Add offset from settings
    const effectiveTime = time + ((context.visualSettings.offset || 0) / 1000);

    // Find active line
    const lineIndex = context.lrcData.lines.findIndex((line: any, index: number) => {
        const nextLine = context.lrcData?.lines[index + 1];
        return effectiveTime >= line.startTime && (nextLine ? effectiveTime < nextLine.startTime : true);
    });

    if (lineIndex !== -1) {
        let wordIndex = -1;
        const activeLine = context.lrcData.lines[lineIndex];
        
        if (activeLine.words && activeLine.words.length > 0) {
            wordIndex = activeLine.words.findIndex((word: any, index: number) => {
                const nextWord = activeLine.words[index + 1];
                return effectiveTime >= word.startTime && (nextWord ? effectiveTime < nextWord.startTime : true);
            });
             if (wordIndex === -1 && effectiveTime > activeLine.words[activeLine.words.length - 1].startTime) {
                wordIndex = activeLine.words.length - 1;
            }
        }

        // Check if changed
        if (lineIndex !== context.lyricState.currentLineIndex || wordIndex !== context.lyricState.currentWordIndex) {
            context.lyricState.currentLineIndex = lineIndex;
            context.lyricState.currentWordIndex = wordIndex;
            
            self.postMessage({
                type: 'LYRIC_UPDATE',
                payload: {
                    lineIndex,
                    wordIndex
                }
            });
        }
    }
};

// Message Handler
self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'INIT_ENGINE':
            if (payload.lrcData) context.lrcData = payload.lrcData;
            if (payload.cdgData) {
                context.cdgData = payload.cdgData;
                context.cdgParser = new CDGParser(payload.cdgData);
                // Reset state
                state.currentPacketIndex = 0;
                context.cdgState.pixels.fill(0);
                context.cdgState.colorTable.fill(0);
            }
            if (payload.canvas) {
                context.canvas = payload.canvas;
                context.ctx = context.canvas!.getContext('2d', {
                    alpha: false, // Optimization: opaque canvas
                    desynchronized: true // Optimization: low latency
                }) as any;
            }
            if (payload.visualSettings) context.visualSettings = payload.visualSettings;
            break;

        case 'PLAY':
            state.isPlaying = true;
            if (payload && typeof payload.startTime === 'number') {
                state.lastSyncTime = payload.startTime;
                state.lastSyncTimestamp = performance.now();
                state.currentTime = payload.startTime;
                // Force sync check
                renderCDG(state.currentTime);
            } else {
                 // Resume
                 state.lastSyncTimestamp = performance.now();
            }
            loop();
            break;

        case 'PAUSE':
            state.isPlaying = false;
            if (animationFrameId) {
                if (self.cancelAnimationFrame) self.cancelAnimationFrame(animationFrameId as any);
                else clearTimeout(animationFrameId as any);
                animationFrameId = null;
            }
            break;

        case 'SYNC_TIME':
            // Sync without stopping
            state.lastSyncTime = payload.currentTime;
            state.lastSyncTimestamp = performance.now();
            state.currentTime = payload.currentTime;
            break;
            
        case 'UPDATE_SETTINGS':
            if (payload.visualSettings) context.visualSettings = payload.visualSettings;
            break;
    }
};
