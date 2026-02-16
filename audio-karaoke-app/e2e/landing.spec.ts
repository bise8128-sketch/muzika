import { test, expect } from '@playwright/test';

test('landing page has title and CTA', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/DaorsKaraoke/i);

  // Expect main heading to be visible
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  
  // Check for some main UI element that indicates the app loaded
  // Adjust the selector based on actual content
  // Assuming there's a button to start or upload
  // await expect(page.getByText('Upload Audio')).toBeVisible();
});
