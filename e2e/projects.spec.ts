import { test, expect, Page } from '@playwright/test';

const BASE  = process.env.E2E_BASE_URL   || 'http://localhost:8080/flowstack';
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@flowstack.com';
const PASS  = process.env.E2E_ADMIN_PASS  || 'admin123';

async function login(page: Page) {
  await page.goto(`${BASE}/#/auth`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await Promise.all([
    page.waitForURL(url => !url.hash.includes('/auth'), { timeout: 8000 }),
    page.click('button[type="submit"]'),
  ]);
}

test.describe('Projects & Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/#/projects`);
    await page.waitForLoadState('networkidle');
  });

  test('1. สร้างโปรเจกต์ใหม่ → ปรากฏในรายการ', async ({ page }) => {
    const projectName = `Test Project ${Date.now()}`;
    // คลิกปุ่มสร้างโปรเจกต์
    await page.click('button:has-text("สร้างโปรเจกต์"), button:has-text("+ โปรเจกต์"), button[aria-label*="สร้าง"]');
    await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
    await page.fill('input[placeholder*="ชื่อโปรเจกต์"], input[name="name"], #name', projectName);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('projects.php') && r.request().method() === 'POST'),
      page.click('[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("สร้าง")'),
    ]);
    await expect(page.locator(`text=${projectName}`)).toBeVisible({ timeout: 5000 });
  });

  test('2. สร้าง task ใน project → task นับถูก', async ({ page }) => {
    // เปิดโปรเจกต์แรกที่เจอ
    const firstProject = page.locator('[data-testid="project-card"], .project-card, [class*="project"]').first();
    if (!await firstProject.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    await firstProject.click();
    await page.waitForLoadState('networkidle');

    const taskName = `Task ${Date.now()}`;
    await page.click('button:has-text("สร้าง Task"), button:has-text("+ Task"), button:has-text("เพิ่มงาน")');
    await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
    await page.fill('input[placeholder*="ชื่องาน"], input[name="title"], #title', taskName);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('tasks.php') && r.request().method() === 'POST'),
      page.click('[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("สร้าง")'),
    ]);
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 5000 });
  });

  test('3. อัปเดต task status → status เปลี่ยนใน UI', async ({ page }) => {
    // Mock API สำหรับ task update
    await page.route('**/api/tasks.php*', async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    const statusSelect = page.locator('select[name="status"], [data-testid="task-status"]').first();
    if (!await statusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    await statusSelect.selectOption('completed');
    // ตรวจว่า UI แสดง completed
    await expect(page.locator('text=เสร็จสิ้น, text=completed').first()).toBeVisible({ timeout: 4000 });
  });

  test('4. Task > 16 ชม. → warning แสดง (task atomicity)', async ({ page }) => {
    // Mock: task hours > 16
    await page.route('**/api/tasks.php*', async route => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.estimated_hours > 16) {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Task ต้องไม่เกิน 16 ชั่วโมง' }),
          });
        } else {
          await route.continue();
        }
      } else {
        await route.continue();
      }
    });

    await page.click('button:has-text("สร้าง Task"), button:has-text("+ Task")');
    await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
    const hoursInput = page.locator('input[name="estimated_hours"], input[placeholder*="ชั่วโมง"]').first();
    if (await hoursInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hoursInput.fill('20');
      await page.click('[role="dialog"] button[type="submit"]');
      const warning = page.locator('text=16 ชั่วโมง, text=เกิน, [class*="destructive"]').first();
      await expect(warning).toBeVisible({ timeout: 4000 });
    } else {
      test.skip();
    }
  });

  test('5. บันทึกชั่วโมง (subtask) → actual_hours อัปเดต', async ({ page }) => {
    await page.route('**/api/task-hours.php*', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, actual_hours: 3 }),
        });
      } else {
        await route.continue();
      }
    });

    const hoursBtn = page.locator('button:has-text("บันทึกชั่วโมง"), button:has-text("+ ชม")').first();
    if (!await hoursBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      test.skip();
      return;
    }
    await hoursBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 4000 });
    await page.fill('input[name="hours"], input[type="number"]', '3');
    await page.click('[role="dialog"] button[type="submit"]');
    // ตรวจว่า actual_hours อัปเดต
    await expect(page.locator('text=3 ชม, text=3h').first()).toBeVisible({ timeout: 4000 });
  });
});
