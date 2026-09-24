import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentDetailView from '@/components/content/views/ContentDetailView';
import type { ContentItem } from '@/components/content/types';

/**
 * Change: quality-required-tiers (post-archive follow-up)
 * รายงาน: ปุ่ม "อนุมัติ" ในรายละเอียดคอนเทนต์ (ContentDetailView, เปิดจากแท็บรายการอนุมัติ)
 * ต้องตรวจ SEO/AEO และบล็อกเมื่อ Required ไม่ผ่านเหมือนปุ่ม "อนุมัติ" ในแถวของหน้า list (ContentApprovalTab)
 */

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async (url: string) => {
  if (url.includes('action=seo-checklist')) {
    return {
      score: 40, gate: 'failed', seo_gate_enabled: 1,
      rules: [{ key: 'seo_title', status: 'failed', tier: 'required', level: 'fail', weight: 8, score: 0, critical: true, message: 'SEO title ยาวเกิน 60 ตัวอักษร' }],
    };
  }
  if (url.includes('action=aeo-checklist')) return { score: 90, gate: 'passed', rules: [] };
  return {};
}) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/content/views/ContentArticleView', () => ({ default: () => null }));
vi.mock('@/components/content/views/ContentVideoView', () => ({ default: () => null }));
vi.mock('@/components/content/SchedulePublishDialog', () => ({ SchedulePublishDialog: () => null }));
vi.mock('@/components/content/ContentCardDialog', () => ({ ContentCardDialog: () => null }));

function makeApprovalItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'detail-1', title: 'บทความรออนุมัติ', type: 'article', status: 'pending_approval',
    views: 0, likes: 0, created_at: '2026-09-24T00:00:00Z', platform: 'wordpress', platforms: '["wordpress"]',
    article_content: null,
    ...overrides,
  } as ContentItem;
}

function renderDetail(item: ContentItem) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentDetailView item={item} onBack={() => {}} context="approval" />
    </QueryClientProvider>,
  );
}

describe('ContentDetailView — ปุ่ม "อนุมัติ" ทำงานเหมือนหน้า list (ContentApprovalTab)', () => {
  it('ตรวจ SEO/AEO ก่อนอนุมัติ แสดงข้อบังคับที่ไม่ผ่าน และปิดปุ่มยืนยันเมื่อ Required failed', async () => {
    renderDetail(makeApprovalItem());
    fireEvent.click(await screen.findByRole('button', { name: /อนุมัติ/ }));
    await waitFor(() => expect(screen.getAllByText('SEO title ยาวเกิน 60 ตัวอักษร').length).toBeGreaterThan(0));
    expect(screen.getByText(/ยังไม่ผ่านข้อบังคับ SEO\/AEO/)).toBeTruthy();
    const confirmBtn = screen.getByRole('button', { name: 'ยืนยันการอนุมัติ' }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('วิดีโอไม่ต้องตรวจ SEO/AEO — ปุ่มยืนยันใช้งานได้ทันที', async () => {
    renderDetail(makeApprovalItem({ id: 'detail-2', type: 'video' }));
    fireEvent.click(await screen.findByRole('button', { name: /อนุมัติ/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'ยืนยันการอนุมัติ' })).toBeTruthy());
    expect((screen.getByRole('button', { name: 'ยืนยันการอนุมัติ' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('SEO title ยาวเกิน 60 ตัวอักษร')).toBeNull();
  });
});
