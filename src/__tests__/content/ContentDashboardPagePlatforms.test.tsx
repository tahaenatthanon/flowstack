import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ContentDashboardPage from '@/pages/ContentDashboardPage';
import type { ContentItem, StaleContentItem } from '@/components/content/types';

/**
 * openspec/changes/fix-content-dashboard-platform-badge — การ์ด "คอนเทนต์ค้างท่อ"
 * และ "เนื้อหาล่าสุด" ของ ContentDashboardPage เคย lookup PLATFORM_MAP[item.platform]
 * ตรงๆ ด้วยค่าดิบ ซึ่งเป็นสตริงรวมหลายแพลตฟอร์มคั่นด้วย comma เมื่อ item มีหลาย
 * แพลตฟอร์ม ทำให้ไม่แสดง badge แพลตฟอร์มใดๆ เลย — เปลี่ยนมาใช้ PlatformBadgeList
 */

const mockAssets = { none: 0, generating: 0, done: 0, failed: 0 };

function makeItem(overrides: Partial<ContentItem>): ContentItem {
  return {
    id: 'a1', title: 'บทความทดสอบ', type: 'article', status: 'draft',
    views: 0, likes: 0, created_at: '2026-09-04T00:00:00Z',
    platform: null, platforms: null,
    ...overrides,
  } as ContentItem;
}

const state = vi.hoisted(() => ({
  items: [] as ContentItem[],
  agingItems: [] as StaleContentItem[],
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    if (url.startsWith('/content-items.php')) return state.items;
    if (url.includes('action=overdue_count')) return { count: 0 };
    if (url.includes('action=all-schedules')) return [];
    if (url.includes('action=channels-connection-status')) return [];
    if (url.includes('action=channels')) return [];
    if (url.includes('content-analytics.php?action=overview')) {
      return {
        queue: { pending: 0, processing: 0, sent: 0, failed: 0, overdue_pending: 0, total: 0, failures: [] },
        funnel: { created: 0, requested: 0, approved: 0, published: 0 },
        aging: {
          d0_7: state.agingItems.length, d8_30: 0, d31_90: 0, d90_plus: 0,
          total: state.agingItems.length, oldest_days: state.agingItems.length > 0 ? 1 : null,
          items: state.agingItems,
        },
        assets: { image: mockAssets, video: mockAssets },
      };
    }
    return {};
  }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  state.items = [];
  state.agingItems = [];
});

describe('ContentDashboardPage — platform badges', () => {
  it('การ์ด "เนื้อหาล่าสุด": item ที่มีหลายแพลตฟอร์มแสดง badge แยกครบทุกอัน', async () => {
    state.items = [makeItem({ id: 'r1', title: 'มีหลายแพลตฟอร์ม', platform: 'facebook,linkedin', platforms: ['facebook', 'linkedin'] })];
    wrap(<ContentDashboardPage />);

    expect(await screen.findByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.queryByText('facebook,linkedin')).not.toBeInTheDocument();
  });

  it('การ์ด "เนื้อหาล่าสุด": item ที่มีแพลตฟอร์มเดียวแสดง badge เดียว', async () => {
    state.items = [makeItem({ id: 'r2', title: 'แพลตฟอร์มเดียว', platform: 'facebook', platforms: null })];
    wrap(<ContentDashboardPage />);

    expect(await screen.findByText('Facebook')).toBeInTheDocument();
  });

  it('การ์ด "เนื้อหาล่าสุด": item ที่ไม่มีแพลตฟอร์มแสดง "-" เหมือนเดิม', async () => {
    state.items = [makeItem({ id: 'r3', title: 'ไม่มีแพลตฟอร์ม', platform: null, platforms: null })];
    wrap(<ContentDashboardPage />);

    await screen.findByText('ไม่มีแพลตฟอร์ม');
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByText(/facebook/i)).not.toBeInTheDocument();
  });

  it('การ์ด "คอนเทนต์ค้างท่อ": item ที่มีหลายแพลตฟอร์มแสดง badge แยกครบทุกอัน', async () => {
    state.agingItems = [{ id: 'g1', title: 'ค้างท่อหลายแพลตฟอร์ม', status: 'draft', platform: 'facebook,linkedin', age_days: 10 }];
    wrap(<ContentDashboardPage />);

    expect(await screen.findByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.queryByText('facebook,linkedin')).not.toBeInTheDocument();
  });

  it('การ์ด "คอนเทนต์ค้างท่อ": item ที่ไม่มีแพลตฟอร์มไม่แสดง badge แพลตฟอร์มใดๆ', async () => {
    state.agingItems = [{ id: 'g2', title: 'ค้างท่อไม่มีแพลตฟอร์ม', status: 'draft', platform: null, age_days: 5 }];
    wrap(<ContentDashboardPage />);

    await screen.findByText('ค้างท่อไม่มีแพลตฟอร์ม');
    expect(screen.queryByText(/facebook/i)).not.toBeInTheDocument();
  });
});
