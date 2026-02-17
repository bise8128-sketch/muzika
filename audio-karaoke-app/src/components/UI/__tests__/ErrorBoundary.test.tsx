import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// A component that always throws to test the boundary
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        throw new Error('Test error message');
    }
    return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
    // Suppress console.error for expected errors in these tests
    const originalError = console.error;
    beforeAll(() => {
        console.error = jest.fn();
    });
    afterAll(() => {
        console.error = originalError;
    });

    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('renders fallback UI when a child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Signal Interrupted')).toBeInTheDocument();
        expect(screen.getByText(/Muzika encountered an unexpected error/)).toBeInTheDocument();
        expect(screen.getByText('Try to Resume')).toBeInTheDocument();
    });

    it('resets error state when Try to Resume is clicked', () => {
        const { rerender } = render(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        // Verify error state
        expect(screen.getByText('Signal Interrupted')).toBeInTheDocument();

        // We need to make the component NOT throw after reset.
        fireEvent.click(screen.getByText('Try to Resume'));

        // After reset the boundary tries to render children again.
        expect(screen.getByText('Signal Interrupted')).toBeInTheDocument();
    });

    it('uses custom fallback when provided', () => {
        const customFallback = (error: Error, reset: () => void) => (
            <div>
                <span>Custom: {error.message}</span>
                <button onClick={reset}>Retry</button>
            </div>
        );

        render(
            <ErrorBoundary fallback={customFallback}>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Custom: Test error message')).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
    });
});
