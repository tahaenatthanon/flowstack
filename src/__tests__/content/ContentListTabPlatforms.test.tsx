import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentListTab from '@/components/content/tabs/ContentListTab';
import type { ContentItem } from '@/components/content/types';

/**
 * Requirement part 1 — จุด "List" (ContentListTab)
 * ตรวจว่าข้อมูล platforms ถูกส่งผ่านไปยัง Dialog (asPlanItem) และถูก persist
 * กลับไปใน PUT (handleSave) ครบถ้วน ไม่ปนกัน ไม่ default เป็น facebook
 */

const toast = vi.fn();

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => ({})) }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));
vi.mock('@/components/content/SchedulePublishDialog', () => ({ SchedulePublishDialog: () => null }));

// ดัก props ของ ContentCardDialog เพื่อตรวจว่า asPlanItem ส่ง platforms ผ่านครบ
let capturedDialog: any = null;
vi.mock('@/components/content/ContentCardDialog', () => ({
  ContentCardDialog: (props: any) => {
    capturedDialog = props;
    return null;
  },
}));

// ควบคุมข้อมูลที่ useContentItems คืนกลับ (เลียนแบบ API ที่คืน platforms เป็น JSON string)
const mockItems = vi.hoisted(() => ({ value: [] as ContentItem[] }));
vi.mock('@/hooks/useContent', () => ({
  useContentItems: () => ({ data: mockItems.value, isLoading: false }),
}));

import { apiFetch } from '@/lib/api';

function makeItem(overrides: Partial<ContentItem>): ContentItem {
  return {
    id: 'a1',
    title: 'Test Content',
    type: 'article',
    status: 'draft',
    views: 0,
    likes: 0,
    created_at: '2026-09-04T00:00:00Z',
    platform: 'facebook',
    platforms: null,
    ...overrides,
  } as ContentItem;
}

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentListTab />
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
  mockItems.value = [];
});

describe('ContentListTab — platforms persist & ไม่ปนกัน', () => {
  it('TC2 (List): Facebook+Instagram → asPlanItem ส่ง platforms ครบ ไม่ปน', async () => {
    mockItems.value = [makeItem({ id: 'b', title: 'โพสต์สองแพลตฟอร์ม', platform: 'facebook', platforms: '["facebook","instagram"]' })];
    renderTab();
    fireEvent.click(await screen.findByText('โพสต์สองแพลตฟอร์ม'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    expect(capturedDialog.existingItem.platforms).toBe('["facebook","instagram"]');
    expect(capturedDialog.existingItem.platform).toBe('facebook');
  });

  it('TC4 (List): ไม่มี platform → platform เป็น "" และ platforms เป็น null (ห้าม default facebook)', async () => {
    mockItems.value = [makeItem({ id: 'd', title: 'โพสต์ไม่มีแพลตฟอร์ม', platform: '', platforms: null })];
    renderTab();
    fireEvent.click(await screen.findByText('โพสต์ไม่มีแพลตฟอร์ม'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    expect(capturedDialog.existingItem.platform).toBe('');
    expect(capturedDialog.existingItem.platforms).toBeNull();
  });

  it('TC6 (List): handleSave ส่ง platforms array ครบใน PUT body', async () => {
    mockItems.value = [makeItem({ id: 'e', title: 'แก้แพลตฟอร์ม', platform: 'facebook', platforms: '["facebook","instagram"]' })];
    renderTab();
    fireEvent.click(await screen.findByText('แก้แพลตฟอร์ม'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());

    // จำลองผู้ใช้แก้เป็น Facebook + TikTok แล้วกด Save
    await capturedDialog.onSave({
      topic: 'แก้แพลตฟอร์ม',
      caption: '',
      platform: 'facebook,tiktok',
      platforms: ['facebook', 'tiktok'],
      scheduled_date: '2026-09-04',
    });

    const bodies = putBodies();
    expect(bodies.length).toBe(1);
    expect(bodies[0].platforms).toEqual(['facebook', 'tiktok']);
  });

  it('TC5 (List): Save → รีเฟรช → เปิดใหม่ platforms ยังตรงกับที่บันทึก (round-trip)', async () => {
    // รอบแรก: แก้เป็น youtube + tiktok แล้ว save
    mockItems.value = [makeItem({ id: 'f', title: 'ทดสอบรีเฟรช', platform: 'facebook', platforms: '["facebook"]' })];
    const { unmount } = renderTab();
    fireEvent.click(await screen.findByText('ทดสอบรีเฟรช'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    await capturedDialog.onSave({
      topic: 'ทดสอบรีเฟรช',
      caption: '',
      platform: 'youtube,tiktok',
      platforms: ['youtube', 'tiktok'],
      scheduled_date: '2026-09-04',
    });
    unmount();

    // รอบสอง: "refresh" — API คืน platforms ที่เพิ่งบันทึกเป็น JSON string
    mockItems.value = [makeItem({ id: 'f', title: 'ทดสอบรีเฟรช', platform: 'youtube', platforms: '["youtube","tiktok"]' })];
    capturedDialog = null;
    renderTab();
    fireEvent.click(await screen.findByText('ทดสอบรีเฟรช'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    expect(capturedDialog.existingItem.platforms).toBe('["youtube","tiktok"]');
    expect(capturedDialog.existingItem.platform).toBe('youtube');
  });

  it('TC8 (List): หลาย Content ไม่ปนกัน — แต่ละ item ส่ง platform ของตัวเอง', async () => {
    mockItems.value = [
      makeItem({ id: 'a', title: 'Content A', platform: 'facebook', platforms: '["facebook"]' }),
      makeItem({ id: 'b', title: 'Content B', platform: 'instagram', platforms: '["instagram","tiktok"]' }),
      makeItem({ id: 'c', title: 'Content C', platform: 'youtube', platforms: '["youtube"]' }),
    ];
    renderTab();
    await screen.findByText('Content A');

    fireEvent.click(screen.getByText('Content A'));
    await waitFor(() => expect(capturedDialog.existingItem.id).toBe('a'));
    expect(capturedDialog.existingItem.platforms).toBe('["facebook"]');

    fireEvent.click(screen.getByText('Content B'));
    await waitFor(() => expect(capturedDialog.existingItem.id).toBe('b'));
    expect(capturedDialog.existingItem.platforms).toBe('["instagram","tiktok"]');

    fireEvent.click(screen.getByText('Content C'));
    await waitFor(() => expect(capturedDialog.existingItem.id).toBe('c'));
    expect(capturedDialog.existingItem.platforms).toBe('["youtube"]');
  });
});
