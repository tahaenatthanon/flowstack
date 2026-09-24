import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentDetailView from '@/components/content/views/ContentDetailView';
import type { ContentItem } from '@/components/content/types';

/**
 * Change: approval-seo-advisory
 * SEO/AEO แสดงทันทีตอนเปิดดูเนื้อหาฝั่งอนุมัติ (ไม่ต้องกด "อนุมัติ" ก่อน) และไม่บล็อกปุ่มอนุมัติ
 * อีกต่อไป — ต่างจากพฤติกรรมเดิมของ change quality-required-tiers ที่ไฟล์นี้เคยทดสอบ
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

describe('ContentDetailView — SEO/AEO เป็นข้อมูลประกอบการตัดสินใจ ไม่บล็อกการอนุมัติ', () => {
  it('เปิดดูเนื้อหาเห็น SEO/AEO ทันที โดยไม่ต้องกด "อนุมัติ" ก่อน', async () => {
    renderDetail(makeApprovalItem());
    await waitFor(() => expect(screen.getAllByText('SEO title ยาวเกิน 60 ตัวอักษร').length).toBeGreaterThan(0));
    // ยังไม่ได้กด "อนุมัติ" เลย — ไม่มี dialog ยืนยันเปิดอยู่
    expect(screen.queryByRole('button', { name: 'ยืนยันการอนุมัติ' })).toBeNull();
  });

  it('กด "อนุมัติ" ได้แม้ Required failed — dialog ไม่มี checklist ซ้ำ และปุ่มยืนยันกดได้เสมอ', async () => {
    renderDetail(makeApprovalItem());
    await waitFor(() => expect(screen.getAllByText('SEO title ยาวเกิน 60 ตัวอักษร').length).toBeGreaterThan(0));

    fireEvent.click(await screen.findByRole('button', { name: /^อนุมัติ$/ }));
    const confirmBtn = await screen.findByRole('button', { name: 'ยืนยันการอนุมัติ' }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
    expect(screen.queryByText(/ยังไม่ผ่านข้อบังคับ SEO\/AEO/)).toBeNull();
    // checklist ยังอยู่แค่ 1 ชุด (ที่เนื้อหาหลัก) ไม่ถูกวาดซ้ำใน dialog
    expect(screen.getAllByText('SEO title ยาวเกิน 60 ตัวอักษร').length).toBe(1);
  });

  it('วิดีโอไม่ต้องตรวจ SEO/AEO — ไม่ fetch และปุ่มยืนยันใช้งานได้ทันที', async () => {
    renderDetail(makeApprovalItem({ id: 'detail-2', type: 'video' }));
    fireEvent.click(await screen.findByRole('button', { name: /^อนุมัติ$/ }));
    const confirmBtn = await screen.findByRole('button', { name: 'ยืนยันการอนุมัติ' }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
    expect(screen.queryByText('SEO title ยาวเกิน 60 ตัวอักษร')).toBeNull();
  });
});
