import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import type { PlanItem } from '@/components/content/types';
import { apiFetch } from '@/lib/api';

/**
 * spec: video-creation-options / content-video-ui-section — "ลำดับฉากแก้ไขบทพากย์ได้ใต้แต่ละฉาก"
 * บทพากย์อยู่ใต้แต่ละฉากใน "ลำดับฉาก" ทั้งก่อน/หลังมี scenes และไม่มีช่องซ้ำใน scene card ของ dialog
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

function makeItem(art: Record<string, unknown>): PlanItem {
  return {
    id: 'item-1', plan_id: 'plan-1', day_label: 'Day 1', day_order: 1, scheduled_date: '2026-09-23',
    platform: 'tiktok', platforms: ['tiktok'], topic: 'วิดีโอทดสอบ', caption: 'แคปชั่น', image_brief: '',
    generated_image_url: null, image_gen_status: '', content_type: 'video',
    video_aspect_ratio: '9:16', video_resolution: '720p',
    article_content: JSON.stringify({ title: 'วิดีโอทดสอบ', scripts: { tiktok: 'Hook' }, ...art }),
  };
}

function renderDialog(existingItem: PlanItem, onSave = vi.fn(async () => {})) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ContentCardDialog open onOpenChange={() => {}} date={null} planId="plan-1"
        existingItem={existingItem} onSave={onSave} />
    </QueryClientProvider>,
  );
  return onSave;
}

const narrationFields = () => screen.queryAllByLabelText(/^บทพากย์ฉากที่ \d+$/);

beforeEach(() => { vi.clearAllMocks(); });

describe('ContentCardDialog — บทพากย์ใน "ลำดับฉาก"', () => {
  it('ก่อนมี scenes: แสดงบทพากย์ใต้แต่ละฉาก และบันทึกลง visuals[i].narration โดย visual/motion เดิมไม่เปลี่ยน', async () => {
    const onSave = renderDialog(makeItem({
      visuals: [
        { visual: 'ภาพบาริสต้า', motion: 'zoom in', narration: 'ลูกค้าทักแชทแต่ไม่มีเวลาตอบ?', duration_sec: 8 },
        { visual: 'ภาพหน้าจอแชท', motion: 'pan', narration: 'ข้อแรก ตอบไว', duration_sec: 8 },
      ],
    }));

    await waitFor(() => expect(narrationFields()).toHaveLength(2));
    expect(screen.getByDisplayValue('ลูกค้าทักแชทแต่ไม่มีเวลาตอบ?')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('บทพากย์ฉากที่ 2'), { target: { value: 'ข้อแรก ตอบไวใน 3 วินาที' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const art = JSON.parse((onSave.mock.calls[0][0] as { article_content: string }).article_content);
    expect(art.visuals[1]).toEqual({ visual: 'ภาพหน้าจอแชท', motion: 'pan', narration: 'ข้อแรก ตอบไวใน 3 วินาที', duration_sec: 8 });
    expect(art.visuals[0].narration).toBe('ลูกค้าทักแชทแต่ไม่มีเวลาตอบ?');
  });

  it('ก่อนมี scenes: visuals แบบ string เดิม + เพิ่มบทพากย์ → แปลงเป็น object {visual, narration}', async () => {
    const onSave = renderDialog(makeItem({ visuals: ['Scene 1: ภาพแก้วกาแฟ', 'Scene 2: ภาพร้าน'] }));

    await waitFor(() => expect(narrationFields()).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('บทพากย์ฉากที่ 1'), { target: { value: 'กาแฟแก้วนี้หอมมาก' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const art = JSON.parse((onSave.mock.calls[0][0] as { article_content: string }).article_content);
    expect(art.visuals[0]).toEqual({ visual: 'Scene 1: ภาพแก้วกาแฟ', narration: 'กาแฟแก้วนี้หอมมาก' });
    expect(art.visuals[1]).toBe('Scene 2: ภาพร้าน');
  });

  it('หลังมี scenes: บทพากย์อยู่ในลำดับฉากที่เดียว (ไม่ซ้ำใน scene card) และบันทึกผ่าน update-scene', async () => {
    renderDialog(makeItem({
      scenes: [
        { visual_prompt: 'ภาพบาริสต้า', video_prompt: 'zoom in', narration: 'ลูกค้าทักแชท?', image_gen_status: 'done', image_url: '/a.jpg', duration_sec: 8 },
        { visual_prompt: 'ภาพหน้าจอแชท', video_prompt: 'pan', narration: '', image_gen_status: 'done', image_url: '/b.jpg', duration_sec: 8 },
      ],
    }));

    await waitFor(() => expect(narrationFields()).toHaveLength(2));
    // scene card ใน dialog ไม่มีตัวนับบทพากย์ของตัวเอง — มีแค่ชุดเดียวจากลำดับฉาก
    expect(screen.getAllByTestId('narration-count-0')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('บทพากย์ฉากที่ 2'), { target: { value: 'ข้อแรก ตอบไว' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));

    await waitFor(() => {
      const call = vi.mocked(apiFetch).mock.calls.find(([url]) => String(url).includes('action=update-scene'));
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toMatchObject({ item_id: 'item-1', scene_index: 1, narration: 'ข้อแรก ตอบไว' });
    });
  });

  it('บทพากย์ยาวเกิน 100 ตัวอักษร → ตัวนับและคำเตือน', async () => {
    renderDialog(makeItem({ visuals: [{ visual: 'ภาพ', motion: 'm', narration: 'ก'.repeat(130) }] }));
    await waitFor(() => expect(screen.getByTestId('narration-count-0').textContent).toBe('130/100'));
    expect(within(screen.getByTestId('narration-count-0').parentElement!.parentElement!).getByText(/อาจพูดไม่จบใน 8 วินาที/)).toBeTruthy();
  });
});
