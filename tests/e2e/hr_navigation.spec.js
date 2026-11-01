import { test, expect } from '@playwright/test';

test.describe('OmniSuite ERP Playwright Verification', () => {
  test('Login Page UI components render correctly', async ({ page }) => {
    await page.goto('http://localhost:5173/login');

    await expect(page).toHaveTitle(/OmniSuite ERP/i);
    await expect(page.locator('input[name="username"], input[type="text"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Submit")')).toBeVisible();
  });

  test('Unauthenticated access to protected module routes redirects to login', async ({ page }) => {
    await page.goto('http://localhost:5173/human-resources/salary-config');
    await expect(page).toHaveURL(/.*\/login.*/);
  });
});
