import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import type { PlanItem } from '@/components/content/types';

/**
 * Requirement part 1: Platform ที่ "ถูกเลือกไว้" ของ Content Item ต้องมาจากข้อมูลของ
 * item นั้นเท่านั้น — ห้าม default, ห้าม fallback, ห้ามปนกับ item อื่น
 *
 * รายการตัวเลือก Platform ทั้งหมดยังต้องแสดงเสมอเพื่อให้แก้ไข/เพิ่ม Platform ได้
 * (multi-select) สิ่งที่จำกัดตาม Content Item คือ "สถานะติ๊ก" ไม่ใช่การซ่อนตัวเลือก
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
// ContentCardDialog เรียก useConfirm() ตรงๆ ไม่มี <ConfirmProvider> ครอบในเทสต์นี้ —
// mock กันพังตอน render (ดู change confirm-before-ai-content-write)
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));
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

/**
 * หา checkbox ของ Platform จาก <label> ที่ครอบข้อความนั้นอยู่
 * (ตัด badge ใน DialogHeader ที่ใช้ label เดียวกันออก เพราะไม่ได้อยู่ใน label)
 */
function platformCheckbox(label: string): HTMLElement {
  const box = screen
    .getAllByText(label)
    .map(node => node.closest('label')?.querySelector('[role="checkbox"]'))
    .find(Boolean);
  if (!box) throw new Error(`ไม่พบ checkbox ของ Platform: ${label}`);
  return box as HTMLElement;
}

const checked = async (label: string) =>
  await waitFor(() => expect(platformCheckbox(label).getAttribute('data-state')).toBe('checked'));
const unchecked = async (label: string) =>
  await waitFor(() => expect(platformCheckbox(label).getAttribute('data-state')).toBe('unchecked'));
const present = async (text: string) =>
  await waitFor(() => expect(screen.queryAllByText(text).length).toBeGreaterThan(0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ContentCardDialog — Platform ที่ติ๊กไว้ต้องตรงกับ Content Item', () => {
  it('TC1: Content เลือก Facebook อย่างเดียว → ติ๊กเฉพาะ Facebook', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook'] }));
    await checked('Facebook');
    await unchecked('Instagram');
    await unchecked('TikTok');
    await unchecked('YouTube');
  });

  it('TC2: Content เลือก Facebook + Instagram → ติ๊กทั้งสองเท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook', 'instagram'] }));
    await checked('Facebook');
    await checked('Instagram');
    await unchecked('TikTok');
    await unchecked('YouTube');
  });

  it('TC3: Content เลือก YouTube + TikTok → ติ๊กทั้งสองเท่านั้น', async () => {
    renderDialog(makeItem({ platform: 'youtube', platforms: ['youtube', 'tiktok'] }));
    await checked('YouTube');
    await checked('TikTok');
    await unchecked('Facebook');
    await unchecked('Instagram');
  });

  it('TC4: Content ที่ไม่มี Platform → แสดง Empty State (ห้าม fallback/ห้าม default Facebook)', async () => {
    renderDialog(makeItem({ platform: '', platforms: null }));
    await present('ยังไม่ได้กำหนด Platform สำหรับคอนเทนต์นี้');
    // ไม่มีรายการให้ติ๊กเลย → เป็นไปไม่ได้ที่จะมี platform ถูกเลือกโดยระบบ
    await waitFor(() => expect(screen.queryAllByRole('checkbox')).toHaveLength(0));
  });

  it('TC6: แก้ Facebook+Instagram → Facebook+TikTok → ติ๊ก Facebook+TikTok เท่านั้น (ไม่มี Instagram)', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: ['facebook', 'tiktok'] }));
    await checked('Facebook');
    await checked('TikTok');
    await unchecked('Instagram');
  });

  it('TC8: Content A=Facebook, B=Instagram+TikTok, C=YouTube — ไม่ปนกัน', async () => {
    const { unmount } = renderDialog(makeItem({ id: 'a', platform: 'facebook', platforms: ['facebook'] }));
    await checked('Facebook');
    await unchecked('Instagram');
    unmount();

    renderDialog(makeItem({ id: 'b', platform: 'instagram', platforms: ['instagram', 'tiktok'] }));
    await checked('Instagram');
    await checked('TikTok');
    await unchecked('Facebook');
    await unchecked('YouTube');
  });

  it('New content (existingItem=null) → แสดงตัวเลือกครบและยังไม่ติ๊กอะไรเลย', async () => {
    renderDialog(null);
    await unchecked('Facebook');
    await unchecked('Instagram');
    await unchecked('YouTube');
    await unchecked('TikTok');
    await waitFor(() =>
      expect(
        screen.getAllByRole('checkbox').filter(b => b.getAttribute('data-state') === 'checked'),
      ).toHaveLength(0),
    );
  });

  // API ส่ง platforms กลับมาเป็น JSON string (เพราะ SQL คืน TEXT) — Dialog ต้อง parse ได้
  it('platforms เป็น JSON string → ติ๊กเฉพาะ platform ที่ parse ออกมา', async () => {
    renderDialog(makeItem({ platform: 'facebook', platforms: '["facebook","instagram"]' }));
    await checked('Facebook');
    await checked('Instagram');
    await unchecked('TikTok');
    await unchecked('YouTube');
  });

  it('platforms เป็น comma string (legacy) → ติ๊กเฉพาะ platform ที่ split ออกมา', async () => {
    renderDialog(makeItem({ platform: 'youtube', platforms: 'youtube,tiktok' }));
    await checked('YouTube');
    await checked('TikTok');
    await unchecked('Facebook');
    await unchecked('Instagram');
  });
});
