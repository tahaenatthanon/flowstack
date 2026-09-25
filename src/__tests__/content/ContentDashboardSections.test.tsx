import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ContentDashboardPage from '@/pages/ContentDashboardPage';

/**
 * openspec/changes/merge-campaign-analytics-into-dashboard — ปุ่มสลับส่วน คอนเทนต์/แคมเปญ
 * ของแดชบอร์ดการตลาด ผูกกับ URL `section` โดยไม่กระทบ `tab`/`view` เดิม
 */

const state = vi.hoisted(() => ({
  urls: [] as string[],
  // true = คำขอรายการคอนเทนต์ค้างไว้ไม่ตอบ (จำลองข้อมูลคอนเทนต์ยังโหลดไม่เสร็จ)
  contentPending: false,
}));


vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(async (url: string) => {
    state.urls.push(url);
    if (url.startsWith('/campaign-analytics.php')) {
      return {
        summary: { total_campaigns: 43, total_sent: 83, total_opens: 5, total_clicks: 1, avg_open_rate: 6, avg_click_rate: 1.2, ctor: 20 },
        status_breakdown: [], trends: [], top_campaigns: [], campaigns: [],
      };
    }
    if (url.startsWith('/content-items.php')) {
      if (state.contentPending) return new Promise(() => {});
      return [];
    }
    // payload ของส่วน BI ไม่จำเป็นต่อ test นี้ — component ต้องไม่ crash เมื่อกลุ่มไม่มา
    if (url.includes('content-analytics.php?action=overview')) return {};
    return [];
  }),
}));

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

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function wrap(initial: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <ContentDashboardPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  state.urls = [];
  state.contentPending = false;
});

describe('ContentDashboardPage — ส่วนคอนเทนต์/แคมเปญ', () => {
  it('ไม่มีพารามิเตอร์: แสดงส่วนคอนเทนต์ หัวข้อ "แดชบอร์ดคอนเทนต์" และไม่เรียก API แคมเปญ', async () => {
    wrap('/content-dashboard');
    // หัวข้อเปลี่ยนตามส่วน (marketing-dashboard-sections › หัวข้อหน้าเปลี่ยนตามส่วน)
    expect(await screen.findByText('แดชบอร์ดคอนเทนต์')).toBeInTheDocument();
    expect(await screen.findByText('ภาพรวมประสิทธิภาพการผลิต การเผยแพร่ และผลลัพธ์')).toBeInTheDocument();
    expect(state.urls.some(u => u.startsWith('/campaign-analytics.php'))).toBe(false);
  });

  it('?section=campaign: แสดงส่วนแคมเปญพร้อมตัวกรองช่วงเวลาและคำอธิบายของส่วน', async () => {
    wrap('/content-dashboard?section=campaign');
    expect(await screen.findByText('CTOR (คลิกต่อการเปิด)')).toBeInTheDocument();
    expect(screen.getByText('ผลการส่ง การเปิด และการคลิกของแคมเปญอีเมล')).toBeInTheDocument();
    expect(screen.getByText('แดชบอร์ดแคมเปญ')).toBeInTheDocument();
    expect(screen.getByText('30 วันล่าสุด')).toBeInTheDocument();
  });

  it('ส่วนแคมเปญไม่รอข้อมูลคอนเทนต์ที่ยังโหลดไม่เสร็จ', async () => {
    state.contentPending = true;
    wrap('/content-dashboard?section=campaign');
    expect(await screen.findByText('CTOR (คลิกต่อการเปิด)')).toBeInTheDocument();
    expect(screen.queryByText('กำลังโหลด...')).not.toBeInTheDocument();
  });

  it('กดปุ่ม "แคมเปญ" แล้ว URL เป็น section=campaign และกด "คอนเทนต์" แล้วล้างพารามิเตอร์', async () => {
    wrap('/content-dashboard?tab=analytics&view=social');
    fireEvent.click(await screen.findByRole('radio', { name: /แคมเปญ/ }));
    expect(screen.getByTestId('location').textContent).toBe('/content-dashboard?section=campaign');

    fireEvent.click(screen.getByRole('radio', { name: /คอนเทนต์/ }));
    expect(screen.getByTestId('location').textContent).toBe('/content-dashboard');
  });

  it('ลิงก์เดิม ?tab=analytics&view=social ยังเปิดแท็บวิเคราะห์ sub-tab โซเชียล', async () => {
    wrap('/content-dashboard?tab=analytics&view=social');
    const social = await screen.findByRole('tab', { name: /โซเชียล/ });
    expect(social).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('radio', { name: /คอนเทนต์/ })).toHaveAttribute('data-state', 'on');
  });
});
