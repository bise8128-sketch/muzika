
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Muzika/);
});

test('renders upload section initially', async ({ page }) => {
    await page.goto('/');
    // Use a more flexible search for heading
    await expect(page.getByText('Separate your music')).toBeVisible();
    await expect(page.getByText('Select Audio File')).toBeVisible();
});

test('can open settings panel', async ({ page }) => {
    await page.goto('/');
    // Click the settings button (the one with the gear icon)
    await page.locator('nav button').last().click();
    await expect(page.getByText('Settings')).toBeVisible();
    const engines = page.getByText('Processing Engine');
    // There might be multiple matches if the text appears in descriptions, so we check first visible
    await expect(engines.first()).toBeVisible();
    await expect(page.getByText('Model Version')).toBeVisible();
});
