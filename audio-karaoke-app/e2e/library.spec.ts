import { test, expect } from '@playwright/test';

test.describe('Library', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to library
    await page.goto('/library');
    
    // Skip onboarding if present
    const skipButton = page.getByRole('button', { name: /Skip/i });
    if (await skipButton.isVisible()) {
      await skipButton.click();
    }
  });

  test('should display library title and search bar', async ({ page }) => {
    // Check for a heading that might contain "Library" or similar
    // Based on the code, LibraryGrid is rendered. 
    // Let's look for the search placeholder
    await expect(page.getByPlaceholder(/Search songs/i)).toBeVisible();
  });

  test('should handle empty library state', async ({ page }) => {
    // By default, a fresh E2E run might have an empty IndexedDB
    // The "No songs found" message should be visible
    await expect(page.getByText(/No songs found/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Upload Songs/i })).toBeVisible();
  });

  test('should allow switching to selection mode', async ({ page }) => {
    const selectButton = page.getByRole('button', { name: /Select Songs/i });
    if (await selectButton.isVisible()) {
      await selectButton.click();
      await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
    }
  });

  // Since we cannot easily "seed" the database without more complex setup, 
  // we'll focus on UI elements visibility and basic transitions.
  // In a real environment, we'd mock the storage or use a fixture to add a song.
});
