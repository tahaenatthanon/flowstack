import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080/flowstack';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@flowstack.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'test123456';

test.describe('Content Calendar Planner', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/#/auth`);
    await page.waitForLoadState('networkidle');

    // Fill in login form
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect after login
    await page.waitForTimeout(2000);
  });

  test('renders calendar with month view by default', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/content-planner`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Should show page title
    await expect(page.locator('text=วางแผนคอนเทนต์').first()).toBeVisible({ timeout: 10000 });

    // View toggle buttons should be visible
    await expect(page.locator('button:has-text("เดือน")').first()).toBeVisible();
    await expect(page.locator('button:has-text("ไตรมาส")').first()).toBeVisible();
    await expect(page.locator('button:has-text("ปี")').first()).toBeVisible();
  });

  test('switches between month, quarter, and year views', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/content-planner`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click quarter view
    await page.locator('button:has-text("ไตรมาส")').first().click();
    await page.waitForTimeout(500);

    // Click year view
    await page.locator('button:has-text("ปี")').first().click();
    await page.waitForTimeout(500);

    // Year should show month blocks
    await expect(page.locator('text=มกราคม').first()).toBeVisible({ timeout: 5000 });

    // Switch back to month
    await page.locator('button:has-text("เดือน")').first().click();
    await page.waitForTimeout(300);
  });

  test('navigates to next and previous periods', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/content-planner`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find nav buttons (ChevronLeft/ChevronRight are lucide icons rendered as SVG)
    const nextBtn = page.locator('button svg.lucide-chevron-right').first().locator('..');
    const prevBtn = page.locator('button svg.lucide-chevron-left').first().locator('..');

    await nextBtn.click();
    await page.waitForTimeout(300);

    await prevBtn.click();
    await page.waitForTimeout(300);
  });

  test('opens AI side panel', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/content-planner`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // AI panel should be visible by default
    await expect(page.locator('text=AI สร้างแผน').first()).toBeVisible({ timeout: 5000 });

    // Should have plan type selector
    await expect(page.locator('text=ประเภทแผน').first()).toBeVisible();
  });

  test('clicks date to open content card dialog', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/content-planner`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Click on a date cell in the calendar (any day number button)
    const dateCells = page.locator('[class*="min-h-"][class*="cursor-pointer"]');
    const count = await dateCells.count();
    if (count > 0) {
      await dateCells.first().click();
      await page.waitForTimeout(500);
      // Dialog should appear
      const dialogVisible = await page.locator('text=สร้างคอนเทนต์ใหม่')
        .or(page.locator('text=แก้ไขคอนเทนต์'))
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(dialogVisible).toBeTruthy();
    }
  });

  test('analytics panel shows at bottom', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/content-planner`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Analytics toggle should be visible at bottom
    await expect(page.locator('text=เวลาที่ดีที่สุดในการโพสต์').first()).toBeVisible({ timeout: 5000 });
  });
});
