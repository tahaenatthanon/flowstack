import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { GlobalKpiRow } from '@/components/content/overview/GlobalKpiRow';
import { ProductionSection } from '@/components/content/overview/ProductionSection';
import { PublishingSection } from '@/components/content/overview/PublishingSection';
import { ResultsSection } from '@/components/content/overview/ResultsSection';
import ContentDashboardPage from '@/pages/ContentDashboardPage';
import type { ContentOverview } from '@/components/content/types';

/**
 * openspec/changes/content-overview-bi-summary — แท็บภาพรวมแบบ End-to-End + BI Summary
 * (spec content-overview-bi) ค่าตัวอย่างเป็นตัวเลขจาก spec และข้อมูล local
 */

// recharts ResponsiveContainer ใช้ ResizeObserver ซึ่ง jsdom ไม่มี
beforeAll(() => {
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function makeOverview(overrides: Partial<ContentOverview> = {}): ContentOverview {
  return {
    kpi: {
      engagement: 20,
      breakdown: { reactions: 12, comments: 3, shares: 1, clicks: 4 },
      posts: 4,
      avg_per_post: 5,
      followers: { current: 3, platforms: ['facebook'] },
      platforms: ['facebook'],
    },
    funnel: {
      stages: [
        { key: 'created', count: 86, pct: 100 },
        { key: 'requested', count: 31, pct: 36 },
        { key: 'approved', count: 24, pct: 77.4 },
        { key: 'published', count: 18, pct: 75 },
      ],
      in_progress: 68,
    },
    status_summary: { total: 58, by_status: { published: 12, approved: 9, pending_approval: 3, revision: 14, draft: 19, rejected: 1 } },
    unpublished_aging: { d0_7: 8, d8_30: 20, d31_90: 0, d90_plus: 18, total: 46 },
    publishing_health: {
      pending: 0, sent: 19, failed: 2, success_rate: 90.5, platforms: ['facebook'],
    },
    schedule_summary: {
      today: { date: '2026-09-25', rows: [{ time: '10:00', platform: 'facebook', count: 2 }] },
      tomorrow: { date: '2026-09-26', rows: [] },
    },
    engagement_trend: [
      { month: '2026-04', engagement: null, posts: 0 },
      { month: '2026-09', engagement: 20, posts: 4 },
    ],
    platform_performance: [{ platform: 'facebook', posts: 4, engagement: 20, avg_per_post: 5, followers: 3 }],
    queue: { pending: 0, processing: 0, sent: 0, failed: 0, overdue_pending: 0, total: 0, failures: [] },
    aging: { d0_7: 0, d8_30: 0, d31_90: 0, d90_plus: 0, total: 0, oldest_days: null, items: [] },
    ...overrides,
  };
}

describe('Global KPI (ข้อมูลทั้งหมด)', () => {
  it('แสดงค่าจากข้อมูลทั้งหมด ผู้ติดตามเพจเป็นยอดล่าสุดพร้อมครอบคลุม Facebook', () => {
    render(<GlobalKpiRow kpi={makeOverview().kpi} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/ระดับเพจ · ครอบคลุม: Facebook/)).toBeInTheDocument();
    expect(screen.getByText(/ข้อมูลทั้งหมดตั้งแต่เริ่มใช้งาน/)).toBeInTheDocument();
  });

  it('ไม่มีการเปรียบเทียบ: ไม่มี ▲/▼ หรือ % เปลี่ยนแปลง', () => {
    const { container } = render(<GlobalKpiRow kpi={makeOverview().kpi} />);
    expect(container.textContent).not.toMatch(/[▲▼]|เทียบ/);
  });

  it('ไม่มีโพสต์ที่วัดได้ → Engagement, Posts และ Avg/Post แสดง "—" ไม่ใช่ 0', () => {
    const kpi = { ...makeOverview().kpi, engagement: null, breakdown: null, posts: 0, avg_per_post: null };
    render(<GlobalKpiRow kpi={kpi} />);
    expect(screen.getAllByText('—')).toHaveLength(3);
    // ยังไม่มีตัวเลขแยก → บอกสูตรแทน
    expect(screen.getByText('Reaction + Comment + Share + Click')).toBeInTheDocument();
  });

  it('Engagement แสดงส่วนประกอบ Reaction/Comment/Share/Click ที่รวมกันเท่ากับค่าหลัก และไม่มี Save', () => {
    const { container } = render(<GlobalKpiRow kpi={makeOverview().kpi} />);
    expect(screen.getByText('Reaction 12 · Comment 3 · Share 1 · Click 4')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Save/);
  });
});

describe('การผลิต', () => {
  it('funnel แสดงจำนวน % ต่อขั้น คำกำกับขั้นอนุมัติ และยังอยู่ระหว่างทาง', () => {
    render(<ProductionSection data={makeOverview()} />);
    expect(screen.getByText('86')).toBeInTheDocument();
    expect(screen.getByText('77.4%')).toBeInTheDocument();
    expect(screen.getByText('(อนุมัติอยู่ ณ ตอนนี้)')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
  });

  it('ยังไม่มีคอนเทนต์ → ข้อความว่าง ไม่แสดง 0%', () => {
    const data = makeOverview({ funnel: { stages: [{ key: 'created', count: 0, pct: null }], in_progress: 0 } });
    render(<ProductionSection data={data} />);
    expect(screen.getByText('ยังไม่มีคอนเทนต์')).toBeInTheDocument();
  });

  it('สถานะคอนเทนต์และคอนเทนต์ที่ยังไม่เผยแพร่มีป้าย "ณ ตอนนี้"', () => {
    render(<ProductionSection data={makeOverview()} />);
    expect(screen.getAllByText('ณ ตอนนี้')).toHaveLength(2);
    expect(screen.getByText('46')).toBeInTheDocument();
  });

  it('payload ไม่ครบไม่ทำให้ crash', () => {
    render(<ProductionSection data={{} as ContentOverview} />);
    // funnel และกล่องสถานะว่างพร้อมกันเมื่อไม่มีข้อมูล
    expect(screen.getAllByText('ยังไม่มีคอนเทนต์')).toHaveLength(2);
  });
});

describe('การเผยแพร่', () => {
  it('Success Rate และสรุปกำหนดการจัดกลุ่มเวลา/แพลตฟอร์ม', () => {
    render(<PublishingSection data={makeOverview()} />);
    expect(screen.getByText('90.5%')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('2 รายการ')).toBeInTheDocument();
    expect(screen.getByText('ไม่มีกำหนดการ')).toBeInTheDocument();
    expect(screen.getByText('วันนี้–พรุ่งนี้')).toBeInTheDocument();
  });

  it('ไม่มีรายการจบ → Success Rate แสดง "—"', () => {
    const data = makeOverview();
    data.publishing_health = { ...data.publishing_health, sent: 0, failed: 0, success_rate: null };
    render(<PublishingSection data={data} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

describe('ผลลัพธ์', () => {
  it('ตาราง Platform Performance แสดงคอลัมน์ครบ', () => {
    render(<ResultsSection data={makeOverview()} />);
    for (const h of ['Platform', 'Posts', 'Engagement', 'Avg/Post', 'Followers']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
  });

  it('ยังไม่มีโพสต์ที่วัดได้ → ข้อความว่างแทนกราฟ', () => {
    const data = makeOverview({ engagement_trend: [{ month: '2026-09', engagement: null, posts: 0 }], platform_performance: [] });
    render(<ResultsSection data={data} />);
    expect(screen.getByText('ยังไม่มีโพสต์ที่วัดผลได้')).toBeInTheDocument();
    expect(screen.getByText('ยังไม่มีข้อมูลแพลตฟอร์ม')).toBeInTheDocument();
  });
});

// ── หน้าเต็ม: ลำดับส่วน + ปุ่มลองส่งใหม่ในส่วนงานที่ต้องจัดการ ──
const api = vi.hoisted(() => ({ calls: [] as { url: string; init?: RequestInit }[], overview: null as unknown }));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string, init?: RequestInit) => {
    api.calls.push({ url, init });
    if (url.startsWith('/content-items.php')) return [];
    if (url.includes('action=overdue_count')) return { count: 0 };
    if (url.includes('content-analytics.php?action=overview')) return api.overview;
    if (url.startsWith('/content-publish.php')) return { results: [{ status: 'sent' }] };
    return [];
  }),
}));

describe('แท็บภาพรวม (หน้าเต็ม)', () => {
  beforeEach(() => { api.calls = []; });

  it('เรียงส่วนตาม spec และปุ่ม "ลองส่งใหม่" ในส่วนงานที่ต้องจัดการเรียก send_now', async () => {
    api.overview = makeOverview({
      queue: {
        pending: 0, processing: 0, sent: 0, failed: 1, overdue_pending: 0, total: 1,
        failures: [{ id: 'q1', content_id: 'c1', channel_id: 'ch1', title: 'โพสต์ล้มเหลว', channel_name: 'Facebook', platform: 'facebook', error_msg: 'token', retry_count: 0, scheduled_at: '2026-09-20 10:00:00' }],
      },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/content-dashboard']}><ContentDashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    const headings = (await screen.findAllByRole('heading', { level: 2 })).map(h => h.textContent);
    expect(headings).toEqual(['1.การผลิต', '2.การเผยแพร่', '3.ผลลัพธ์', 'งานที่ต้องจัดการ']);

    fireEvent.click(await screen.findByRole('button', { name: /ลองส่งใหม่/ }));
    await waitFor(() => {
      const call = api.calls.find(c => c.url === '/content-publish.php');
      expect(call).toBeDefined();
      expect(JSON.parse(String(call!.init?.body))).toMatchObject({ action: 'send_now', content_id: 'c1', channel_ids: ['ch1'] });
    });
  });
});
