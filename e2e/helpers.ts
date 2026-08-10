import { Page } from '@playwright/test';

export const BASE  = process.env.E2E_BASE_URL    || 'http://localhost:8080/flowstack';
export const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@flowstack.com';
export const PASS  = process.env.E2E_ADMIN_PASS  || 'admin123';

export const MOCK_TOKEN = 'mock.jwt.token';
export const MOCK_USER  = {
  id: 'test-001', email: EMAIL, display_name: 'Admin Test',
  is_admin: 1, is_active: 1,
  permissions: ['home','projects','sales','support','admin','workflow'],
};

/** catch-all สำหรับ API calls ที่ไม่ได้ mock — ป้องกัน 401 redirect ออก /auth */
export async function mockAllApis(page: Page) {
  await page.route('**/api/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
}

/** mock auth endpoints แล้ว login — ใช้ใน beforeEach ของทุก test file */
export async function loginWithMock(page: Page, destination = '/#/') {
  // catch-all ต้องลงทะเบียนก่อน เพราะ Playwright ใช้ LIFO (ล่าสุด = ก่อน)
  // specific mocks จะ override catch-all นี้
  await mockAllApis(page);

  // mock auth/login + auth/me
  await page.route('**/api/auth/login.php', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: MOCK_TOKEN, user: MOCK_USER }),
    });
  });
  await page.route('**/api/auth/me.php', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_USER),
    });
  });

  await page.goto(`${BASE}/#/auth`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await Promise.all([
    page.waitForURL(url => !url.hash.includes('/auth'), { timeout: 10000 }),
    page.click('button[type="submit"]'),
  ]);

  if (destination !== '/#/') {
    await page.goto(`${BASE}${destination}`);
    await page.waitForLoadState('networkidle');
  }
}
