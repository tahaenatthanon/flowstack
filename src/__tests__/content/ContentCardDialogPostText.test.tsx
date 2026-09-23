import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import type { PlanItem } from '@/components/content/types';

/**
 * Change: platform-post-text
 * spec: platform-post-text — "แก้ข้อความโพสต์ได้ใน ContentCardDialog" / "ชื่อเรียกข้อความโพสต์บนหน้าจอเป็นชุดเดียว"
 */

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
  useQualityRecheck: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

function makeItem(over: Partial<PlanItem> = {}, art: Record<string, unknown> = {}): PlanItem {
  return {
    id: 'item-1', plan_id: 'plan-1', day_label: 'Day 1', day_order: 1, scheduled_date: '2026-09-23',
    platform: 'facebook', platforms: ['facebook', 'instagram', 'lineoa', 'linkedin', 'twitter', 'wordpress', 'wix'],
    topic: 'ทำความรู้จัก Duckkit', caption: 'ข้อความสำรองของคอนเทนต์', image_brief: '',
    generated_image_url: null, image_gen_status: '', content_type: 'article',
    article_content: JSON.stringify({
      title: 'ชื่อบทความที่ AI ตั้ง', html: '<p>บทความ</p>',
      scripts: { facebook: 'ข้อความ Facebook', instagram: 'ข้อความ Instagram', youtube: 'ของ platform ที่ไม่ได้เลือก' },
      scenes: [{ id: 'sc_keep1', visual_prompt: 'ภาพ' }],
      ...art,
    }),
    ...over,
  };
}

function renderDialog(item: PlanItem, onSave = vi.fn(async () => {})) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ContentCardDialog open onOpenChange={() => {}} date={null} planId="plan-1" existingItem={item} onSave={onSave} />
    </QueryClientProvider>,
  );
  return onSave;
}

const tabNames = () => screen.getAllByRole('tab').map(t => t.textContent?.replace('⚠', '').trim());
const savedArticle = (onSave: ReturnType<typeof vi.fn>) =>
  JSON.parse((onSave.mock.calls[0][0] as { article_content: string }).article_content);

beforeEach(() => { vi.clearAllMocks(); });

describe('ContentCardDialog — ข้อความโพสต์แต่ละ Platform', () => {
  it('แสดงแท็บครบทุก platform โซเชียลที่เลือก ไม่มีเว็บ/CMS และใช้ชื่อใหม่', async () => {
    renderDialog(makeItem());
    await waitFor(() => expect(screen.getByText('ข้อความโพสต์แต่ละ Platform')).toBeTruthy());
    expect(screen.queryByText('Scripts สำหรับ Platform ที่เลือก')).toBeNull();
    expect(tabNames()).toEqual(['Facebook', 'Instagram', 'Line OA', 'LinkedIn', 'Twitter / X']);
    expect(screen.getByText('ข้อความโพสต์สำรอง')).toBeTruthy();
  });

  it('แท็บที่ยังไม่มีข้อความ → พิมพ์ได้ และบอกว่าจะใช้ข้อความโพสต์สำรอง', async () => {
    renderDialog(makeItem());
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBe(5));
    fireEvent.mouseDown(screen.getByRole('tab', { name: /LinkedIn/ }));
    const fallback = await screen.findByTestId('post-text-fallback-linkedin');
    expect(fallback.textContent).toContain('ยังไม่มีข้อความเฉพาะ');
    expect(fallback.textContent).toContain('ข้อความสำรองของคอนเทนต์');
    expect((screen.getByLabelText('ข้อความโพสต์ LinkedIn') as HTMLTextAreaElement).value).toBe('');
  });

  it('หัวข้อบรรทัดบนของแท็บเปลี่ยนตามช่อง "หัวข้อ"', async () => {
    renderDialog(makeItem());
    expect((await screen.findByTestId('post-text-title-facebook')).textContent).toBe('ทำความรู้จัก Duckkit');
    fireEvent.change(screen.getByPlaceholderText('หัวข้อคอนเทนต์...'), { target: { value: 'หัวข้อใหม่' } });
    expect(screen.getByTestId('post-text-title-facebook').textContent).toBe('หัวข้อใหม่');
  });

  it('แก้ข้อความแล้วบันทึก → scripts ใหม่, แท็บว่างไม่เขียน key, key อื่นและ scenes[].id คงเดิม', async () => {
    const onSave = renderDialog(makeItem());
    fireEvent.change(await screen.findByLabelText('ข้อความโพสต์ Facebook'), { target: { value: 'ข้อความ Facebook ใหม่' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const art = savedArticle(onSave);
    expect(art.scripts).toEqual({ facebook: 'ข้อความ Facebook ใหม่', instagram: 'ข้อความ Instagram', youtube: 'ของ platform ที่ไม่ได้เลือก' });
    expect(art.scenes[0].id).toBe('sc_keep1');
    expect(art.title).toBe('ชื่อบทความที่ AI ตั้ง');
  });

  it('ลบข้อความจนว่างแล้วบันทึก → ลบ key ของ platform นั้น (ตอนโพสต์ใช้ข้อความสำรอง)', async () => {
    const onSave = renderDialog(makeItem());
    fireEvent.change(await screen.findByLabelText('ข้อความโพสต์ Facebook'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(savedArticle(onSave).scripts.facebook).toBeUndefined();
  });

  it('Twitter แสดงตัวนับ (หัวข้อ + ข้อความ) และเตือนเมื่อเกิน 280 โดยยังบันทึกได้', async () => {
    const onSave = renderDialog(makeItem({ topic: 'หัวข้อ' }));
    await waitFor(() => expect(screen.getAllByRole('tab').length).toBe(5));
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Twitter/ }));
    fireEvent.change(await screen.findByLabelText('ข้อความโพสต์ Twitter / X'), { target: { value: 'ก'.repeat(300) } });
    const count = screen.getByTestId('post-text-twitter-count');
    expect(count.textContent).toContain('308/280'); // "หัวข้อ"(6) + "\n\n"(2) + 300
    expect(count.textContent).toContain('ยาวเกิน');
    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(savedArticle(onSave).scripts.twitter).toBe('ก'.repeat(300));
  });

  it('ไม่ได้แก้อะไร → ปุ่มบันทึกยังกดไม่ได้ (dirty-tracking รวมข้อความโพสต์)', async () => {
    renderDialog(makeItem());
    await screen.findByLabelText('ข้อความโพสต์ Facebook');
    expect((screen.getByRole('button', { name: /บันทึก/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('ข้อความโพสต์ Facebook'), { target: { value: 'x' } });
    expect((screen.getByRole('button', { name: /บันทึก/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
