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
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
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

function makeItem(overrides: Partial<PlanItem> & { scripts?: Record<string, string>; scriptQuality?: Record<string, any> }): PlanItem {
  const { scripts, scriptQuality, ...rest } = overrides;
  const article_content = scripts
    ? JSON.stringify({ title: 'หัวข้อทดสอบ', scripts, ...(scriptQuality ? { script_quality: { platforms: scriptQuality } } : {}) })
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
    await present('Facebook');
    await absent('Instagram');
    await absent('TikTok');
    await absent('YouTube');
    await absent('LinkedIn');
  });

  it('TC2: Facebook + Instagram → แสดง script ทั้งสองเท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook', 'instagram'], scripts: ALL_PLATFORM_SCRIPTS }));
    await present('Facebook');
    await present('Instagram');
    await absent('TikTok');
    await absent('YouTube');
  });

  it('TC3: YouTube + TikTok → แสดง script ทั้งสองเท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'youtube', platforms: ['youtube', 'tiktok'], scripts: ALL_PLATFORM_SCRIPTS }));
    await present('YouTube');
    await present('TikTok');
    await absent('Facebook');
    await absent('Instagram');
  });

  it('TC4: Instagram + TikTok + YouTube → แสดง 3 ตัวนี้เท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'instagram', platforms: ['instagram', 'tiktok', 'youtube'], scripts: ALL_PLATFORM_SCRIPTS }));
    await present('Instagram');
    await present('TikTok');
    await present('YouTube');
    await absent('Facebook');
    await absent('LinkedIn');
  });

  it('TC5: ไม่มี Platform → ไม่แสดง script ใด (empty state)', async () => {
    renderDialog(makeItem({ platform: '', platforms: null, scripts: ALL_PLATFORM_SCRIPTS }));
    await present('ยังไม่ได้กำหนด Platform สำหรับคอนเทนต์นี้');
    await absent('Facebook');
    await absent('Instagram');
    await absent('TikTok');
    await absent('YouTube');
  });

  it('TC6: AI สร้าง script platform อื่น → ระบบตัดออก (เหลือเฉพาะที่เลือก)', async () => {
    // platforms เลือก facebook แต่ article_content มี instagram ที่ AI แอบเพิ่ม → ต้องถูกตัด
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'], scripts: { facebook: 'FB', instagram: 'IG แอบเพิ่ม' } }));
    await present('Facebook');
    await absent('Instagram');
  });

  it('TC7: SEO/AEO repair เพิ่ม script platform ที่ไม่ได้เลือก → ต้องถูกตัดออก', async () => {
    // จำลอง repair ที่เผลอเพิ่ม linkedin/twitter กลับมา → ต้องถูกตัดเหลือเฉพาะ facebook
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'], scripts: { facebook: 'FB', linkedin: 'LI', twitter: 'X' } }));
    await present('Facebook');
    await absent('LinkedIn');
    await absent('Twitter / X');
  });

  it('TC8: Content เดิมมี script ครบทุก Platform → แสดงเฉพาะ platform ที่ Content เลือก', async () => {
    // legacy: article_content มี script ครบทุก platform แต่ content เลือกไว้แค่ instagram+tiktok
    renderDialog(makeItem({ platform: 'instagram', platforms: ['instagram', 'tiktok'], scripts: ALL_PLATFORM_SCRIPTS }));
    await present('Instagram');
    await present('TikTok');
    await absent('Facebook');
    await absent('YouTube');
    await absent('LinkedIn');
    await absent('Twitter / X');
  });

  it('TC9: Content เดิมมี persisted Script Quality → โหลดและแสดงผลได้หลังเปิด Dialog ใหม่', async () => {
    const quality = {
      facebook: {
        seo: { score: 85, gate: 'passed', rules: [{ key: 'topic_relevance', status: 'passed', tier: 'required', weight: 20, score: 20, message: 'ตรงกับหัวข้อ' }] },
        aeo: { score: 82, gate: 'passed', rules: [{ key: 'direct_value', status: 'passed', tier: 'required', weight: 20, score: 20, message: 'ตอบประเด็นหลัก' }] },
        passed: true,
      },
      instagram: {
        seo: { score: 65, gate: 'failed', rules: [{ key: 'topic_relevance', status: 'failed', tier: 'required', weight: 20, score: 0, message: 'ไม่ตรงกับหัวข้อ' }] },
        aeo: { score: 75, gate: 'needs_improvement', rules: [{ key: 'direct_value', status: 'needs_improvement', tier: 'required', weight: 20, score: 10, message: 'ควรตอบเร็วขึ้น' }] },
        passed: false,
      },
    };
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'], scripts: { ...ALL_PLATFORM_SCRIPTS }, scriptQuality: quality }));
    await present('ตรวจ SEO');
    await present('ตรวจ AEO');
    await present('85');
    await present('82');
    await present('ผ่าน');
    await absent('65');
    await absent('Instagram');
  });

  it('TC10: มี Script ปัจจุบันแต่ไม่มี Quality → แสดง รอตรวจ และไม่สร้าง Score ปลอม', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'], scripts: { facebook: 'FB script' } }));
    await present('รอตรวจ');
    await present('—');
    await absent('0/100');
  });
});
