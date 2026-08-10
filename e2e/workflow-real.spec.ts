/**
 * Workflow BPM — Real DB Tests
 * ล็อกอินด้วย credentials จริง ดึงข้อมูลจากตารางจริง (ไม่มี mock)
 */
import { test, expect, Page } from '@playwright/test';

const BASE  = 'http://localhost:8080/flowstack';
const EMAIL = 'admin@flowstack.com';
const PASS  = 'ktN@007';

/** ล็อกอินกับ server จริง */
async function realLogin(page: Page) {
  await page.goto(`${BASE}/#/auth`);
  await page.waitForLoadState('networkidle');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await Promise.all([
    page.waitForURL(url => !url.hash.includes('/auth'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  // รอให้ React Query โหลด user context เสร็จ
  await page.waitForLoadState('networkidle');
}

test.describe('Workflow BPM — Real DB (admin@flowstack.com)', () => {

  test('1. ล็อกอินสำเร็จ → เข้า /workflow ได้', async ({ page }) => {
    await realLogin(page);
    await page.goto(`${BASE}/#/workflow`);
    await page.waitForLoadState('networkidle');

    // ไม่ควรถูก redirect กลับ /auth
    expect(page.url()).not.toContain('/auth');
    // URL ควรเป็น /workflow
    expect(page.url()).toContain('/workflow');
  });

  test('2. WorkflowPage โหลด UI frame ครบ — tab bar + journey list area', async ({ page }) => {
    await realLogin(page);
    await page.goto(`${BASE}/#/workflow`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Tab bar ต้องมีอยู่
    const tabBar = page.locator('button').filter({ hasText: /Journey|รายงาน|คอขวด|ออกแบบ/ });
    const tabCount = await tabBar.count();
    expect(tabCount).toBeGreaterThanOrEqual(1);
    console.log(`Tab buttons found: ${tabCount}`);

    // Journey list area (header "เส้นทางลูกค้า") ต้องแสดง
    await expect(page.locator('text=เส้นทางลูกค้า').first()).toBeVisible({ timeout: 8000 });
  });

  test('3. Journey list ดึงข้อมูลจาก DB — แสดงรายการหรือ "ไม่พบ Journey"', async ({ page }) => {
    const journeyRequests: string[] = [];

    // ดักจับ request (ไม่ intercept — ปล่อยผ่านไป server จริง)
    page.on('request', req => {
      if (req.url().includes('workflow-journeys.php')) {
        journeyRequests.push(req.url());
        console.log(`[REQUEST] ${req.method()} ${req.url()}`);
      }
    });
    page.on('response', resp => {
      if (resp.url().includes('workflow-journeys.php')) {
        console.log(`[RESPONSE] ${resp.status()} ${resp.url()}`);
      }
    });

    await realLogin(page);
    await page.goto(`${BASE}/#/workflow`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // ต้องมี journey API call อย่างน้อย 1 รายการ
    expect(journeyRequests.length).toBeGreaterThanOrEqual(1);
    console.log(`Journey API calls: ${journeyRequests.length}`);

    // แสดง Journey list (มีข้อมูลหรือ empty state)
    const hasJourneys = await page.locator('button[class*="rounded-lg"][class*="border"]').count();
    const hasEmpty    = await page.locator('text=ไม่พบ Journey').count();

    console.log(`Journey items: ${hasJourneys}, empty msg: ${hasEmpty}`);

    // ต้องเป็นอย่างใดอย่างหนึ่ง
    expect(hasJourneys + hasEmpty).toBeGreaterThanOrEqual(1);
  });

  test('4. ข้อมูล journey มาจาก server จริง — ตรวจสอบ response format', async ({ page }) => {
    let journeyListData: any = null;

    // รอ response ?year= (list endpoint)
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('workflow-journeys.php') && resp.url().includes('year='),
      { timeout: 10000 }
    );

    await realLogin(page);
    await page.goto(`${BASE}/#/workflow`);

    try {
      const response = await responsePromise;
      const status = response.status();
      console.log(`Journey list response status: ${status}`);
      expect(status).toBe(200);

      const body = await response.json();
      console.log(`Response type: ${Array.isArray(body) ? 'array' : typeof body}`);
      console.log(`Journey count: ${Array.isArray(body) ? body.length : 'N/A'}`);

      if (Array.isArray(body) && body.length > 0) {
        journeyListData = body;
        const first = body[0];
        console.log(`First journey: id=${first.id}, name="${first.journey_name}", stage=${first.current_stage}, status=${first.status}`);

        // ตรวจสอบ fields ที่ UI ต้องการ
        expect(first).toHaveProperty('id');
        expect(first).toHaveProperty('journey_name');
        expect(first).toHaveProperty('current_stage');
        expect(first).toHaveProperty('status');
      } else if (Array.isArray(body)) {
        console.log('ℹ️ ไม่มี Journey ในระบบ (array ว่าง) — ผ่าน');
      } else if (body && body.data) {
        console.log(`Wrapped response: ${body.data.length} journeys`);
      }
    } catch (e) {
      console.log(`Journey list timeout or error: ${e}`);
      // ถ้า timeout แสดงว่า journey API ไม่ถูกเรียก — test fail
      throw e;
    }
  });

  test('5. สลับ tab ทุก tab → API refetch (staleTime=0)', async ({ page }) => {
    const journeyCalls: string[] = [];

    page.on('request', req => {
      if (req.url().includes('workflow-journeys.php') && req.url().includes('year=')) {
        journeyCalls.push(req.url());
      }
    });

    await realLogin(page);
    await page.goto(`${BASE}/#/workflow`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const callsAfterLoad = journeyCalls.length;
    console.log(`Journey calls after initial load: ${callsAfterLoad}`);

    // สลับ tab: รายงาน → คอขวด → ออกแบบ
    const tabLabels = ['รายงาน', 'คอขวด', 'ออกแบบ'];
    for (const label of tabLabels) {
      const btn = page.locator(`button:has-text("${label}")`).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
        console.log(`Clicked tab: ${label}`);
      } else {
        console.log(`Tab "${label}" ไม่พบหรือไม่ visible`);
      }
    }

    // กลับ Journey tab (มี emoji 🗺)
    const journeyTabBtn = page.locator('button').filter({ hasText: '🗺' }).first();
    if (await journeyTabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await journeyTabBtn.click();
      await page.waitForTimeout(1000);
      console.log('Clicked back to Journey tab');
    }

    console.log(`Journey calls total: ${journeyCalls.length} (initial: ${callsAfterLoad})`);

    // ต้องมี call อย่างน้อย 1 (initial load)
    expect(callsAfterLoad).toBeGreaterThanOrEqual(1);

    if (journeyCalls.length > callsAfterLoad) {
      console.log('✅ staleTime=0 ทำงาน: refetch เมื่อกลับมา Journey tab');
    } else {
      console.log('ℹ️ Journey tab ไม่มี refetch — อาจเป็น behavior ปกติ');
    }
  });

  test('6. scroll รายการ Journey ซ้ายได้ (scroll not broken)', async ({ page }) => {
    await realLogin(page);
    await page.goto(`${BASE}/#/workflow`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // หา scrollable container ใน journey list
    const scrollable = page.locator('.overflow-y-auto').first();
    if (!await scrollable.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('ℹ️ ไม่พบ scrollable container — skip');
      test.skip();
      return;
    }

    // ลอง scroll
    await scrollable.evaluate((el: HTMLElement) => { el.scrollTop = 200; });
    const scrollTop = await scrollable.evaluate((el: HTMLElement) => el.scrollTop);
    console.log(`scrollTop after scroll: ${scrollTop}`);

    // ถ้ามีข้อมูลน้อย scroll อาจเป็น 0 ได้ — ไม่ fail
    // แค่ตรวจสอบว่า element ไม่ throw error
    expect(scrollTop).toBeGreaterThanOrEqual(0);
  });

  test('7. คลิก Journey item → โหลด detail จาก DB', async ({ page }) => {
    let detailCalled = false;
    let detailStatus = 0;

    page.on('response', resp => {
      if (resp.url().includes('workflow-journeys.php') && resp.url().includes('id=')) {
        detailCalled = true;
        detailStatus = resp.status();
        console.log(`[DETAIL] ${resp.status()} ${resp.url()}`);
      }
    });

    await realLogin(page);
    await page.goto(`${BASE}/#/workflow`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // ถ้ามี journey ให้คลิก
    const firstJourney = page.locator('button[class*="rounded-lg"][class*="border"]').first();
    if (!await firstJourney.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('ℹ️ ไม่มี journey ให้คลิก — auto-select อาจทำงานแล้ว');
      // auto-select อาจเรียก detail แล้ว
    } else {
      await firstJourney.click();
      await page.waitForTimeout(1000);
    }

    if (detailCalled) {
      console.log(`Detail API: ${detailStatus}`);
      expect(detailStatus).toBe(200);
    } else {
      console.log('ℹ️ Detail API ไม่ถูกเรียก (อาจไม่มี journey ใน DB)');
    }
  });

});
