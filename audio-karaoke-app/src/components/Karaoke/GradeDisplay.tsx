'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PerformanceScore, PerformanceGrade } from '@/types/audio';
import { useTheme } from '@/context/ThemeContext';

const GRADE_COLORS: Record<PerformanceGrade, string> = {
    S: '#fbbf24', // amber
    A: '#34d399', // emerald
    B: '#60a5fa', // blue
    C: '#f97316', // orange
    D: '#ef4444', // red
};

interface GradeDisplayProps {
    score: PerformanceScore;
}

export const GradeDisplay: React.FC<GradeDisplayProps> = ({ score }) => {
    const color = GRADE_COLORS[score.grade];

    return (
        <div className="relative w-full max-w-2xl mx-auto py-12 px-6">
            {/* Ambient Background Glow */}
            <div 
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-64 blur-[120px] opacity-20 pointer-events-none"
                style={{ background: color }}
            />

            <div className="relative z-10 text-center space-y-12">
                {/* Grade Section */}
                <div className="space-y-2">
                    <motion.div 
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6 }}
                        className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40"
                    >
                        Performance Grade
                    </motion.div>
                    
                    <div className="relative inline-block">
                        <motion.div 
                            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            transition={{ 
                                type: 'spring', 
                                damping: 12, 
                                stiffness: 100,
                                delay: 0.2 
                            }}
                            className="text-[12rem] md:text-[16rem] font-black italic leading-none" 
                            style={{ 
                                color, 
                                textShadow: `0 0 60px ${color}60`,
                                WebkitTextStroke: '2px rgba(255,255,255,0.1)'
                            }}
                        >
                            {score.grade}
                        </motion.div>

                        {/* Particle Effects (Decorative) */}
                        {score.grade === 'S' && (
                            <motion.div 
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute inset-0 blur-3xl rounded-full"
                                style={{ background: color, zIndex: -1 }}
                            />
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <motion.div 
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                >
                    <StatCard 
                        label="Accuracy" 
                        value={`${score.overallAccuracy}%`} 
                        subValue={`${score.notesHit}/${score.totalNotes} notes`}
                    />
                    <StatCard 
                        label="Max Combo" 
                        value={score.longestStreak} 
                        subValue="accuracy streak"
                    />
                    <StatCard 
                        label="Harmony Bonus" 
                        value={`+${score.harmonyBonus}`} 
                        subValue={`${score.harmonyHits} harmony hits`}
                    />
                </motion.div>
            </div>
        </div>
    );
};

interface StatCardProps {
    label: string;
    value: string | number;
    subValue: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, subValue }) => (
    <div className="group relative bg-white/3 hover:bg-white/6 backdrop-blur-xl rounded-3xl p-6 border border-white/5 transition-all duration-500 overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative z-10 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-widest text-white/30">
                {label}
            </div>
            <div className="text-4xl font-black text-white tracking-tighter">
                {value}
            </div>
            <div className="text-[10px] font-medium text-white/20">
                {subValue}
            </div>
        </div>
    </div>
);
