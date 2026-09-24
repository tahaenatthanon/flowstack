import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import QualityChecklist from '@/components/content/QualityChecklist';
import type { PlanItem, SeoRule } from '@/components/content/types';

/**
 * Change: quality-required-tiers
 * spec: quality-required-gate — "แสดงผล SEO/AEO แยก Required และ Recommended"
 * spec: content-quality-recheck — ปุ่ม "ตรวจ SEO/AEO ใหม่" ปิดเมื่อยังไม่บันทึก
 * (ปุ่ม "อนุมัติ" ของ ContentDetailView อยู่ใน ContentDetailViewApprovalGate.test.tsx แยกไฟล์
 *  เพราะต้อง mock ContentCardDialog ไปด้วย ซึ่งชนกับเทสต์ที่ render ContentCardDialog จริงในไฟล์นี้)
 */

const mutateAsync = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
  useQualityRecheck: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

const r = (key: string, status: SeoRule['status'], tier: SeoRule['tier'], message = `${key} ${status}`): SeoRule =>
  ({ key, status, tier, level: 'pass', weight: 10, score: 0, critical: false, message });

beforeEach(() => { vi.clearAllMocks(); });

describe('QualityChecklist — แยกข้อบังคับ / ข้อแนะนำ', () => {
  it('แยกสองกลุ่ม ผลรวมตัดสินจาก Required เท่านั้น และคะแนนเป็นข้อมูลรอง', () => {
    render(<QualityChecklist title="SEO" result={{ score: 55, rules: [
      r('seo_title', 'passed', 'required', 'SEO title เหมาะสม'),
      r('content_gap', 'failed', 'recommended', 'ไม่เติม content gaps'),
      r('meta_description', 'needs_improvement', 'required', 'meta สั้น'),
    ] }} />);
    const required = screen.getByTestId('quality-group-required');
    const recommended = screen.getByTestId('quality-group-recommended');
    expect(within(required).getByText('SEO title เหมาะสม')).toBeTruthy();
    expect(within(required).getByText('meta สั้น')).toBeTruthy();
    expect(within(recommended).getByText('ไม่เติม content gaps')).toBeTruthy();
    expect(within(recommended).getByText('ไม่ผ่าน')).toBeTruthy();
    const box = screen.getByTestId('quality-checklist-seo');
    expect(within(box).getAllByText('ผ่าน')[0]).toBeTruthy();
    expect(box.textContent).not.toContain('ติดข้อบังคับ');
    expect(box.textContent).toContain('55/100');
  });

  it('Required ที่ failed → "ไม่ผ่าน (ติดข้อบังคับ N ข้อ)"', () => {
    render(<QualityChecklist title="AEO" result={{ score: 90, rules: [
      r('direct_answer', 'failed', 'required'), r('structured_data', 'failed', 'required'), r('qa_structure', 'passed', 'recommended'),
    ] }} />);
    expect(screen.getByText('ไม่ผ่าน (ติดข้อบังคับ 2 ข้อ)')).toBeTruthy();
  });

  it('tier "optional" จากข้อมูลเดิมแสดงอยู่ในกลุ่มข้อแนะนำ', () => {
    render(<QualityChecklist title="SEO" result={{ score: 80, rules: [r('internal_linking', 'needs_improvement', 'optional', 'ควรมี internal link')] }} />);
    expect(within(screen.getByTestId('quality-group-recommended')).getByText('ควรมี internal link')).toBeTruthy();
    expect(screen.queryByTestId('quality-group-required')).toBeNull();
  });

  it('ยังไม่มีผล → "ยังไม่ได้ตรวจ"', () => {
    render(<QualityChecklist title="SEO" result={null} />);
    expect(screen.getByText('ยังไม่ได้ตรวจ')).toBeTruthy();
  });
});

function makeItem(): PlanItem {
  return {
    id: 'item-1', plan_id: 'plan-1', day_label: 'Day 1', day_order: 1, scheduled_date: '2026-09-24',
    platform: 'wordpress', platforms: ['wordpress'], topic: 'หัวข้อทดสอบ', caption: 'ข้อความสำรอง', image_brief: '',
    generated_image_url: null, image_gen_status: '', content_type: 'article',
    article_content: JSON.stringify({ title: 'หัวข้อทดสอบ', html: '<p>บทความ</p>' }),
  };
}

describe('ContentCardDialog — ปุ่ม "ตรวจ SEO/AEO ใหม่"', () => {
  it('ปิดเมื่อมีการแก้ไขที่ยังไม่บันทึก และกลับมาใช้ได้หลังบันทึก', async () => {
    mutateAsync.mockResolvedValue({
      seo: { score: 90, gate: 'passed', rules: [], seo_gate_enabled: 1 },
      aeo: { score: 90, gate: 'passed', rules: [] },
      quality_status: 'passed', failed_required: [], quality_checked_at: '2026-09-24 10:00:00',
    });
    const onSave = vi.fn(async () => {});
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ContentCardDialog open onOpenChange={() => {}} date={null} planId="plan-1" existingItem={makeItem()} onSave={onSave} />
      </QueryClientProvider>,
    );
    const btn = await screen.findByRole('button', { name: /ตรวจ SEO\/AEO ใหม่/ });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('button', { name: /^ตรวจ Quality$/ })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('หัวข้อคอนเทนต์...'), { target: { value: 'หัวข้อที่แก้แล้ว' } });
    expect((screen.getByRole('button', { name: /ตรวจ SEO\/AEO ใหม่/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('quality-recheck-save-first').textContent).toContain('บันทึกบทความก่อนตรวจ SEO/AEO');

    fireEvent.click(screen.getByRole('button', { name: /บันทึก/ }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await waitFor(() => expect((screen.getByRole('button', { name: /ตรวจ SEO\/AEO ใหม่/ }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByTestId('quality-recheck-save-first')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /ตรวจ SEO\/AEO ใหม่/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ item_id: 'item-1' }));
  });
});
