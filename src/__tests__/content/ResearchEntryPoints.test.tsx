import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContentDetailView from '@/components/content/views/ContentDetailView';
import ContentListTab from '@/components/content/tabs/ContentListTab';
import { apiFetch } from '@/lib/api';
import type { ContentItem } from '@/components/content/types';

/**
 * Mandatory Research flow ที่ Generation Entry Point (TC-13)
 *   Fetch/Reuse → Fallback ถ้า Fetch fail → Analyze → Generate
 *
 * ครอบ 2 Entry Point ที่เรียก Research เองนอก ContentCardDialog:
 *   - ContentDetailView (ปุ่ม "สร้างเนื้อหา AI" + planItem ที่ส่งเข้า Dialog)
 *   - ContentListTab   (asPlanItem + onRequestAI)
 *
 * ContentCardDialog มีเทสต์ของตัวเองใน ContentCardDialogResearch.test.tsx
 * QuickCreateDialog มีเทสต์ของตัวเองใน QuickCreateDialog.research.test.tsx
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/content/views/ContentArticleView', () => ({ default: () => null }));
vi.mock('@/components/content/views/ContentVideoView', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));
vi.mock('@/components/content/SchedulePublishDialog', () => ({ SchedulePublishDialog: () => null }));

// ดัก props ของ ContentCardDialog เพื่อตรวจว่า Entry Point ส่ง source_topic ผ่านเข้าไปครบ
let capturedDialog: Record<string, any> | null = null;
vi.mock('@/components/content/ContentCardDialog', () => ({
  ContentCardDialog: (props: Record<string, any>) => {
    capturedDialog = props;
    return null;
  },
}));

const mockItems = vi.hoisted(() => ({ value: [] as ContentItem[] }));
vi.mock('@/hooks/useContent', () => ({
  useContentItems: () => ({ data: mockItems.value, isLoading: false }),
}));

function makeItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'item-1',
    title: 'YouTube Marketing Strategy',
    source_topic: 'youtube',
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

interface ResearchMock {
  /** ผลของ action=fetch — ถ้าเป็น Error จะถูก throw (จำลอง 502 ที่ไม่มี Fallback) */
  fetch?: unknown;
  analyze?: unknown;
}

/** จำลอง Research API: fetch → analyze → generate-article */
function mockResearchApi(calls: string[], mock: ResearchMock = {}) {
  const fetchResult = mock.fetch ?? { job_id: 'job-new', status: 'done' };
  const analyzeResult = mock.analyze ?? { job_id: 'job-new', status: 'done', analysis: {} };
  vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('action=fetch')) {
      if (fetchResult instanceof Error) throw fetchResult;
      return fetchResult;
    }
    if (u.includes('action=analyze')) {
      if (analyzeResult instanceof Error) throw analyzeResult;
      return analyzeResult;
    }
    if (u.includes('generate-article')) return { article: { title: 'ok', html: '<p>ok</p>' }, seo: { score: 90 }, aeo: { score: 90 } };
    return {};
  });
}

function renderDetail(item: ContentItem) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentDetailView item={item} onBack={() => {}} context="content" />
    </QueryClientProvider>,
  );
}

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentListTab />
    </QueryClientProvider>,
  );
}

function bodyOf(fragment: string): Record<string, unknown> {
  const call = vi.mocked(apiFetch).mock.calls.find(([u]) => String(u).includes(fragment));
  if (!call) throw new Error('ไม่พบ request: ' + fragment);
  return JSON.parse(String((call[1] as RequestInit).body));
}

const researchCalls = (calls: string[]) =>
  calls.filter(c => c.includes('action=fetch') || c.includes('action=analyze') || c.includes('generate-article'));

beforeEach(() => {
  vi.clearAllMocks();
  capturedDialog = null;
  mockItems.value = [];
});

describe('ContentDetailView — Mandatory Research + source_topic seed', () => {
  it('TC-08: ปุ่มสร้างเนื้อหา AI ใช้ source_topic เป็น seed ไม่ใช้ title ที่ AI เปลี่ยน', async () => {
    const calls: string[] = [];
    mockResearchApi(calls);
    renderDetail(makeItem());

    fireEvent.click(await screen.findByRole('button', { name: /สร้างเนื้อหา AI/ }));
    await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());

    const fetchBody = bodyOf('action=fetch');
    expect(fetchBody.seed_keyword).toBe('youtube');
    expect(fetchBody.seed_keyword).not.toBe('YouTube Marketing Strategy');
    expect(fetchBody.content_item_id).toBe('item-1');
    // TC-01/TC-13: ต้องผ่าน fetch → analyze → generate ตามลำดับ
    expect(researchCalls(calls)).toEqual([
      expect.stringContaining('content-research.php?action=fetch'),
      expect.stringContaining('content-research.php?action=analyze'),
      expect.stringContaining('generate-article'),
    ]);
    // TC-09: research_job_id ต้องเป็น job ที่ใช้จริง
    expect(bodyOf('generate-article')).toEqual({ item_id: 'item-1', research_job_id: 'job-new' });
  });

  it('TC-03: source_topic ว่าง → fallback ไปใช้ title ปัจจุบันเป็น seed', async () => {
    const calls: string[] = [];
    mockResearchApi(calls);
    renderDetail(makeItem({ source_topic: null, title: 'youtube marketing' }));

    fireEvent.click(await screen.findByRole('button', { name: /สร้างเนื้อหา AI/ }));
    await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());

    expect(bodyOf('action=fetch').seed_keyword).toBe('youtube marketing');
  });

  it('TC-02: Fetch คืน Fallback job → ต้อง Analyze/Generate ต่อด้วย Fallback job id', async () => {
    const calls: string[] = [];
    mockResearchApi(calls, {
      fetch: {
        job_id: 'job-fallback',
        status: 'done',
        seed_keyword: 'youtube',
        analysis: null,
        fallback: true,
        fallback_reason: 'fresh_fetch_failed',
        fetch_error: 'provider unavailable',
      },
      analyze: { job_id: 'job-fallback', status: 'done', analysis: {} },
    });
    renderDetail(makeItem());

    fireEvent.click(await screen.findByRole('button', { name: /สร้างเนื้อหา AI/ }));
    await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());

    // TC-06: Fallback ที่ยังไม่มี analysis ต้อง Analyze ก่อน Generate
    expect(bodyOf('action=analyze')).toEqual({ job_id: 'job-fallback' });
    // TC-09: ต้องบันทึก research_job_id เป็น Fallback job
    expect(bodyOf('generate-article')).toEqual({ item_id: 'item-1', research_job_id: 'job-fallback' });
  });

  it('TC-05: Fetch/Fallback ที่มี analysis อยู่แล้ว → ห้าม Analyze ซ้ำ', async () => {
    const calls: string[] = [];
    mockResearchApi(calls, {
      fetch: { job_id: 'job-cached', status: 'done', cached: true, analysis: { primary_keyword: 'youtube' } },
    });
    renderDetail(makeItem());

    fireEvent.click(await screen.findByRole('button', { name: /สร้างเนื้อหา AI/ }));
    await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());

    expect(calls.find(c => c.includes('action=analyze'))).toBeUndefined();
    expect(bodyOf('generate-article')).toEqual({ item_id: 'item-1', research_job_id: 'job-cached' });
  });

  it('TC-03: Fetch ล้มเหลวและไม่มี Fallback → ต้อง Block ห้ามเรียก Generate', async () => {
    const calls: string[] = [];
    mockResearchApi(calls, {
      fetch: new Error('ดึงข้อมูล Research ไม่สำเร็จ: provider down และไม่พบ Research เดิมที่ยังใช้งานได้'),
    });
    renderDetail(makeItem());

    fireEvent.click(await screen.findByRole('button', { name: /สร้างเนื้อหา AI/ }));

    await waitFor(() =>
      expect(toast.mock.calls.some(([arg]) => (arg as { variant?: string })?.variant === 'destructive')).toBe(true),
    );
    expect(calls.find(c => c.includes('action=analyze'))).toBeUndefined();
    expect(calls.find(c => c.includes('generate-article'))).toBeUndefined();
    const errorToast = toast.mock.calls.map(([a]) => a as { description?: string }).find(a => a?.description);
    expect(errorToast?.description).toContain('Research');
  });

  it('TC-13: planItem ที่ส่งเข้า ContentCardDialog ต้องพา source_topic ไปด้วย', async () => {
    mockResearchApi([]);
    renderDetail(makeItem());

    fireEvent.click(await screen.findByRole('button', { name: /แก้ไข/ }));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    expect(capturedDialog!.existingItem.source_topic).toBe('youtube');
    expect(capturedDialog!.existingItem.topic).toBe('YouTube Marketing Strategy');
  });

  it('TC-08: onRequestAI ของ Dialog ต้องใช้ source_topic ไม่ใช่ topic ที่ผู้ใช้แก้', async () => {
    const calls: string[] = [];
    mockResearchApi(calls);
    renderDetail(makeItem());

    fireEvent.click(await screen.findByRole('button', { name: /แก้ไข/ }));
    await waitFor(() => expect(capturedDialog).not.toBeNull());

    await capturedDialog!.onRequestAI({ topic: 'หัวข้อที่ผู้ใช้แก้ใหม่', platform: 'facebook', scheduled_date: '2026-09-04' });

    expect(bodyOf('action=fetch').seed_keyword).toBe('youtube');
  });
});

describe('ContentListTab — Mandatory Research + source_topic seed', () => {
  it('TC-13: asPlanItem ต้องพา source_topic เข้า ContentCardDialog', async () => {
    mockResearchApi([]);
    mockItems.value = [makeItem({ title: 'YouTube Marketing Strategy', source_topic: 'youtube' })];
    renderList();

    fireEvent.click(await screen.findByText('YouTube Marketing Strategy'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    expect(capturedDialog!.existingItem.source_topic).toBe('youtube');
    expect(capturedDialog!.existingItem.topic).toBe('YouTube Marketing Strategy');
  });

  it('TC-13: source_topic ว่าง → ส่ง null ไม่ใช่ค่าจาก title', async () => {
    mockResearchApi([]);
    mockItems.value = [makeItem({ title: 'youtube marketing', source_topic: null })];
    renderList();

    fireEvent.click(await screen.findByText('youtube marketing'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());
    expect(capturedDialog!.existingItem.source_topic).toBeNull();
  });

  it('TC-08: onRequestAI ใช้ source_topic เป็น seed ไม่ใช่ topic ที่ส่งมาจาก Dialog', async () => {
    const calls: string[] = [];
    mockResearchApi(calls);
    mockItems.value = [makeItem({ title: 'YouTube Marketing Strategy', source_topic: 'youtube' })];
    renderList();

    fireEvent.click(await screen.findByText('YouTube Marketing Strategy'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());

    await capturedDialog!.onRequestAI({ topic: 'หัวข้อที่ผู้ใช้แก้ใหม่', platform: 'facebook', scheduled_date: '2026-09-04' });

    const fetchBody = bodyOf('action=fetch');
    expect(fetchBody.seed_keyword).toBe('youtube');
    expect(fetchBody.content_item_id).toBe('item-1');
    expect(researchCalls(calls)).toEqual([
      expect.stringContaining('content-research.php?action=fetch'),
      expect.stringContaining('content-research.php?action=analyze'),
      expect.stringContaining('generate-article'),
    ]);
  });

  it('TC-03: source_topic ว่าง → onRequestAI fallback ไปใช้ topic ที่ส่งมา', async () => {
    const calls: string[] = [];
    mockResearchApi(calls);
    mockItems.value = [makeItem({ title: 'youtube marketing', source_topic: null })];
    renderList();

    fireEvent.click(await screen.findByText('youtube marketing'));
    await waitFor(() => expect(capturedDialog).not.toBeNull());

    await capturedDialog!.onRequestAI({ topic: 'youtube marketing', platform: 'facebook', scheduled_date: '2026-09-04' });

    expect(bodyOf('action=fetch').seed_keyword).toBe('youtube marketing');
  });
});
