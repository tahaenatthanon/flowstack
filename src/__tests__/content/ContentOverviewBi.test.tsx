import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { GlobalKpiRow } from '@/components/content/overview/GlobalKpiRow';
import { ProductionSection } from '@/components/content/overview/ProductionSection';
import { PublishingSection } from '@/components/content/overview/PublishingSection';
import { ResultsSection } from '@/components/content/overview/ResultsSection';
import ContentDashboardPage from '@/pages/ContentDashboardPage';
import type { ContentOverview } from '@/components/content/types';

/**
 * แท็บภาพรวมแบบ End-to-End + BI Summary (spec content-overview-bi, change
 * remove-overview-work-section) ค่าตัวอย่างเป็นตัวเลขจาก spec และข้อมูล local
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
      failures: [
        { id: 'q1', title: 'ต้นสัปดาห์เปลี่ยนงานซ้ำซากให้เป็นเรื่องง่ายด้วย AI', channel_name: 'Facebook', platform: 'facebook', error_msg: 'SEO gate: ไม่ผ่านเกณฑ์ SEO 1 ข้อ', retry_count: 0, scheduled_at: '2026-09-02 12:26:00' },
        { id: 'q2', title: 'ทำความรู้จัก Duckkit AI Portal', channel_name: 'เพจทดสอบ', platform: 'facebook', error_msg: null, retry_count: 2, scheduled_at: '2026-09-05 20:40:00' },
      ],
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
    ...overrides,
  };
}

describe('Global KPI (ข้อมูลทั้งหมด)', () => {
  it('แสดงค่าจากข้อมูลทั้งหมด ผู้ติดตามเพจเป็นยอดล่าสุดพร้อมครอบคลุม Facebook', () => {
    render(<GlobalKpiRow kpi={makeOverview().kpi} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/ระดับเพจ · ครอบคลุม: Facebook/)).toBeInTheDocument();
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
  it('funnel แสดงจำนวน % ต่อขั้น และยังอยู่ระหว่างทาง', () => {
    render(<ProductionSection data={makeOverview()} />);
    expect(screen.getByText('กระบวนการผลิตคอนเทนต์')).toBeInTheDocument();
    expect(screen.getByText('86')).toBeInTheDocument();
    expect(screen.getByText('77.4%')).toBeInTheDocument();
    expect(screen.getByText('68')).toBeInTheDocument();
  });

  it('ยังไม่มีคอนเทนต์ → ข้อความว่าง ไม่แสดง 0%', () => {
    const data = makeOverview({ funnel: { stages: [{ key: 'created', count: 0, pct: null }], in_progress: 0 } });
    render(<ProductionSection data={data} />);
    expect(screen.getByText('ยังไม่มีคอนเทนต์')).toBeInTheDocument();
  });

  it('กล่องสถานะคอนเทนต์และคอนเทนต์ที่ยังไม่เผยแพร่แสดงจำนวนรวม', () => {
    render(<ProductionSection data={makeOverview()} />);
    expect(screen.getByText('สถานะคอนเทนต์')).toBeInTheDocument();
    expect(screen.getByText('คอนเทนต์ที่ยังไม่เผยแพร่')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
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
  });

  it('ไม่มีรายการจบ → Success Rate แสดง "—" และไม่มีรายการที่ล้มเหลว', () => {
    const data = makeOverview();
    data.publishing_health = { ...data.publishing_health, sent: 0, failed: 0, success_rate: null, failures: [] };
    render(<PublishingSection data={data} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('การเผยแพร่ที่ล้มเหลว')).not.toBeInTheDocument();
  });

  it('รายการที่ล้มเหลวใต้ Success Rate แสดงชื่อ แพลตฟอร์ม สาเหตุ และสถานะ โดยไม่มีปุ่ม', () => {
    render(<PublishingSection data={makeOverview()} />);
    expect(screen.getByText('การเผยแพร่ที่ล้มเหลว')).toBeInTheDocument();
    expect(screen.getByText('ต้นสัปดาห์เปลี่ยนงานซ้ำซากให้เป็นเรื่องง่ายด้วย AI')).toBeInTheDocument();
    expect(screen.getAllByText('Facebook').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('SEO gate: ไม่ผ่านเกณฑ์ SEO 1 ข้อ')).toBeInTheDocument();
    expect(screen.getByText(/ยังไม่ลองส่งใหม่ · กำหนดส่ง/)).toBeInTheDocument();
    // error_msg ว่าง → ไม่ทราบสาเหตุ · retry > 0 → ลองส่งแล้ว N ครั้ง · ชื่อช่องทางไม่ซ้ำแพลตฟอร์มจึงแสดง
    expect(screen.getByText('ไม่ทราบสาเหตุ')).toBeInTheDocument();
    expect(screen.getByText(/ลองส่งแล้ว 2 ครั้ง/)).toBeInTheDocument();
    expect(screen.getByText('ช่องทาง: เพจทดสอบ')).toBeInTheDocument();
    expect(screen.queryByText('ช่องทาง: Facebook')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // แสดงครบทุกรายการ → ไม่มี "แสดง N จาก M"
    expect(screen.queryByText(/^แสดง \d+ จาก/)).not.toBeInTheDocument();
  });

  it('ล้มเหลวมากกว่าที่แสดง → "แสดง N จาก M รายการ"', () => {
    const data = makeOverview();
    data.publishing_health = { ...data.publishing_health, failed: 14 };
    render(<PublishingSection data={data} />);
    expect(screen.getByText('แสดง 2 จาก 14 รายการ')).toBeInTheDocument();
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

// ── หน้าเต็ม: เหลือ 4 ส่วน ไม่มีส่วนงานที่ต้องจัดการ (remove-overview-work-section) ──
const api = vi.hoisted(() => ({ calls: [] as { url: string; init?: RequestInit }[], overview: null as unknown }));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string, init?: RequestInit) => {
    api.calls.push({ url, init });
    if (url.startsWith('/content-items.php')) return [];
    if (url.includes('content-analytics.php?action=overview')) return api.overview;
    return [];
  }),
}));

describe('แท็บภาพรวม (หน้าเต็ม)', () => {
  beforeEach(() => { api.calls = []; });

  it('เรียง KPI → การผลิต → การเผยแพร่ → ผลลัพธ์ และไม่มีส่วนงานที่ต้องจัดการ แถบเตือน หรือปุ่มลองส่งใหม่', async () => {
    api.overview = makeOverview();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/content-dashboard']}><ContentDashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    );

    // ไม่มีหัวข้อส่วนแล้ว — ยืนยันลำดับจากชื่อกล่องแรกของแต่ละส่วน
    const order = ['ผู้ติดตามเพจ', 'กระบวนการผลิตคอนเทนต์', 'ภาพรวมการเผยแพร่', 'แนวโน้มการมีส่วนร่วม'];
    const els = await Promise.all(order.map(t => screen.findByText(t)));
    for (let i = 1; i < els.length; i++) {
      expect(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    // รายการที่ล้มเหลวอยู่ในกล่องภาพรวมการเผยแพร่แทน
    expect(screen.getByText('การเผยแพร่ที่ล้มเหลว')).toBeInTheDocument();
    expect(screen.queryByText('งานที่ต้องจัดการ')).not.toBeInTheDocument();
    expect(screen.queryByText(/เลยกำหนดส่ง/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ลองส่งใหม่/ })).not.toBeInTheDocument();
    // ไม่เรียก API ของกล่องงานเดิมอีก
    expect(api.calls.some(c => c.url.includes('overdue_count') || c.url.includes('all-schedules'))).toBe(false);
  });
});
