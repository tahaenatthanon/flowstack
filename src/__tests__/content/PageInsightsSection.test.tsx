import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageInsightsView } from '@/components/content/PageInsightsSection';
import type { PageInsights } from '@/components/content/types';

/**
 * openspec/changes/facebook-page-insights-dashboard — ส่วนข้อมูลเพจ 5 ส่วนใน sub-tab โซเชียล
 * ค่าทดสอบใช้ตัวเลขจริงจากเพจทดสอบ (25 ก.ย. 2026)
 */

// recharts ResponsiveContainer ใช้ ResizeObserver ซึ่ง jsdom ไม่มี — stub เฉพาะไฟล์นี้
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function makeData(overrides: Partial<PageInsights> = {}): PageInsights {
  return {
    range: { from: '2026-08-29', to: '2026-09-25' },
    has_data: true,
    last_fetched_at: '2026-09-25 10:45:55',
    totals: {
      // backend ให้ค่าล่าสุดแล้ว (ค่ารายวัน 2 ทุกวัน → ผลรวม 56 ซึ่งผิด)
      page_follows: 5,
      page_views_total: 8,
      page_media_view: 244,
      page_daily_follows: 3,
      page_daily_unfollows: 0,
      page_actions_post_reactions_total: 15,
      page_actions_post_reactions_like_total: 15,
      page_actions_post_reactions_love_total: 0,
      page_actions_post_reactions_wow_total: 0,
      page_actions_post_reactions_haha_total: 0,
      page_video_views: 13,
      page_video_views_organic: 13,
      page_video_views_paid: 0,
      page_video_view_time: 292773,
      page_total_media_view_unique: null,
    },
    breakdown: { page_actions_post_reactions_total: { like: 15 } },
    first: { page_follows: 2 },
    daily: [
      { date: '2026-09-24', page_daily_follows: 1, page_daily_unfollows: 0 },
      { date: '2026-09-25', page_daily_follows: 2, page_daily_unfollows: 0 },
    ],
    ...overrides,
  };
}

describe('PageInsightsView', () => {
  it('มีข้อมูล: แสดงครบ 5 ส่วน', () => {
    render(<PageInsightsView data={makeData()} />);
    expect(screen.getByText('ผู้ติดตาม')).toBeInTheDocument();
    expect(screen.getByText('เข้าชมเพจ')).toBeInTheDocument();
    expect(screen.getByText('การดูสื่อ')).toBeInTheDocument();
    expect(screen.getByText('การติดตาม / เลิกติดตาม รายวัน')).toBeInTheDocument();
    expect(screen.getByText('Reaction ของโพสต์')).toBeInTheDocument();
    expect(screen.getByText('วิดีโอ — จำนวนการดู')).toBeInTheDocument();
    expect(screen.getByText('วิดีโอ — ระยะเวลาการดู')).toBeInTheDocument();
  });

  it('ผู้ติดตามใช้ค่าจาก totals และแสดงผลต่างเทียบวันแรก', () => {
    render(<PageInsightsView data={makeData()} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('+3 ในช่วงนี้')).toBeInTheDocument();
  });

  it('เวลาดูวิดีโอแปลงจากมิลลิวินาทีเป็นนาที', () => {
    render(<PageInsightsView data={makeData()} />);
    expect(screen.getByText('4.9 นาที')).toBeInTheDocument();
  });

  it('ยังไม่มีข้อมูลเพจ: แสดง empty state ไม่แสดงเลข 0', () => {
    render(<PageInsightsView data={makeData({ has_data: false, totals: {}, daily: [] })} />);
    expect(screen.getByText(/ยังไม่มีข้อมูลเพจ/)).toBeInTheDocument();
    expect(screen.queryByText('การดูสื่อ')).not.toBeInTheDocument();
  });

  it('ไม่มี reaction ในช่วง: แสดงข้อความว่างแทนกราฟ', () => {
    const data = makeData();
    data.totals = { ...data.totals, page_actions_post_reactions_total: 0, page_actions_post_reactions_like_total: 0 };
    render(<PageInsightsView data={data} />);
    expect(screen.getByText('ยังไม่มี reaction ในช่วงวันที่ที่เลือก')).toBeInTheDocument();
  });
});
