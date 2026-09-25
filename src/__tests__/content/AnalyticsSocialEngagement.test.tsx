import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SocialEngagementSummary } from '@/components/content/types';

// ส่วนที่ไม่เกี่ยวกับ engagement ระดับโพสต์ — ตัดออกเพื่อไม่ต้องยิง API
vi.mock('@/hooks/useContent', () => ({
  usePublishChannels: () => ({ data: [] }),
  useChannelConnectionStatus: () => ({ data: [] }),
}));
vi.mock('@/components/content/PageInsightsSection', () => ({
  PageInsightsSection: () => null,
}));

import { AnalyticsSocialTab } from '@/components/content/AnalyticsSocialTab';

// recharts ResponsiveContainer ต้องใช้ ResizeObserver ซึ่ง jsdom ไม่มี
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function makeSocial(): SocialEngagementSummary {
  return {
    platforms: ['facebook'],
    posts: 2,
    views: 32,
    likes: 7,
    comments: 1,
    shares: 0,
    clicks: 4,
    engagement: 12,
    last_fetched_at: null,
    has_data: true,
    by_platform: [
      { platform: 'facebook', posts: 2, views: 32, likes: 7, comments: 1, shares: 0, clicks: 4, engagement: 12 },
    ],
    monthly: [
      { month: '2026-09', posts: 2, views: 32, likes: 7, comments: 1, shares: 0, clicks: 4, engagement: 12 },
    ],
    top_posts: [
      {
        content_item_id: 'a', title: 'โพสต์รูป', platform: 'facebook', published_at: '2026-09-01 10:00:00',
        views: 0, likes: 7, comments: 1, shares: 0, clicks: 2, engagement: 10,
        video_avg_watch_ms: null, published_url: null,
      },
      {
        // ยังไม่เคยซิงก์ comment/share (แถวเก่า) → "—"
        content_item_id: 'b', title: 'วิดีโอ', platform: 'facebook', published_at: '2026-09-02 10:00:00',
        views: 32, likes: 0, comments: null, shares: null, clicks: 2, engagement: 2,
        video_avg_watch_ms: 3000, published_url: null,
      },
    ],
  };
}

function renderTab() {
  return render(
    <MemoryRouter>
      <AnalyticsSocialTab social={makeSocial()} />
    </MemoryRouter>,
  );
}

describe('แท็บวิเคราะห์ › โซเชียล — Engagement นิยามเดียวกับภาพรวม', () => {
  it('การ์ดแยก Reaction/Comment/Share/Click และยอดเล่นวิดีโอแสดงแยก ไม่นับรวม', () => {
    renderTab();
    expect(screen.getByText('Engagement รวม')).toBeInTheDocument();
    expect(screen.getByText('Reaction + Comment + Share + Click')).toBeInTheDocument();
    for (const label of ['Comment', 'Share', 'Click']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('ยอดเล่นวิดีโอ').length).toBeGreaterThan(0);
    expect(screen.getByText('แสดงแยก ไม่นับใน Engagement')).toBeInTheDocument();
    // engagement 12 ≠ views + likes (39)
    expect(screen.getByText('12', { selector: 'div' })).toBeInTheDocument();
    expect(screen.queryByText(/วิว \+ ไลก์/)).not.toBeInTheDocument();
  });

  it('ตารางโพสต์เด่นมีคอลัมน์ Comment/Share และค่าที่ยังไม่รายงานแสดง "—"', () => {
    renderTab();
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(
      expect.arrayContaining(['Reaction', 'Comment', 'Share', 'Click', 'เล่นวิดีโอ', 'Engagement']),
    );
    const videoRow = within(table).getByText('วิดีโอ').closest('tr')!;
    expect(within(videoRow).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
