import { test, expect } from '@playwright/test';

test.describe('Smart Playlist Enhancements', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/library');
        
        // Seed database with mock songs
        await page.evaluate(async () => {
            const dbName = 'AudioKaraokeDB';
            const request = indexedDB.open(dbName);
            
            await new Promise((resolve, reject) => {
                request.onsuccess = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains('songs')) {
                         resolve(null); 
                         return;
                    }

                    const transaction = db.transaction(['songs'], 'readwrite');
                    const store = transaction.objectStore('songs');
                    
                    // Clear existing songs to have a clean slate
                    store.clear();

                    const songs = [
                        { title: 'Alpha', artist: 'Artist A', type: 'karaoke', createdAt: Date.now(), duration: 180, originalHash: 'hash1' },
                        { title: 'Beta', artist: 'Artist B', type: 'karaoke', createdAt: Date.now(), duration: 200, originalHash: 'hash2' },
                        { title: 'Gamma', artist: 'Artist C', type: 'karaoke', createdAt: Date.now(), duration: 220, originalHash: 'hash3' },
                    ];
                    for (const song of songs) {
                        store.add(song);
                    }
                    
                    transaction.oncomplete = () => resolve(null);
                    transaction.onerror = () => reject(transaction.error);
                };
                request.onerror = () => reject(request.error);
            });
        });

        await page.reload(); 
        await page.waitForTimeout(1000); 
    });

    test('should edit a smart playlist and use negative operators', async ({ page }) => {
        // 1. Open Playlist Manager
        if (await page.isVisible('text=Show Playlists')) {
            await page.click('text=Show Playlists');
        }

        // 2. Create Smart Playlist "Contains A"
        await page.click('button[title="Create Smart Playlist"]');
        await page.fill('input[placeholder="e.g., 80s Rock Anthems"]', 'Test Smart Playlist');
        await page.fill('input[placeholder="Value..."]', 'Alpha');
        await page.click('button:has-text("Create Playlist")');

        await expect(page.locator('text=Test Smart Playlist')).toBeVisible();
        await page.click('text=Test Smart Playlist');
        await page.waitForTimeout(500);
        
        // Should show 1 song (Alpha)
        await expect(page.locator('text=Alpha')).toBeVisible();

        // 3. Edit Smart Playlist to "Does not contain Alpha"
        await page.locator('button[aria-label="Edit smart playlist"]').click();
        
        // Verify Modal is in Edit mode
        await expect(page.locator('h2:has-text("Edit Smart Playlist")')).toBeVisible();
        await expect(page.locator('input[value="Test Smart Playlist"]')).toBeVisible();

        // Change name
        await page.fill('input[value="Test Smart Playlist"]', 'Edited Smart Playlist');

        // Change operator to "Does not contain"
        await page.selectOption('select:nth-child(2)', 'not_contains'); 
        
        await page.click('button:has-text("Save Changes")');

        // 4. Verify updates
        await expect(page.locator('text=Edited Smart Playlist')).toBeVisible();
        await page.click('text=Edited Smart Playlist');
        await page.waitForTimeout(500);

        // Alpha should NOT be there, Beta and Gamma should be
        await expect(page.locator('text=Alpha')).not.toBeVisible();
        await expect(page.locator('text=Beta')).toBeVisible();
        await expect(page.locator('text=Gamma')).toBeVisible();
    });

    test('should work with "Is not" operator', async ({ page }) => {
        if (await page.isVisible('text=Show Playlists')) {
            await page.click('text=Show Playlists');
        }

        await page.click('button[title="Create Smart Playlist"]');
        await page.fill('input[placeholder="e.g., 80s Rock Anthems"]', 'Not Beta');
        await page.selectOption('select:nth-child(2)', 'is_not'); 
        await page.fill('input[placeholder="Value..."]', 'Beta');
        await page.click('button:has-text("Create Playlist")');

        await page.click('text=Not Beta');
        await page.waitForTimeout(500);

        await expect(page.locator('text=Alpha')).toBeVisible();
        await expect(page.locator('text=Beta')).not.toBeVisible();
        await expect(page.locator('text=Gamma')).toBeVisible();
    });
});
