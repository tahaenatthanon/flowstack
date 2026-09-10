import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentPlannerPage from '@/pages/ContentPlannerPage';
import { apiFetch } from '@/lib/api';
import type { PlanItem } from '@/components/content/types';

/**
 * Regression: `ContentPlannerPage.tsx` เคยเขียน fallback logic ของตัวเองใน
 * handleRequestAI/handleGenerate แทนการเรียก researchSeedTopic() ที่ docblock
 * ของฟังก์ชันนั้น (useResearchRun.ts) กำกับไว้ว่า "ทุก Generation Entry Point
 * ต้องเรียกฟังก์ชันนี้ ห้าม resolve seed เองซ้ำ" — ยืนยันด้วยการ mock apiFetch
 * ทั้งหมด (ไม่มี request ไหนแตะ backend/AI provider จริง ไม่เสีย credit)
 *
 * mock child components ทั้งหมด (ตามแบบ ResearchEntryPoints.test.tsx ที่ mock
 * ContentCardDialog เพื่อดัก props) เพื่อเรียก onEditItem/onGenerate/onRequestAI
 * ตรงๆ โดยไม่ต้องผ่าน Calendar/List UI ที่ซับซ้อน — onRequestAI ไม่ได้ถูกเรียก
 * จากปุ่มใดใน ContentCardDialog จริง (ปุ่ม "AI เขียนให้" ในนั้นใช้ handler
 * ภายในของตัวเอง) แต่เป็น callback contract ที่ ContentPlannerPage ส่งลงไป —
 * เทสต์นี้ยืนยันพฤติกรรมของ callback นั้นโดยตรง เหมือนที่ ResearchEntryPoints
 * ทำกับ ContentDetailView/ContentListTab
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
// confirm() ต้อง resolve true — handleGenerate เพิ่ม confirm gate ก่อนยิง generate-plan
// (ดู change confirm-before-content-create) เทสต์นี้ยืนยัน researchSeedTopic() ไม่ใช่ confirm gate
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));

vi.mock('@/components/content/BestTimeAnalyticsPanel', () => ({ BestTimeAnalyticsPanel: () => null }));

let capturedCalendar: Record<string, any> | null = null;
vi.mock('@/components/content/ContentPlannerCalendar', () => ({
  ContentPlannerCalendar: (props: Record<string, any>) => { capturedCalendar = props; return null; },
}));

let capturedList: Record<string, any> | null = null;
vi.mock('@/components/content/ContentItemList', () => ({
  ContentItemList: (props: Record<string, any>) => { capturedList = props; return null; },
}));

let capturedAI: Record<string, any> | null = null;
vi.mock('@/components/content/ContentPlannerAI', () => ({
  ContentPlannerAI: (props: Record<string, any>) => { capturedAI = props; return null; },
}));

let capturedCardDialog: Record<string, any> | null = null;
vi.mock('@/components/content/ContentCardDialog', () => ({
  ContentCardDialog: (props: Record<string, any>) => { capturedCardDialog = props; return null; },
}));

function makeItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id: 'item-1', plan_id: 'plan-1', day_label: '', day_order: 0,
    scheduled_date: '2026-09-10', platform: 'facebook', topic: 'หัวข้อปัจจุบัน',
    source_topic: 'หัวข้อต้นฉบับ', caption: '', image_brief: '',
    generated_image_url: null, image_gen_status: 'none', content_type: 'article',
    ...overrides,
  };
}

/** mock ทุก endpoint ที่หน้านี้เรียก (ผ่าน hooks และ handler โดยตรง) — ไม่มี request ไหนแตะ backend จริง */
function mockApi(opts: { plans?: any[]; generatePlanItems?: any[] } = {}) {
  const bodies: Record<string, any>[] = [];
  vi.mocked(apiFetch).mockImplementation(async (url: unknown, init?: any) => {
    const u = String(url);
    if (init?.body) bodies.push({ url: u, body: JSON.parse(init.body as string) });
    if (u.includes('action=plans')) return opts.plans ?? [];
    if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers') || u.includes('action=channels')) return [];
    if (u.includes('ai-settings.php')) return {};
    if (u.includes('action=analytics-posting-times')) return { has_data: false, by_day: {}, by_hour: {}, recommendations: [] };
    if (u.includes('action=generate-plan')) return { id: 'plan-new', title: 'แผนใหม่', items: opts.generatePlanItems ?? [] };
    if (u.includes('action=plan-item-date')) return { updated: true };
    if (u.includes('content-research.php?action=fetch')) return { job_id: 'job-1', status: 'done' };
    if (u.includes('content-research.php?action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
    if (u.includes('generate-article')) return { article: { title: 'ok' } };
    return {};
  });
  return bodies;
}

const findBody = (bodies: Record<string, any>[], fragment: string) =>
  bodies.find(b => b.url.includes(fragment))?.body;

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentPlannerPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedCalendar = null;
  capturedList = null;
  capturedAI = null;
  capturedCardDialog = null;
});

// handleRequestAI อ่าน `editingItem` ตรงๆ (ไม่ใช่ selectedDateItems[0]) — ต้อง
// มาจาก List view's onEditItem (handleEditItemFromList) เท่านั้น การคลิกวันที่
// ใน Calendar (handleDateClick) ตั้ง editingItem เป็น null เสมอ จึงไม่ทำให้
// handleRequestAI เห็น item จริง ต้องสลับไป List view ก่อนเสมอ
function switchToListViewAndEdit(item: PlanItem) {
  fireEvent.click(screen.getByRole('button', { name: /รายการ/ }));
  return waitFor(() => expect(capturedList).not.toBeNull()).then(() => {
    capturedList!.onEditItem(item);
  });
}

describe('ContentPlannerPage — handleRequestAI ใช้ researchSeedTopic()', () => {
  it('มี source_topic → seed มาจาก source_topic ไม่ใช่ topic ที่แก้ไขใน dialog', async () => {
    const bodies = mockApi();
    renderPage();

    await switchToListViewAndEdit(makeItem({ source_topic: 'หัวข้อต้นฉบับ', topic: 'หัวข้อปัจจุบัน' }));

    await waitFor(() => expect(capturedCardDialog?.existingItem).toBeTruthy());
    await capturedCardDialog!.onRequestAI({ topic: 'หัวข้อที่ผู้ใช้แก้ไขใน dialog', platform: 'facebook', scheduled_date: '2026-09-10' });

    await waitFor(() => expect(findBody(bodies, 'action=fetch')).toBeTruthy());
    expect(findBody(bodies, 'action=fetch')!.seed_keyword).toBe('หัวข้อต้นฉบับ');
  });

  it('ไม่มี source_topic → fallback ไปใช้ topic ที่ dialog ส่งมา', async () => {
    const bodies = mockApi();
    renderPage();

    await switchToListViewAndEdit(makeItem({ source_topic: null, topic: 'หัวข้อปัจจุบัน' }));

    await waitFor(() => expect(capturedCardDialog?.existingItem).toBeTruthy());
    await capturedCardDialog!.onRequestAI({ topic: 'หัวข้อจาก dialog', platform: 'facebook', scheduled_date: '2026-09-10' });

    await waitFor(() => expect(findBody(bodies, 'action=fetch')).toBeTruthy());
    expect(findBody(bodies, 'action=fetch')!.seed_keyword).toBe('หัวข้อจาก dialog');
  });

  it('ไม่มีทั้ง source_topic และ topic ที่ dialog ส่งมา → แจ้ง toast ไม่เรียก Research', async () => {
    mockApi();
    renderPage();

    await switchToListViewAndEdit(makeItem({ source_topic: null, topic: '' }));

    await waitFor(() => expect(capturedCardDialog?.existingItem).toBeTruthy());
    await capturedCardDialog!.onRequestAI({ topic: '   ', platform: 'facebook', scheduled_date: '2026-09-10' });

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(vi.mocked(apiFetch).mock.calls.some(([u]) => String(u).includes('action=fetch'))).toBe(false);
  });
});

describe('ContentPlannerPage — handleGenerate ใช้ researchSeedTopic() ต่อ item', () => {
  it('แต่ละ item ได้ seed ตามกติกาเดิม: source_topic ก่อน, ไม่มีจึง fallback ไป topic ของ item นั้น', async () => {
    const bodies = mockApi({
      generatePlanItems: [
        { id: 'gen-item-1', topic: 'หัวข้อ AI คิดให้ 1', source_topic: 'หัวข้อผู้ใช้พิมพ์' },
        { id: 'gen-item-2', topic: 'หัวข้อ AI คิดให้ 2', source_topic: '' },
      ],
    });
    renderPage();

    await waitFor(() => expect(capturedAI).not.toBeNull());
    await capturedAI!.onGenerate({
      trigger_command: 'วางแผนคอนเทนต์', skill_id: null, brand_context_ids: [],
      plan_type: 'weekly', plan_start: null, plan_end: null, platforms: [],
    });

    await waitFor(() => {
      const fetchBodies = vi.mocked(apiFetch).mock.calls.filter(([u]) => String(u).includes('action=fetch'));
      expect(fetchBodies.length).toBe(2);
    });

    const fetchCalls = vi.mocked(apiFetch).mock.calls
      .filter(([u]) => String(u).includes('action=fetch'))
      .map(([, init]) => JSON.parse((init as any).body));

    // item 1 มี source_topic → ใช้ source_topic
    expect(fetchCalls.find(b => b.content_item_id === 'gen-item-1')?.seed_keyword).toBe('หัวข้อผู้ใช้พิมพ์');
    // item 2 ไม่มี source_topic → fallback ไป topic ของ item นั้นเอง (ไม่ใช่ของ item อื่น)
    expect(fetchCalls.find(b => b.content_item_id === 'gen-item-2')?.seed_keyword).toBe('หัวข้อ AI คิดให้ 2');
    void bodies;
  });

  it('item ที่ไม่มีทั้ง source_topic และ topic → ข้าม ไม่เรียก Research ให้ item นั้น', async () => {
    mockApi({
      generatePlanItems: [
        { id: 'gen-item-1', topic: '', source_topic: '' },
        { id: 'gen-item-2', topic: 'หัวข้อปกติ', source_topic: '' },
      ],
    });
    renderPage();

    await waitFor(() => expect(capturedAI).not.toBeNull());
    await capturedAI!.onGenerate({
      trigger_command: 'วางแผนคอนเทนต์', skill_id: null, brand_context_ids: [],
      plan_type: 'weekly', plan_start: null, plan_end: null, platforms: [],
    });

    await waitFor(() => {
      const fetchBodies = vi.mocked(apiFetch).mock.calls.filter(([u]) => String(u).includes('action=fetch'));
      expect(fetchBodies.length).toBe(1);
    });

    const fetchCalls = vi.mocked(apiFetch).mock.calls
      .filter(([u]) => String(u).includes('action=fetch'))
      .map(([, init]) => JSON.parse((init as any).body));
    expect(fetchCalls[0].content_item_id).toBe('gen-item-2');
  });
});
