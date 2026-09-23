import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import type { PlanItem } from '@/components/content/types';
import { apiFetch } from '@/lib/api';

/**
 * kie-video-adapter (task 5.5) — ContentCardDialog ต้อง poll `video-status` ระหว่างกำลังสร้างวิดีโอ
 * (เดิมมีแค่ ContentVideoView ที่ poll ทำให้กดสร้างจาก dialog แล้วค้าง "กำลังสร้างวิดีโอ..." ตลอด)
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
  useQualityRecheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

function makeItem(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: 'item-1', plan_id: 'plan-1', day_label: 'Day 1', day_order: 1, scheduled_date: '2026-09-23',
    platform: 'tiktok', platforms: ['tiktok'], topic: 'วิดีโอทดสอบ', caption: '', image_brief: '',
    generated_image_url: null, image_gen_status: '', content_type: 'video',
    article_content: JSON.stringify({ title: 'วิดีโอทดสอบ', scenes: [{ visual_prompt: 'x', video_prompt: 'y' }] }),
    ...overrides,
  };
}

function renderDialog(existingItem: PlanItem) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentCardDialog open onOpenChange={() => {}} date={null} planId="plan-1"
        existingItem={existingItem} onSave={vi.fn(async () => {})} />
    </QueryClientProvider>,
  );
}

const statusCalls = () => vi.mocked(apiFetch).mock.calls.filter(([url]) => String(url).includes('action=video-status'));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => { vi.useRealTimers(); });

describe('ContentCardDialog — poll สถานะวิดีโอ', () => {
  it('กำลังสร้าง → poll video-status ทุก 5 วิ และหยุดเมื่อเสร็จพร้อมแจ้งผล', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) =>
      String(url).includes('action=video-status') ? { status: 'done', video_url: '/uploads/content/videos/x.mp4' } : {});
    renderDialog(makeItem({ video_gen_status: 'generating', video_job_id: 'task-1' }));

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(statusCalls()).toHaveLength(1);
    expect(String(statusCalls()[0][0])).toContain('item_id=item-1');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'สร้างวิดีโอสำเร็จ!' }));

    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(statusCalls()).toHaveLength(1); // หยุด poll แล้ว
  });

  it('ล้มเหลว → แจ้ง error จาก backend และหยุด poll', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) =>
      String(url).includes('action=video-status') ? { status: 'failed', error: 'content policy' } : {});
    renderDialog(makeItem({ video_gen_status: 'generating', video_job_id: 'task-1' }));

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'สร้างวิดีโอไม่สำเร็จ', description: 'content policy' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(statusCalls()).toHaveLength(1);
  });

  it('ยังกำลังสร้าง → poll ต่อไปเรื่อยๆ', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: string) =>
      String(url).includes('action=video-status') ? { status: 'generating', video_job_id: 'task-1' } : {});
    renderDialog(makeItem({ video_gen_status: 'generating', video_job_id: 'task-1' }));

    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(statusCalls()).toHaveLength(3);
  });

  it('ไม่ได้กำลังสร้าง → ไม่ poll', async () => {
    renderDialog(makeItem({ video_gen_status: 'done', video_url: '/uploads/content/videos/x.mp4', video_job_id: 'task-1' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(statusCalls()).toHaveLength(0);
  });
});
