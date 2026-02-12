'use client';

/**
 * PracticePanel — UI for Smart Practice Mode.
 *
 * Shows difficult sections, current-section progress, attempt counter,
 * tempo slider, and improvement graph.
 */

import React from 'react';
import type { DifficultSection } from '@/types/audio';

interface PracticePanelProps {
    isPracticing: boolean;
    isComplete: boolean;
    sections: DifficultSection[];
    currentIndex: number;
    attemptNumber: number;
    currentTempo: number;
    currentSection: DifficultSection | null;
    overallImprovement: number;
    onSkipSection: () => void;
    onStopPractice: () => void;
}

export function PracticePanel({
    isPracticing,
    isComplete,
    sections,
    currentIndex,
    attemptNumber,
    currentTempo,
    currentSection,
    overallImprovement,
    onSkipSection,
    onStopPractice,
}: PracticePanelProps) {
    if (sections.length === 0) {
        return (
            <div className="practice-panel practice-panel--empty">
                <p style={{ opacity: 0.7, textAlign: 'center', padding: '1.5rem' }}>
                    🎯 No difficult sections detected — great performance!
                </p>
            </div>
        );
    }

    if (isComplete) {
        return (
            <div className="practice-panel practice-panel--complete">
                <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏆</div>
                    <h4 style={{ margin: '0 0 0.5rem' }}>Practice Complete!</h4>
                    <p style={{ opacity: 0.8, margin: '0 0 0.25rem' }}>
                        {sections.length} section{sections.length !== 1 ? 's' : ''} practiced
                    </p>
                    {overallImprovement > 0 && (
                        <p style={{ color: '#4ade80', fontWeight: 600, margin: 0 }}>
                            +{overallImprovement}% improvement
                        </p>
                    )}
                </div>
                <button className="practice-panel__btn" onClick={onStopPractice}>
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="practice-panel">
            {/* Header */}
            <div className="practice-panel__header">
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>🎯 Practice Mode</h4>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    Section {currentIndex + 1} / {sections.length}
                </span>
            </div>

            {/* Current section info */}
            {currentSection && (
                <div className="practice-panel__current">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                            {currentSection.label}
                        </span>
                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                            Accuracy: {currentSection.averageAccuracy}%
                        </span>
                    </div>

                    {/* Attempt counter */}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Attempt</span>
                        <div style={{ display: 'flex', gap: '3px' }}>
                            {Array.from({ length: Math.min(attemptNumber, 10) }, (_, i) => (
                                <div
                                    key={i}
                                    style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        background: i < attemptNumber ? '#a78bfa' : 'rgba(255,255,255,0.2)',
                                    }}
                                />
                            ))}
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>#{attemptNumber}</span>
                    </div>

                    {/* Tempo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Tempo</span>
                        <div
                            style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                background: 'rgba(255,255,255,0.1)',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${currentTempo * 100}%`,
                                    height: '100%',
                                    borderRadius: 2,
                                    background: 'linear-gradient(90deg, #818cf8, #a78bfa)',
                                    transition: 'width 0.3s ease',
                                }}
                            />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, minWidth: '2.5rem', textAlign: 'right' }}>
                            {Math.round(currentTempo * 100)}%
                        </span>
                    </div>
                </div>
            )}

            {/* Section list */}
            <div className="practice-panel__sections">
                {sections.map((section, i) => (
                    <div
                        key={section.id}
                        className={`practice-panel__section ${i === currentIndex ? 'practice-panel__section--active' : ''} ${i < currentIndex ? 'practice-panel__section--done' : ''}`}
                    >
                        <span>{section.label}</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                            {section.averageAccuracy}%
                        </span>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="practice-panel__controls">
                <button className="practice-panel__btn practice-panel__btn--secondary" onClick={onSkipSection}>
                    Skip →
                </button>
                <button className="practice-panel__btn practice-panel__btn--danger" onClick={onStopPractice}>
                    Stop Practice
                </button>
            </div>

            <style>{`
                .practice-panel {
                    background: rgba(30, 27, 46, 0.95);
                    border: 1px solid rgba(167, 139, 250, 0.2);
                    border-radius: 12px;
                    padding: 1rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    backdrop-filter: blur(12px);
                    color: #e2e8f0;
                    font-size: 0.85rem;
                }
                .practice-panel--empty,
                .practice-panel--complete {
                    background: rgba(30, 27, 46, 0.95);
                    border: 1px solid rgba(167, 139, 250, 0.2);
                    border-radius: 12px;
                    color: #e2e8f0;
                    backdrop-filter: blur(12px);
                }
                .practice-panel__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .practice-panel__current {
                    background: rgba(167, 139, 250, 0.08);
                    border-radius: 8px;
                    padding: 0.75rem;
                }
                .practice-panel__sections {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    max-height: 120px;
                    overflow-y: auto;
                }
                .practice-panel__section {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.35rem 0.5rem;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    background: rgba(255,255,255,0.03);
                    transition: background 0.2s;
                }
                .practice-panel__section--active {
                    background: rgba(167, 139, 250, 0.15);
                    font-weight: 600;
                }
                .practice-panel__section--done {
                    opacity: 0.4;
                    text-decoration: line-through;
                }
                .practice-panel__controls {
                    display: flex;
                    gap: 0.5rem;
                }
                .practice-panel__btn {
                    flex: 1;
                    padding: 0.5rem;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s;
                    background: linear-gradient(135deg, #818cf8, #a78bfa);
                    color: #fff;
                }
                .practice-panel__btn:hover { opacity: 0.85; }
                .practice-panel__btn--secondary {
                    background: rgba(255,255,255,0.1);
                }
                .practice-panel__btn--danger {
                    background: rgba(239, 68, 68, 0.3);
                    color: #fca5a5;
                }
            `}</style>
        </div>
    );
}
