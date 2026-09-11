import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import type { PlanItem } from '@/components/content/types';

/**
 * Requirement part 2 — Scripts ต้องจำกัดตาม Platform ที่ Content เลือกเท่านั้น
 * (ห้ามแสดง script ของ platform ที่ไม่ได้เลือก, ห้าม default, ห้าม fallback)
 *
 * ตรวจระดับ UI: ContentCardDialog ใช้ `scripts` useMemo ซึ่ง filter article_content.scripts
 * ให้เหลือเฉพาะ platform ใน `platforms` ของ Content Item (Source of Truth)
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
// ContentCardDialog เรียก useConfirm() ตรงๆ ไม่มี <ConfirmProvider> ครอบในเทสต์นี้ —
// mock กันพังตอน render (ดู change confirm-before-ai-content-write)
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
  useQualityRecheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

const ALL_PLATFORM_SCRIPTS: Record<string, string> = {
  facebook: 'FB script',
  instagram: 'IG script',
  tiktok: 'TikTok script',
  youtube: 'YouTube script',
  lineoa: 'LINE script',
  linkedin: 'LinkedIn script',
  twitter: 'X script',
};

const SAMPLE_SCRIPT_SECTIONS = { opening: 'Hook', bridge: 'เนื้อหาหลัก', twist: 'จุดพลิก', ending: 'CTA' };

function makeItem(overrides: Partial<PlanItem> & { scripts?: Record<string, string>; scriptQuality?: Record<string, any>; scriptSections?: Record<string, string> }): PlanItem {
  const { scripts, scriptQuality, scriptSections, ...rest } = overrides;
  const article_content = scripts
    ? JSON.stringify({
        title: 'หัวข้อทดสอบ',
        scripts,
        ...(scriptSections ? { script_sections: scriptSections } : {}),
        ...(scriptQuality ? {
          script_quality: { platforms: scriptQuality },
          quality_checked_at: '2026-09-04 15:00:00',
        } : {}),
      })
    : '';
  return {
    id: 'item-1',
    plan_id: 'plan-1',
    day_label: 'Day 1',
    day_order: 1,
    scheduled_date: '2026-09-04',
    platform: '',
    platforms: null,
    topic: 'หัวข้อทดสอบ',
    caption: '',
    image_brief: '',
    generated_image_url: null,
    image_gen_status: '',
    article_content,
    ...rest,
  };
}

function renderDialog(existingItem: PlanItem | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentCardDialog
        open
        onOpenChange={() => {}}
        date={null}
        planId="plan-1"
        existingItem={existingItem}
        onSave={vi.fn(async () => {})}
      />
    </QueryClientProvider>,
  );
}

/**
 * Script ของแต่ละ platform แสดงเป็นแท็บ — ตรวจที่รายการแท็บเท่านั้น
 * (ห้ามค้นทั้งหน้า เพราะรายการตัวเลือก Platform ด้านล่างแสดงชื่อครบทุกตัวโดยเจตนา
 * เพื่อให้แก้ไข/เพิ่ม Platform ได้)
 */
const scriptTabs = () => screen.queryAllByRole('tab').map(t => (t.textContent ?? '').trim());
const hasTab = async (label: string) =>
  await waitFor(() => expect(scriptTabs()).toContain(label));
const noTab = async (label: string) =>
  await waitFor(() => expect(scriptTabs()).not.toContain(label));

const present = async (text: string) =>
  await waitFor(() => expect(screen.queryAllByText(text).length).toBeGreaterThan(0));
const absent = async (text: string) =>
  await waitFor(() => expect(screen.queryAllByText(text).length).toBe(0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ContentCardDialog — Scripts จำกัดตาม Platform ที่เลือก', () => {
  it('TC1: Facebook อย่างเดียว → แสดง script เฉพาะ Facebook', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'], scripts: ALL_PLATFORM_SCRIPTS }));
    await hasTab('Facebook');
    await noTab('Instagram');
    await noTab('TikTok');
    await noTab('YouTube');
    await noTab('LinkedIn');
  });

  it('TC2: Facebook + Instagram → แสดง script ทั้งสองเท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook', 'instagram'], scripts: ALL_PLATFORM_SCRIPTS }));
    await hasTab('Facebook');
    await hasTab('Instagram');
    await noTab('TikTok');
    await noTab('YouTube');
  });

  it('TC3: YouTube + TikTok → แสดง script ทั้งสองเท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'youtube', platforms: ['youtube', 'tiktok'], scripts: ALL_PLATFORM_SCRIPTS }));
    await hasTab('YouTube');
    await hasTab('TikTok');
    await noTab('Facebook');
    await noTab('Instagram');
  });

  it('TC4: Instagram + TikTok + YouTube → แสดง 3 ตัวนี้เท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'instagram', platforms: ['instagram', 'tiktok', 'youtube'], scripts: ALL_PLATFORM_SCRIPTS }));
    await hasTab('Instagram');
    await hasTab('TikTok');
    await hasTab('YouTube');
    await noTab('Facebook');
    await noTab('LinkedIn');
  });

  it('TC5: ไม่มี Platform → ไม่แสดง script ใด (empty state)', async () => {
    renderDialog(makeItem({ platform: '', platforms: null, scripts: ALL_PLATFORM_SCRIPTS }));
    await present('ยังไม่ได้กำหนด Platform สำหรับคอนเทนต์นี้');
    await waitFor(() => expect(screen.queryAllByRole('tab')).toHaveLength(0));
  });

  it('TC6: AI สร้าง script platform อื่น → ระบบตัดออก (เหลือเฉพาะที่เลือก)', async () => {
    // platforms เลือก facebook แต่ article_content มี instagram ที่ AI แอบเพิ่ม → ต้องถูกตัด
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'], scripts: { facebook: 'FB', instagram: 'IG แอบเพิ่ม' } }));
    await hasTab('Facebook');
    await noTab('Instagram');
    await absent('IG แอบเพิ่ม');
  });

  it('TC7: AI แอบเพิ่ม script platform ที่ไม่ได้เลือก (linkedin/twitter) → ต้องถูกตัดออก', async () => {
    // article_content มี linkedin/twitter ที่ AI แอบเพิ่มมา → ต้องถูกตัดเหลือเฉพาะ facebook
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'], scripts: { facebook: 'FB', linkedin: 'LI', twitter: 'X' } }));
    await hasTab('Facebook');
    await noTab('LinkedIn');
    await noTab('Twitter / X');
  });

  it('TC8: Content เดิมมี script ครบทุก Platform → แสดงเฉพาะ platform ที่ Content เลือก', async () => {
    // legacy: article_content มี script ครบทุก platform แต่ content เลือกไว้แค่ instagram+tiktok
    renderDialog(makeItem({ platform: 'instagram', platforms: ['instagram', 'tiktok'], scripts: ALL_PLATFORM_SCRIPTS }));
    await hasTab('Instagram');
    await hasTab('TikTok');
    await noTab('Facebook');
    await noTab('YouTube');
    await noTab('LinkedIn');
    await noTab('Twitter / X');
  });

  it('TC9: ไม่แสดง Script SEO/AEO score หรือ checklist อีกต่อไป (ลบ Script Quality Gate ออกแล้ว) — Script เต็มยังแสดงปกติ', async () => {
    // จำลอง content เก่าที่เคยมี script_quality (SEO/AEO) เก็บไว้ก่อนหน้านี้ — แม้มีข้อมูล
    // legacy นี้ค้างอยู่ ContentCardDialog ต้องไม่อ่าน/ไม่แสดงผลจาก field นี้อีกต่อไป
    const legacyQuality = {
      facebook: {
        seo: { score: 85, gate: 'passed', rules: [] },
        aeo: { score: 82, gate: 'passed', rules: [] },
        passed: true,
      },
    };
    renderDialog(makeItem({
      platform: 'facebook',
      platforms: ['facebook'],
      scripts: { facebook: 'FB script เนื้อหาเต็ม' },
      scriptQuality: legacyQuality,
    }));
    await hasTab('Facebook');
    await present('FB script เนื้อหาเต็ม');
    await absent('ตรวจ SEO');
    await absent('ตรวจ AEO');
    await absent('85');
    await absent('82');
  });

  it('TC10: เลือกเฉพาะ Facebook (ไม่มี platform วิดีโอ) → ไม่แสดง Script Sections แม้มีข้อมูลอยู่', async () => {
    // core-content-platform-output-shape: Script Sections derive จาก platform ที่เลือก
    // ไม่ใช่จาก Content Type — แม้ article_content จะมี script_sections ค้างอยู่ (เช่น
    // content เก่าที่เคยเลือก TikTok แล้วถูกแก้ platform ภายหลัง) ก็ต้องไม่แสดง
    renderDialog(makeItem({
      platform: 'facebook',
      platforms: ['facebook'],
      scripts: { facebook: 'FB script' },
      scriptSections: SAMPLE_SCRIPT_SECTIONS,
    }));
    await hasTab('Facebook');
    await absent('โครงสร้างบท (Script Sections)');
    await absent('จุดพลิก');
  });

  it('TC11: เลือก TikTok ร่วมกับ Facebook → แสดง Script Sections ตามปกติ', async () => {
    renderDialog(makeItem({
      platform: 'tiktok',
      platforms: ['tiktok', 'facebook'],
      scripts: { tiktok: 'TikTok script', facebook: 'FB script' },
      scriptSections: SAMPLE_SCRIPT_SECTIONS,
    }));
    await hasTab('TikTok');
    await hasTab('Facebook');
    await present('โครงสร้างบท (Script Sections)');
    await present('จุดพลิก');
  });
});
