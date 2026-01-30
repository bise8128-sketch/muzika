
import { test, expect } from '@playwright/test';

test('diagnostic: check interaction blockers', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => logs.push(`[ERROR] ${err.message}`));

    await page.goto('/');

    // 1. Log title and current state
    console.log('Page Title:', await page.title());

    // 2. Capture initial screenshot
    await page.screenshot({ path: 'diagnostic-initial.png' });

    // 3. Check for obvious overlays (e.g., onboarding, modals)
    const overlayCount = await page.locator('div[class*="overlay"], div[class*="backdrop"], div[class*="modal"]').count();
    console.log(`Found ${overlayCount} potential overlay elements.`);

    // 4. Trace a click on a known element (e.g., the last nav button)
    const settingsButton = page.locator('nav button').last();
    if (await settingsButton.isVisible()) {
        const box = await settingsButton.boundingBox();
        console.log('Settings button bounding box:', box);

        // Try clicking it and log if it times out
        try {
            await settingsButton.click({ timeout: 5000 });
            console.log('Settings button clicked successfully.');
        } catch (e) {
            console.log('Settings button click failed:', e.message);
            // Try clicking by coordinates as a fallback/diagnostic
            if (box) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                console.log('Attempted click by coordinates.');
            }
        }
    } else {
        console.log('Settings button not visible.');
    }

    // 5. Check if any element is "hitting" the click before the button
    const pointerEvents = await page.evaluate(() => {
        const results: any[] = [];
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.pointerEvents === 'none') {
                results.push({ tag: el.tagName, className: el.className });
            }
        });
        return results;
    });
    console.log('Elements with pointer-events: none:', pointerEvents.length);

    // 6. Capture final state
    await page.screenshot({ path: 'diagnostic-final.png' });

    console.log('--- CONSOLE LOGS ---');
    logs.forEach(l => console.log(l));
});
