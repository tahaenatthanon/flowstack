import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { apiFetch } from '@/lib/api';
import type { PlanItem } from '@/components/content/types';

/**
 * Change: confirm-before-ai-content-write
 *
 * ปุ่ม "AI เขียนให้" ใน ContentCardDialog ต้องแสดงกล่องยืนยันก่อนเรียก
 * runResearch() จริง — เทสต์นี้ใช้ <ConfirmProvider> จริง (ไม่ mock useConfirm)
 * ต่างจาก ContentCardDialogResearch/Scripts/Platforms.test.tsx ที่ mock ให้
 * resolve true เพื่อทดสอบ behavior หลัง confirm แทน — apiFetch ยัง mock เต็ม
 * รูปแบบเหมือนเดิม ไม่มี request ไหนแตะ backend/AI provider จริง ไม่เสีย credit
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
  useQualityRecheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

function makeItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id: 'item-1',
    plan_id: 'plan-1',
    day_label: 'Day 1',
    day_order: 1,
    scheduled_date: '2026-09-04',
    platform: 'facebook',
    platforms: ['facebook'],
    topic: 'หัวข้อที่ AI เขียนใหม่',
    source_topic: 'หัวข้อทดสอบ confirm gate',
    caption: '',
    image_brief: '',
    generated_image_url: null,
    image_gen_status: '',
    ...overrides,
  };
}

function mockApi() {
  vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
    const u = String(url);
    if (u.includes('knowledge-base')) return [];
    if (u.includes('action=fetch')) return { job_id: 'job-1', status: 'done' };
    if (u.includes('action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
    if (u.includes('generate-article')) return { article: { title: 'ok', html: '<p>ok</p>' }, seo: { score: 95 }, aeo: { score: 90 } };
    return {};
  });
}

function renderDialog(item: PlanItem = makeItem()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmProvider>
        <ContentCardDialog
          open
          onOpenChange={() => {}}
          date={null}
          planId="plan-1"
          existingItem={item}
          onSave={vi.fn(async () => {})}
        />
      </ConfirmProvider>
    </QueryClientProvider>,
  );
}

const fetchCalled = () =>
  vi.mocked(apiFetch).mock.calls.some(([u]) => String(u).includes('content-research.php?action=fetch'));

async function clickAIButton() {
  fireEvent.click(await screen.findByRole('button', { name: /AI เขียนให้/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ContentCardDialog — confirm gate ก่อน AI เขียนให้', () => {
  it('กดปุ่ม "AI เขียนให้" ต้องเห็นกล่องยืนยันก่อน ไม่เรียก research ทันที', async () => {
    mockApi();
    renderDialog(makeItem({ source_topic: 'หัวข้อต้นฉบับ', topic: 'หัวข้อที่แก้ในฟอร์ม', platforms: ['facebook', 'tiktok'] }));

    await clickAIButton();

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/ยืนยันให้ AI เขียนเนื้อหา/)).toBeTruthy();
    // ข้อความต้องใช้ source_topic (research seed) ไม่ใช่ topic ที่แก้ในฟอร์ม
    expect(within(dialog).getByText(/หัวข้อต้นฉบับ/)).toBeTruthy();
    expect(fetchCalled()).toBe(false);
  });

  it('กดยกเลิกในกล่องยืนยัน — ไม่เรียก research และไม่เข้า loading state', async () => {
    mockApi();
    renderDialog();

    await clickAIButton();
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยกเลิก' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(fetchCalled()).toBe(false);
    // ปุ่มไม่เข้า loading state ("กำลัง...") — ยังโชว์ "AI เขียนให้" เหมือนเดิม
    expect(screen.getByRole('button', { name: /^AI เขียนให้$/ })).toBeInTheDocument();
  });

  it('กดยืนยันในกล่อง — เรียก research ตามปกติ', async () => {
    mockApi();
    renderDialog();

    await clickAIButton();
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'ยืนยันและให้ AI เขียน' }));

    await waitFor(() => expect(fetchCalled()).toBe(true));
  });
});
