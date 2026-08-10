import { test, expect, chromium } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080/flowstack';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'test@flowstack.com';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'test123456';
const TEST_NAME = process.env.E2E_TEST_NAME || 'Test User';

test.describe('FlowStack Login and Mail Template Test', () => {
  let page: any;
  let browser: any;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('1. Signup new user', async () => {
    console.log('Navigating to signup page...');
    await page.goto(`${BASE_URL}/#/auth`);
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Click the signup toggle if needed
    const signupLink = page.locator('button:has-text("สมัครสมาชิก")');
    if (await signupLink.isVisible()) {
      await signupLink.click();
    }
    
    // Fill in signup form
    console.log('Filling signup form...');
    await page.fill('#displayName', TEST_NAME);
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for navigation after signup
    await page.waitForTimeout(2000);
    
    // Check if we're logged in (redirected to home)
    const currentUrl = page.url();
    console.log('Current URL after signup:', currentUrl);
    
    // If still on auth page, might need to wait more or check for errors
    if (currentUrl.includes('auth')) {
      const errorToast = page.locator('[class*="toast"], [class*="destructive"]').first();
      if (await errorToast.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log('Signup might have failed, user may already exist');
      }
    }
  });

  test('2. Login with test user', async () => {
    console.log('Navigating to login page...');
    await page.goto(`${BASE_URL}/#/auth`);
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Fill in login form
    console.log('Filling login form...');
    await page.fill('#email', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for navigation after login
    await page.waitForTimeout(3000);
    
    // Check if we're logged in
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);
    
    // Should redirect to home or some protected page
    expect(currentUrl).not.toContain('auth');
  });

  test('3. Navigate to Marketing page', async () => {
    console.log('Navigating to Marketing page...');
    
    // Try to navigate to marketing page
    await page.goto(`${BASE_URL}/#/marketing`);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log('Marketing page URL:', currentUrl);
    
    // Check if we can see marketing content
    const pageContent = await page.content();
    const hasMarketingContent = pageContent.includes('การตลาด') || pageContent.includes('Marketing') || pageContent.includes('email');
    console.log('Has marketing content:', hasMarketingContent);
  });

  test('4. Test Mail Template functionality', async () => {
    console.log('Testing Mail Template functionality...');
    
    // Navigate to marketing page
    await page.goto(`${BASE_URL}/#/marketing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for email template elements
    const templateButtons = page.locator('button:has-text("✉"), button:has-text("📧"), [class*="template"]');
    const templateCount = await templateButtons.count();
    console.log('Found template buttons:', templateCount);
    
    // Check for campaign elements
    const campaignSection = page.locator('text=สร้างแคมเปญ, text=Create Campaign');
    const hasCampaignSection = await campaignSection.isVisible().catch(() => false);
    console.log('Has campaign section:', hasCampaignSection);
    
    // Look for email templates in the page
    const emailTemplates = page.locator('[class*="template"], button[class*="border"]');
    const templateElementCount = await emailTemplates.count();
    console.log('Found template elements:', templateElementCount);
    
    // Check for ReactQuill editor (email body editor)
    const quillEditor = page.locator('.ql-editor, [class*="quill"]');
    const hasQuillEditor = await quillEditor.isVisible().catch(() => false);
    console.log('Has Quill editor:', hasQuillEditor);
    
    // Verify the page loaded properly
    const bodyText = await page.locator('body').textContent();
    const hasEmailRelatedContent = bodyText?.includes('อีเมล') || bodyText?.includes('Email') || bodyText?.includes('แคมเปญ');
    console.log('Has email-related content:', hasEmailRelatedContent);
    
    if (!hasEmailRelatedContent) {
      console.log('Page content:', bodyText?.substring(0, 500));
    }
  });
});
