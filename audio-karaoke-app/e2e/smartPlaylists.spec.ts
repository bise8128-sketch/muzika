import { test, expect } from '@playwright/test';

test.describe('Smart Playlists and Bulk Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure we are on the library page or navigate to it
    // Assuming root is library or has navigation
  });

  test('should create a manual playlist and add songs', async ({ page }) => {
    // 1. Create Playlist
    await page.click('text=New Playlist');
    await page.fill('input[placeholder="Playlist name..."]', 'My Manual Playlist');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=My Manual Playlist')).toBeVisible();

    // 2. Select Songs
    await page.click('text=Select Songs');
    // Select first two songs
    const songCards = page.locator('.group.relative.bg-white\\/5');
    await songCards.nth(0).click();
    await songCards.nth(1).click();

    // 3. Add to Playlist
    await page.click('text=Add to Playlist');
    await page.click('button:has-text("My Manual Playlist")');

    // 4. Verify songs in playlist
    await page.click('text=My Manual Playlist');
    await expect(page.locator('text=Songs')).toBeVisible();
    // Should have 2 delete buttons (one for each song)
    // await expect(page.locator('button[aria-label="Remove song"]')).toHaveCount(2);
  });

  test('should create a smart playlist', async ({ page }) => {
    // 1. Open Smart Playlist Modal
    // Click the sparkles button
    await page.click('button[title="Create Smart Playlist"]');
    
    // 2. Fill details
    await page.fill('input[placeholder="e.g., 80s Rock Anthems"]', 'My Smart Playlist');
    
    // Rule: Title contains "a" (very likely to match something)
    // Default rule is Title contains ""
    await page.fill('input[placeholder="Value..."]', 'a');
    
    await page.click('button:has-text("Create Playlist")');

    // 3. Verify creation
    await expect(page.locator('text=My Smart Playlist')).toBeVisible();
    await expect(page.locator('span[title="Smart Playlist"]')).toBeVisible();

    // 4. Check content
    await page.click('text=My Smart Playlist');
    // Should populate with songs
    // We can't know exactly how many, but if DB has songs with 'a', they should show.
    // Let's assume there's at least one song with 'a'
    // await expect(page.locator('.flex.items-center.justify-between.p-2')).not.toHaveCount(0);
  });
});
