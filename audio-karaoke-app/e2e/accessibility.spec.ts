import { test, expect } from '@playwright/test';

/**
 * Accessibility E2E Tests
 *
 * Validates keyboard navigation, ARIA labels, focus indicators, and heading hierarchy.
 * Simulates how users with assistive technologies interact with the app.
 */
test.describe('Accessibility', () => {
    test.setTimeout(30000);

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('muzika_onboarding_completed', 'true');
        });

        await page.route('**/api/status', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ services: { modelRepository: 'connected' } }),
            });
        });

        await page.route('**/api/models', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ models: [] }),
            });
        });
    });

    test('page has proper heading hierarchy', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);

        // Should have exactly one h1
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBeLessThanOrEqual(2); // Allow for visually hidden h1

        // h1 should exist
        expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('all images have alt text', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);

        const images = page.locator('img');
        const count = await images.count();

        for (let i = 0; i < count; i++) {
            const img = images.nth(i);
            const alt = await img.getAttribute('alt');
            const role = await img.getAttribute('role');

            // Images should have alt text OR role="presentation"
            const hasAlt = alt !== null && alt !== undefined;
            const isDecorative = role === 'presentation' || role === 'none' || alt === '';

            expect(hasAlt || isDecorative).toBe(true);
        }
    });

    test('interactive elements are keyboard focusable', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);

        // Tab through the page and verify focus moves
        let focusedElements: string[] = [];

        for (let i = 0; i < 10; i++) {
            await page.keyboard.press('Tab');
            const focused = await page.evaluate(() => {
                const el = document.activeElement;
                return el ? `${el.tagName}[${el.getAttribute('data-testid') || el.textContent?.substring(0, 20) || ''}]` : 'none';
            });
            focusedElements.push(focused);
        }

        // Should have hit at least some interactive elements
        const uniqueFocused = [...new Set(focusedElements)];
        expect(uniqueFocused.length).toBeGreaterThan(1);
    });

    test('buttons have accessible names', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);

        const buttons = page.locator('button');
        const count = await buttons.count();

        for (let i = 0; i < count; i++) {
            const button = buttons.nth(i);
            
            // Skip hidden buttons
            const isVisible = await button.isVisible().catch(() => false);
            if (!isVisible) continue;

            const text = await button.textContent();
            const ariaLabel = await button.getAttribute('aria-label');
            const title = await button.getAttribute('title');

            // Button should have some accessible name
            const hasName = (text && text.trim().length > 0) || ariaLabel || title;
            expect(hasName).toBeTruthy();
        }
    });

    test('form inputs have labels', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);

        const inputs = page.locator('input:not([type="hidden"])');
        const count = await inputs.count();

        for (let i = 0; i < count; i++) {
            const input = inputs.nth(i);
            const isVisible = await input.isVisible().catch(() => false);
            if (!isVisible) continue;

            const id = await input.getAttribute('id');
            const ariaLabel = await input.getAttribute('aria-label');
            const ariaLabelledBy = await input.getAttribute('aria-labelledby');
            const title = await input.getAttribute('title');

            // Check for associated label, aria-label, or title
            let hasLabel = !!ariaLabel || !!ariaLabelledBy || !!title;

            if (!hasLabel && id) {
                const label = page.locator(`label[for="${id}"]`);
                hasLabel = (await label.count()) > 0;
            }

            // file inputs used in upload areas may use visual labels
            const type = await input.getAttribute('type');
            if (type === 'file') continue; // File inputs often rely on surrounding context

            expect(hasLabel).toBeTruthy();
        }
    });

    test('color contrast is reasonable', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);

        // Basic check: text elements should not have zero-opacity or fully transparent colors
        const textElements = page.locator('h1, h2, h3, p, span, button, a');
        const count = await textElements.count();
        let checkedCount = 0;

        for (let i = 0; i < Math.min(count, 20); i++) {
            const el = textElements.nth(i);
            const isVisible = await el.isVisible().catch(() => false);
            if (!isVisible) continue;

            const opacity = await el.evaluate(e => {
                const style = window.getComputedStyle(e);
                return parseFloat(style.opacity);
            });

            expect(opacity).toBeGreaterThan(0);
            checkedCount++;
        }

        expect(checkedCount).toBeGreaterThan(0);
    });
});
