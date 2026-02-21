'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Send, CheckCircle2, User, Loader2 } from 'lucide-react';
import { PerformanceScore } from '@/types/audio';

interface ScoreSubmitFormProps {
    songId: string;
    performanceScore: PerformanceScore;
    onSuccess?: () => void;
}

/**
 * ScoreSubmitForm
 * A premium component to prompt for username and submit high scores to the global leaderboard.
 */
export const ScoreSubmitForm: React.FC<ScoreSubmitFormProps> = ({ 
    songId, 
    performanceScore,
    onSuccess 
}) => {
    const [username, setUsername] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || username.length < 2) return;

        setStatus('submitting');
        setError(null);

        try {
            const response = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songId,
                    username: username.trim(),
                    score: performanceScore.overallScore,
                    maxCombo: performanceScore.longestStreak,
                    perfectionRate: (performanceScore.history.filter(h => h.accuracy >= 90).length / performanceScore.history.length) * 100,
                    harmonyBonus: 0, // Potential future feature
                    pitchAdjustment: 0, // Placeholder
                    tempoMultiplier: 1.0, // Placeholder
                }),
            });

            if (response.ok) {
                setStatus('success');
                onSuccess?.();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to submit score');
            }
        } catch (err: any) {
            console.error('[ScoreSubmitForm] Submission failed:', err);
            setStatus('error');
            setError(err.message || 'Something went wrong');
        }
    };

    return (
        <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.05] pointer-events-none">
                <Trophy className="w-32 h-32 text-white" />
            </div>

            <div className="relative z-10">
                <h3 className="text-2xl font-black text-white mb-2 flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    Global Leaderboard
                </h3>
                <p className="text-white/40 text-sm mb-8 max-w-md">
                    You've achieved a high score! Enter your stage name to immortalize your performance in the hall of fame.
                </p>

                <AnimatePresence mode="wait">
                    {status === 'success' ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center py-6 text-center"
                        >
                            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h4 className="text-xl font-bold text-white mb-1">Score Submitted!</h4>
                            <p className="text-white/40 text-sm">You are now ranked in the global leaderboard.</p>
                        </motion.div>
                    ) : (
                        <motion.form 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            <div className="relative group">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-purple-400 transition-colors" />
                                <input 
                                    type="text"
                                    placeholder="Enter Stage Name..."
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={status === 'submitting'}
                                    autoFocus
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-6 text-white font-bold placeholder:text-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all uppercase tracking-widest"
                                />
                            </div>

                            {error && (
                                <p className="text-rose-400 text-xs font-bold pl-2">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={status === 'submitting' || username.length < 2}
                                className="w-full py-5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-white/5 disabled:to-white/5 disabled:text-white/20 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-purple-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4"
                            >
                                {status === 'submitting' ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        Submit Performance
                                    </>
                                )}
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
