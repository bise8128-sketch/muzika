'use client';

import React, { useEffect, useRef } from 'react';

interface CDGRendererProps {
    onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export const CDGRenderer: React.FC<CDGRendererProps> = ({ onCanvasReady }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (canvasRef.current && !initializedRef.current && onCanvasReady) {
            initializedRef.current = true;
            onCanvasReady(canvasRef.current);
        }
    }, [onCanvasReady]);

    return (
        <div className="bg-black p-2 rounded-xl border border-white/20">
            <canvas
                ref={canvasRef}
                width={300}
                height={216}
                className="w-full aspect-[300/216] image-pixelated"
            />
            <p className="text-[10px] text-white/40 mt-1 text-center font-mono uppercase tracking-tighter">CD+G Classic Mode (Worker Accelerated)</p>
        </div>
    );
};
