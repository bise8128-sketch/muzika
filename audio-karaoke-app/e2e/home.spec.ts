
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');
    // Updated to match actual title: "DaorsKaraoke | Premium AI Karaoke Experience"
    await expect(page).toHaveTitle(/DaorsKaraoke/);
});

test('renders upload section initially', async ({ page }) => {
    await page.goto('/');
    // Use a more flexible search for heading
    await expect(page.getByText('Separate your music')).toBeVisible();
    // Updated to match actual text (plural "Files")
    await expect(page.getByText('Select Audio Files')).toBeVisible();
});

test('can open settings panel', async ({ page }) => {
    await page.goto('/');
    // Click the settings button using data-testid for reliability
    await page.getByTestId('settings-button').click();
    await expect(page.getByText('Settings')).toBeVisible();
    const engines = page.getByText('Processing Engine');
    // There might be multiple matches if the text appears in descriptions, so we check first visible
    await expect(engines.first()).toBeVisible();
    await expect(page.getByText('Model Version')).toBeVisible();
});
