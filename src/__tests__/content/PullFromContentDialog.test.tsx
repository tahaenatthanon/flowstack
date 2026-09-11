import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PullFromContentDialog from '@/components/content/dialogs/PullFromContentDialog';
import type { ContentItem } from '@/components/content/types';

/**
 * openspec/changes/pull-from-content-platform-badge-fix — PullFromContentDialog
 * เคย lookup PLATFORM_MAP[item.platform] ตรงๆ ด้วยค่าดิบ ซึ่งเป็นสตริงรวม
 * หลายแพลตฟอร์มคั่นด้วย comma เมื่อ item เลือกไว้หลายแพลตฟอร์ม ทำให้ badge
 * แสดงเป็น <span> ว่างเปล่า (ไม่มีสี ไม่มีข้อความ) — เปลี่ยนมาใช้ PlatformBadgeList
 */

const mockItems = vi.hoisted(() => ({ value: [] as ContentItem[] }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => mockItems.value) }));

function makeItem(overrides: Partial<ContentItem>): ContentItem {
  return {
    id: 'a1',
    title: 'บทความทดสอบ',
    type: 'article',
    status: 'draft',
    views: 0,
    likes: 0,
    created_at: '2026-09-04T00:00:00Z',
    platform: null,
    platforms: null,
    ...overrides,
  } as ContentItem;
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockItems.value = [];
});

describe('PullFromContentDialog', () => {
  it('renders dialog title and search input', () => {
    wrap(<PullFromContentDialog open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByText('ดึงจาก Content')).toBeTruthy();
    expect(screen.getByPlaceholderText('ค้นหาบทความ...')).toBeTruthy();
  });

  it('item ที่มีหลายแพลตฟอร์มแสดง badge แยกครบทุกอัน', async () => {
    mockItems.value = [makeItem({ title: 'มีหลายแพลตฟอร์ม', platform: 'facebook,linkedin', platforms: ['facebook', 'linkedin'] })];
    wrap(<PullFromContentDialog open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.queryByText('facebook,linkedin')).not.toBeInTheDocument();
  });

  it('item ที่มีแพลตฟอร์มเดียวแสดง badge เดียว', async () => {
    mockItems.value = [makeItem({ title: 'แพลตฟอร์มเดียว', platform: 'facebook', platforms: null })];
    wrap(<PullFromContentDialog open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    expect(await screen.findByText('Facebook')).toBeInTheDocument();
  });

  it('item ที่ไม่มีแพลตฟอร์มไม่แสดง badge ใดๆ', async () => {
    mockItems.value = [makeItem({ title: 'ไม่มีแพลตฟอร์ม', platform: null, platforms: null })];
    wrap(<PullFromContentDialog open={true} onOpenChange={vi.fn()} onSelect={vi.fn()} />);

    await screen.findByText('ไม่มีแพลตฟอร์ม');
    expect(screen.queryByText(/facebook/i)).not.toBeInTheDocument();
  });
});
