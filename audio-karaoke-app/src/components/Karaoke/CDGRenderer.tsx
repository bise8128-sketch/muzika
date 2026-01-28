'use client';

import React, { useEffect, useRef } from 'react';
import { CDGParser, CDGInstruction } from '@/utils/karaoke/cdgParser';

interface CDGRendererProps {
    cdgData: Uint8Array | null;
    currentTime: number;
    width?: number;
    height?: number;
}

export const CDGRenderer: React.FC<CDGRendererProps> = ({ cdgData, currentTime }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef({
        colorTable: new Uint32Array(16),
        pixels: new Uint8Array(300 * 216), // CD+G resolution
        lastTime: 0
    });

    useEffect(() => {
        if (!cdgData || !canvasRef.current) return;

        const parser = new CDGParser(cdgData);
        const packets = parser.getPacketAtTime(currentTime);

        // Basic CD+G state machine
        const { colorTable, pixels } = stateRef.current;

        packets.forEach(packet => {
            switch (packet.instruction) {
                case CDGInstruction.LoadColorTableLow:
                case CDGInstruction.LoadColorTableHigh:
                    const offset = packet.instruction === CDGInstruction.LoadColorTableHigh ? 8 : 0;
                    for (let i = 0; i < 8; i++) {
                        const color = (packet.data[i * 2] << 8) | packet.data[i * 2 + 1];
                        const r = ((color >> 12) & 0x0F) * 17;
                        const g = ((color >> 8) & 0x0F) * 17;
                        const b = ((color >> 4) & 0x0F) * 17;
                        colorTable[offset + i] = (255 << 24) | (b << 16) | (g << 8) | r;
                    }
                    break;
                case CDGInstruction.MemoryPreset:
                    const colorIndex = packet.data[0] & 0x0F;
                    pixels.fill(colorIndex);
                    break;
                // Add more instructions (TileBlock etc) for full support
            }
        });

        // Draw to canvas
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const imageData = ctx.createImageData(300, 216);
        const buf32 = new Uint32Array(imageData.data.buffer);

        for (let i = 0; i < pixels.length; i++) {
            buf32[i] = colorTable[pixels[i]];
        }

        ctx.putImageData(imageData, 0, 0);
    }, [cdgData, currentTime]);

    if (!cdgData) return null;

    return (
        <div className="bg-black p-2 rounded-xl border border-white/20">
            <canvas
                ref={canvasRef}
                width={300}
                height={216}
                className="w-full aspect-[300/216] image-pixelated"
            />
            <p className="text-[10px] text-white/40 mt-1 text-center font-mono uppercase tracking-tighter">CD+G Classic Mode</p>
        </div>
    );
};
