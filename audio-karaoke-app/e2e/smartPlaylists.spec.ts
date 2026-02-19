import { test, expect } from '@playwright/test';

test.describe('Smart Playlists and Bulk Actions', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the library page. Assuming default locale is 'en' or handled.
        // We go to /library because that's where LibraryGrid and PlaylistManager are.
        await page.goto('/library');
        // Wait for potential redirection or locale handling
        await page.waitForTimeout(1000); 
    });

    test('should create a manual playlist and add songs', async ({ page }) => {
        // 1. Open Playlist Manager
        // Check if "Show Playlists" button exists and click it if Playlists are hidden
        if (await page.isVisible('text=Show Playlists')) {
            await page.click('text=Show Playlists');
        }

        // 2. Create Playlist
        await page.click('text=New Playlist');
        await page.fill('input[placeholder="Playlist name..."]', 'My Manual Playlist');
        await page.click('button:has-text("Create")');
        // Wait for playlist to appear
        await expect(page.locator('text=My Manual Playlist')).toBeVisible();

        // 3. Select Songs (switch back to Library view or close playlist if overlaps)
        // The implementation shows PlaylistManager NEXT to LibraryGrid if showPlaylists is true,
        // but wait, the implementation HIDES LibraryGrid when showPlaylists is true!
        // line 105: <div className={`flex-1 transition-all duration-300 ${showPlaylists ? 'hidden' : 'block'}`}>
        
        // Use "Show Library" button to go back to library view
        await page.click('text=Show Library');

        // Select first two songs
        const deleteButtons = page.locator('button[aria-label="Delete song"]');
        const count = await deleteButtons.count();
        if (count < 2) test.skip('Not enough songs to test');

        // Toggle selection mode
        await page.click('text=Select Songs');
        
        // Select checkmarks (first two)
        const checkmarks = page.locator('.absolute.top-3.right-3');
        await checkmarks.nth(0).click();
        await checkmarks.nth(1).click();

        // 4. Add to Playlist
        await page.click('text=Add to Playlist');
        // Select "My Manual Playlist" in modal
        await page.click('button:has-text("My Manual Playlist")');

        // 5. Verify songs in playlist
        // Go back to playlists
        await page.click('text=Show Playlists');
        await page.click('text=My Manual Playlist');
        
        await expect(page.locator('text=Songs')).toBeVisible();
        // Should have 2 delete buttons (one for each song)
        // Note: these are 'Remove song from playlist' buttons, likely distinct from 'Delete song' buttons
        await expect(page.locator('button[aria-label="Remove song"]')).toHaveCount(2); 
    });

    test('should create a smart playlist', async ({ page }) => {
        // 1. Open Playlist Manager
        if (await page.isVisible('text=Show Playlists')) {
            await page.click('text=Show Playlists');
        }

        // 2. Open Smart Playlist Modal
        // Click the sparkles button
        await page.click('button[title="Create Smart Playlist"]');
        
        // 3. Fill details
        await page.fill('input[placeholder="e.g., 80s Rock Anthems"]', 'My Smart Playlist');
        
        // Rule: Title contains "a" (very likely to match something)
        // Default rule is Title contains ""
        await page.fill('input[placeholder="Value..."]', 'a');
        
        await page.click('button:has-text("Create Playlist")');

        // 4. Verify creation
        await expect(page.locator('text=My Smart Playlist')).toBeVisible();
        // Since we are looking at the list, verify it has the sparkles icon (or title)
        // We can't verify sparkles easily without specific selector, but existence is good.

        // 5. Check content
        await page.click('text=My Smart Playlist');
        // Should populate with songs
        // Wait for potential async loading
        await page.waitForTimeout(500);
        
        // Verify we see songs. How many? Unknown, but verify container is present.
        const songContainer = page.locator('text=Songs');
        await expect(songContainer).toBeVisible();
    });
});
