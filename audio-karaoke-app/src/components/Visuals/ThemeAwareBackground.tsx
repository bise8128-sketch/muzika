'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';

export const ThemeAwareBackground: React.FC = () => {
    const { theme } = useTheme();

    return (
        <div className="fixed inset-0 -z-50 overflow-hidden pointer-events-none bg-background transition-colors duration-1000">
            {/* Base Mesh Gradient Layer */}
            <div className="absolute inset-0 mesh-gradient opacity-60" />

            {/* Animated Glow Orbs */}
            <motion.div
                animate={{
                    x: [0, 100, -100, 0],
                    y: [0, -50, 50, 0],
                    scale: [1, 1.2, 0.8, 1],
                }}
                transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute -top-1/4 -left-1/4 w-full h-full bg-primary/10 blur-[120px] rounded-full"
            />

            <motion.div
                animate={{
                    x: [0, -100, 100, 0],
                    y: [0, 50, -50, 0],
                    scale: [1, 0.8, 1.2, 1],
                }}
                transition={{
                    duration: 25,
                    repeat: Infinity,
                    ease: "linear"
                }}
                className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-accent/10 blur-[120px] rounded-full"
            />

            {/* Subtle Overlay Vignette */}
            <div className="absolute inset-0 bg-radial-[circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%]" />
        </div>
    );
};
