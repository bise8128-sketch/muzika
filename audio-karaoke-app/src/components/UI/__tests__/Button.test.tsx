import { render, screen } from '@testing-library/react';
import { Button } from '../Button';
import '@testing-library/jest-dom';

describe('Button', () => {
    it('renders with default props', () => {
        render(<Button>Click me</Button>);
        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('bg-primary'); // Default variant
    });

    it('applies variant classes correctly', () => {
        render(<Button variant="danger">Delete</Button>);
        const button = screen.getByRole('button', { name: /delete/i });
        expect(button).toHaveClass('bg-red-500');
    });

    it('renders loading state', () => {
        render(<Button isLoading>Submit</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
        // Check for spinner - by class because it's an SVG
        expect(screen.getByRole('button').querySelector('svg')).toHaveClass('animate-spin');
    });

    it('renders icons', () => {
        render(<Button leftIcon={<span data-testid="icon">Icon</span>}>With Icon</Button>);
        expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('handles disabled state', () => {
        render(<Button disabled>Disabled</Button>);
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
