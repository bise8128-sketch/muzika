import React from 'react';
import { render, screen } from '@testing-library/react';
import { LyricDisplay } from '../LyricDisplay';
import { LRCData } from '@/types/karaoke';

// Mock next-intl
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        if (key === 'waitingForLyrics') return 'Awaiting Data Signal...';
        return key;
    },
}));

// Mock useAudioReactivity
jest.mock('@/hooks/useAudioReactivity', () => ({
    useAudioReactivity: () => ({ bass: { get: () => 0 }, energy: { get: () => 0 }, treble: { get: () => 0 } }),
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
    motion: {
        div: React.forwardRef(({ children, ...props }: any, ref) => <div {...props} ref={ref}>{children}</div>),
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
        p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useTransform: () => ({ get: () => 0 }),
    useSpring: () => ({ get: () => 0 }),
}));

// Mock scrollIntoView and scrollTo as they're not supported in JSDOM
window.HTMLElement.prototype.scrollIntoView = jest.fn();
window.HTMLElement.prototype.scrollTo = jest.fn();

describe('LyricDisplay', () => {
    const mockLyrics: LRCData = {
        ti: 'Test Song',
        ar: 'Test Artist',
        al: 'Test Album',
        length: '03:00',
        lines: [
            { 
                text: 'First line of lyrics', 
                startTime: 0, 
                endTime: 5, 
                words: [{ text: 'First', startTime: 0, endTime: 1 }, { text: 'line', startTime: 1, endTime: 2 }] 
            },
            { text: 'Second line here', startTime: 5, endTime: 10, words: [] },
        ],
    };

    it('renders waiting message when lyrics are null', () => {
        render(<LyricDisplay lyrics={null} currentLineIndex={-1} currentWordIndex={-1} />);
        expect(screen.getByText('Awaiting Data Signal...')).toBeInTheDocument();
    });

    it('renders lyrics lines correctly', () => {
        render(<LyricDisplay lyrics={mockLyrics} currentLineIndex={0} currentWordIndex={-1} />);
        
        // Active line with words
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('line')).toBeInTheDocument();
        
        // Non-active line
        expect(screen.getByText('Second line here')).toBeInTheDocument();
    });
});
