'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface Step {
    titleKey: string;
    contentKey: string;
    target?: string;
}

const STEPS: Step[] = [
    {
        titleKey: "step1Title",
        contentKey: "step1Content"
    },
    {
        titleKey: "step2Title",
        contentKey: "step2Content"
    },
    {
        titleKey: "step3Title",
        contentKey: "step3Content"
    },
    {
        titleKey: "step4Title",
        contentKey: "step4Content"
    }
];

interface OnboardingProps {
    forceShow?: boolean;
    onClose?: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ forceShow = false, onClose }) => {
    const t = useTranslations('Onboarding');
    const [isVisible, setIsVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if (forceShow) {
            setIsVisible(true);
            return;
        }

        const completed = localStorage.getItem('muzika_onboarding_completed');
        if (!completed) {
            setIsVisible(true);
        }
    }, [forceShow]);

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            complete();
        }
    };

    const complete = () => {
        setIsVisible(false);
        localStorage.setItem('muzika_onboarding_completed', 'true');
        if (onClose) onClose();
    };

    if (!isVisible) return null;

    const step = STEPS[currentStep];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={complete} />

            <div className="relative w-full max-w-lg glass-card p-10 rounded-[40px] border-primary/30 shadow-[0_0_100px_-20px_rgba(147,51,234,0.3)] animate-in zoom-in-95 duration-500">
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-primary rounded-3xl flex items-center justify-center shadow-2xl shadow-primary/40 rotate-12">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>

                <div className="text-center mt-8">
                    <div className="flex justify-center gap-1.5 mb-6">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1 rounded-full transition-all duration-500 ${i === currentStep ? 'w-8 bg-primary' : 'w-2 bg-white/10'}`}
                            />
                        ))}
                    </div>

                    <h3 className="text-3xl font-black tracking-tight mb-4">{t(step.titleKey as Parameters<typeof t>[0])}</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed mb-10">
                        {t(step.contentKey as Parameters<typeof t>[0])}
                    </p>

                    <div className="flex items-center justify-between gap-4">
                        <button
                            onClick={complete}
                            className="text-white/40 hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
                        >
                            {t('skip')}
                        </button>
                        <button
                            onClick={handleNext}
                            className="px-10 py-4 bg-primary text-white rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                        >
                            {currentStep === STEPS.length - 1 ? t('getStarted') : t('nextStep')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
