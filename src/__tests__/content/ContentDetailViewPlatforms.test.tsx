import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentDetailView from '@/components/content/views/ContentDetailView';
import type { ContentItem } from '@/components/content/types';

/**
 * Requirement part 1 — จุด "Detail" (ContentDetailView)
 * ตรวจว่า platform ที่แสดงใน header และ platforms ที่ส่งเข้า Dialog ถูกต้อง
 * และ persist กลับไปใน PUT ครบถ้วน ไม่ default เป็น facebook
 */

const toast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/components/content/views/ContentArticleView', () => ({ default: () => null }));
vi.mock('@/components/content/views/ContentVideoView', () => ({ default: () => null }));
vi.mock('@/components/content/SchedulePublishDialog', () => ({ SchedulePublishDialog: () => null }));

let capturedDialog: any = null;
vi.mock('@/components/content/ContentCardDialog', () => ({
  ContentCardDialog: (props: any) => {
    capturedDialog = props;
    return null;
  },
}));

import { apiFetch } from '@/lib/api';

function makeItem(overrides: Partial<ContentItem>): ContentItem {
  return {
    id: 'a1',
    title: 'Detail Content',
    type: 'article',
    status: 'draft',
    views: 0,
    likes: 0,
    created_at: '2026-09-04T00:00:00Z',
    platform: 'facebook',
    platforms: null,
    article_content: null,
    ...overrides,
  } as ContentItem;
}

function renderDetail(item: ContentItem) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentDetailView item={item} onBack={() => {}} context="content" />
    </QueryClientProvider>,
  );
}

const putBodies = () =>
  vi.mocked(apiFetch).mock.calls
    .filter(([u, o]) => String(u).includes('content-items.php') && (o as any)?.method === 'PUT')
    .map(([, o]) => JSON.parse((o as any).body));

beforeEach(() => {
  vi.clearAllMocks();
  capturedDialog = null;
});

describe('ContentDetailView — platforms persist & ไม่ปนกัน', () => {
  it('TC2 (Detail): header แสดง Facebook+Instagram ครบ ไม่ปน', async () => {
    renderDetail(makeItem({ id: 'b', platform: 'facebook', platforms: '["facebook","instagram"]' }));
    expect(await screen.findByText('Facebook')).toBeTruthy();
    expect(screen.getByText('Instagram')).toBeTruthy();
    expect(screen.queryByText('TikTok')).toBeNull();
  });

  it('TC4 (Detail): ไม่มี platform → header ไม่แสดง Facebook (empty)', async () => {
    renderDetail(makeItem({ id: 'd', platform: '', platforms: null }));
    await screen.findByText('Detail Content');
    expect(screen.queryByText('Facebook')).toBeNull();
    expect(screen.queryByText('Instagram')).toBeNull();
  });

  it('TC4b (Detail): planItem ไม่ default platform เป็น facebook', async () => {
    renderDetail(makeItem({ id: 'd', platform: '', platforms: null }));
    fireEvent.click(await screen.findByRole('button', { name: /แก้ไข/ }));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    expect(capturedDialog.existingItem.platform).toBe('');
    expect(capturedDialog.existingItem.platforms).toBeNull();
  });

  it('TC6 (Detail): handleEditSave ส่ง platforms array ครบใน PUT body', async () => {
    renderDetail(makeItem({ id: 'e', platform: 'facebook', platforms: '["facebook","instagram"]' }));
    fireEvent.click(await screen.findByRole('button', { name: /แก้ไข/ }));
    await waitFor(() => expect(capturedDialog).not.toBeNull());

    await capturedDialog.onSave({
      topic: 'Detail Content',
      caption: '',
      platform: 'facebook,tiktok',
      platforms: ['facebook', 'tiktok'],
      scheduled_date: '2026-09-04',
    });

    const bodies = putBodies();
    expect(bodies.length).toBe(1);
    expect(bodies[0].platforms).toEqual(['facebook', 'tiktok']);
  });

  it('TC5 (Detail): Save → เปิดใหม่ platforms ยังตรงกับที่บันทึก (round-trip)', async () => {
    renderDetail(makeItem({ id: 'f', platform: 'youtube', platforms: '["youtube","tiktok"]' }));
    fireEvent.click(await screen.findByRole('button', { name: /แก้ไข/ }));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    expect(capturedDialog.existingItem.platforms).toBe('["youtube","tiktok"]');
    expect(capturedDialog.existingItem.platform).toBe('youtube');
  });
});
