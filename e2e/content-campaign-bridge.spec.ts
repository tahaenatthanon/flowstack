import { test, expect, chromium } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080/flowstack';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@flowstack.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'test123456';

test.describe('Content ↔ Email Campaign Bridge', () => {
  let page: any;
  let browser: any;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
  });

  test('1. Login', async () => {
    await page.goto(`${BASE_URL}/#/auth`);
    await page.waitForLoadState('networkidle');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url).not.toContain('auth');
  });

  test('2. Content page loads with tabs', async () => {
    await page.goto(`${BASE_URL}/#/content`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify tabs render
    await expect(page.locator('text=ผลงานทั้งหมด')).toBeVisible();
    await expect(page.locator('text=กำหนดการโพสต์')).toBeVisible();
    await expect(page.locator('text=Knowledge Base')).toBeVisible();
    await expect(page.locator('text=Skills & Triggers')).toBeVisible();

    // Check batch generate button exists
    await expect(page.locator('button:has-text("Batch")').first()).toBeVisible();
  });

  test('3. Campaigns page has "ดึงจาก Content" button', async () => {
    await page.goto(`${BASE_URL}/#/campaigns`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify the pull-from-content button exists
    const pullBtn = page.locator('button:has-text("ดึงจาก Content")');
    await expect(pullBtn).toBeVisible();

    // Click it and verify dialog opens
    await pullBtn.click();
    await page.waitForTimeout(1000);

    // Dialog should be visible with search input
    await expect(page.locator('text=ดึงบทความจาก Content')).toBeVisible();
    await expect(page.locator('input[placeholder="ค้นหาบทความ..."]')).toBeVisible();
  });

  test('4. Content Planner page loads', async () => {
    await page.goto(`${BASE_URL}/#/content-planner`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify header renders
    await expect(page.locator('text=วางแผนคอนเทนต์')).toBeVisible();

    // Batch button should be visible
    await expect(page.locator('button:has-text("Batch")').first()).toBeVisible();
  });
});
