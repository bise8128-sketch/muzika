
import React from 'react';
import { render, screen } from '@testing-library/react';
import { LyricDisplay } from '../LyricDisplay';
import { LRCData } from '@/types/karaoke';

// Mock scrollIntoView as it's not supported in JSDOM
window.HTMLElement.prototype.scrollIntoView = jest.fn();

describe('LyricDisplay', () => {
    const mockLyrics: LRCData = {
        metadata: {},
        lines: [
            { startTime: 1, endTime: 3, text: 'First line' },
            { startTime: 3, endTime: 5, text: 'Second line' },
            { startTime: 5, endTime: 7, text: 'Third line' },
        ],
    };

    it('renders "No lyrics available" when no lyrics are provided', () => {
        render(<LyricDisplay lyrics={null} currentTime={0} />);
        expect(screen.getByText('No lyrics loaded')).toBeInTheDocument();
    });

    it('renders all lyric lines', () => {
        render(<LyricDisplay lyrics={mockLyrics} currentTime={0} />);
        expect(screen.getByText('First line')).toBeInTheDocument();
        expect(screen.getByText('Second line')).toBeInTheDocument();
        expect(screen.getByText('Third line')).toBeInTheDocument();
    });

    it('highlights the current line', () => {
        const { container } = render(<LyricDisplay lyrics={mockLyrics} currentTime={4} />);

        // The second line (index 1) should be active
        const lines = container.querySelectorAll('.text-center');
        expect(lines[1]).toHaveClass('text-4xl', 'md:text-5xl', 'text-white');

        // The first line should be "past"
        expect(lines[0]).toHaveClass('text-2xl', 'text-white/40');

        // The third line should be "future"
        expect(lines[2]).toHaveClass('text-2xl', 'text-white/20');
    });

    it('calls scrollIntoView when current line changes', () => {
        const { rerender } = render(<LyricDisplay lyrics={mockLyrics} currentTime={0} />);

        rerender(<LyricDisplay lyrics={mockLyrics} currentTime={2} />);
        expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
    });
});
