import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import type { PlanItem } from '@/components/content/types';

/**
 * Requirement part 1: Content Dialog ต้องแสดงเฉพาะ Platform ที่ถูกบันทึกไว้กับ
 * Content Item นั้นเท่านั้น ห้ามดึง Platform ทั้งระบบมาแสดงสำหรับ Content เดิม
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

function makeItem(overrides: Partial<PlanItem>): PlanItem {
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
    ...overrides,
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

// ใช้ queryAllByText เพราะ header badge อาจแสดง label เดียวกับ checkbox label
const present = async (text: string) =>
  await waitFor(() => expect(screen.queryAllByText(text).length).toBeGreaterThan(0));
const absent = async (text: string) =>
  await waitFor(() => expect(screen.queryAllByText(text).length).toBe(0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ContentCardDialog — จำกัด Platform ตาม Content Item', () => {
  it('TC1: Content เลือก Facebook อย่างเดียว → แสดงเฉพาะ Facebook', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'] }));
    await present('Facebook');
    await absent('Instagram');
    await absent('TikTok');
    await absent('YouTube');
  });

  it('TC2: Content เลือก Facebook + Instagram → แสดงทั้งสองเท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook', 'instagram'] }));
    await present('Facebook');
    await present('Instagram');
    await absent('TikTok');
    await absent('YouTube');
  });

  it('TC3: Content เลือก YouTube + TikTok → แสดงทั้งสองเท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'youtube', platforms: ['youtube', 'tiktok'] }));
    await present('YouTube');
    await present('TikTok');
    await absent('Facebook');
    await absent('Instagram');
  });

  it('TC4: Content ที่ไม่มี Platform → แสดง Empty State (ห้าม fallback/ห้าม default Facebook)', async () => {
    renderDialog(makeItem({ platform: '', platforms: null }));
    await present('ยังไม่ได้กำหนด Platform สำหรับคอนเทนต์นี้');
    await absent('Facebook');
    await absent('Instagram');
  });

  it('TC6: แก้ Facebook+Instagram → Facebook+TikTok → แสดง Facebook+TikTok เท่านั้น (ไม่มี Instagram)', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook', 'tiktok'] }));
    await present('Facebook');
    await present('TikTok');
    await absent('Instagram');
  });

  it('TC8: Content A=Facebook, B=Instagram+TikTok, C=YouTube — ไม่ปนกัน', async () => {
    const { unmount } = renderDialog(makeItem({ id: 'a', platform: 'facebook', platforms: ['facebook'] }));
    await present('Facebook');
    await absent('Instagram');
    unmount();

    renderDialog(makeItem({ id: 'b', platform: 'instagram', platforms: ['instagram', 'tiktok'] }));
    await present('Instagram');
    await present('TikTok');
    await absent('Facebook');
    await absent('YouTube');
  });

  it('New content (existingItem=null) → แสดงรายการ Platform ทั้งหมด (สำหรับเลือก)', async () => {
    renderDialog(null);
    await present('Facebook');
    await present('Instagram');
    await present('YouTube');
    await present('TikTok');
  });

  // API ส่ง platforms กลับมาเป็น JSON string (เพราะ SQL คืน TEXT) — Dialog ต้อง parse ได้
  it('platforms เป็น JSON string → แสดงเฉพาะ platform ที่ parse ออกมา', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: '["facebook","instagram"]' }));
    await present('Facebook');
    await present('Instagram');
    await absent('TikTok');
    await absent('YouTube');
  });

  it('platforms เป็น comma string (legacy) → แสดงเฉพาะ platform ที่ split ออกมา', async () => {
    renderDialog(makeItem({ platform: 'youtube', platforms: 'youtube,tiktok' }));
    await present('YouTube');
    await present('TikTok');
    await absent('Facebook');
    await absent('Instagram');
  });
});
