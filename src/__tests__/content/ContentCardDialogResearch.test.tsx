import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContentCardDialog } from '@/components/content/ContentCardDialog';
import { apiFetch } from '@/lib/api';
import type { PlanItem } from '@/components/content/types';

/**
 * Mandatory Research — ปุ่ม "AI เขียนให้" ใน Content Card Dialog
 * ต้องเรียก generate-article ผ่าน flow Fetch/Reuse → Analyze → Generate เท่านั้น
 * ห้ามยิง generate-article ตรงโดยไม่มี research_job_id
 *
 * Research Seed — `source_topic` (Original User Topic ที่บันทึกตอนสร้าง Content)
 * ต้องเป็น seed_keyword เสมอ เพราะ title/topic แก้ไขภายหลังได้และอาจถูก AI rewrite
 * ถ้าไม่มี source_topic ให้ fallback ไปใช้ Topic ปัจจุบัน
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
// confirm() ต้อง resolve true — ปุ่ม "AI เขียนให้" เพิ่ม confirm gate ก่อนเรียก
// runResearch() แล้ว (ดู change confirm-before-ai-content-write) เทสต์นี้ยืนยัน
// Research flow เอง ไม่ใช่ confirm gate
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true) }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

function makeItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id: 'item-1',
    plan_id: 'plan-1',
    day_label: 'Day 1',
    day_order: 1,
    scheduled_date: '2026-09-04',
    platform: 'facebook',
    platforms: ['facebook'],
    topic: 'หัวข้อที่ AI เขียนใหม่',
    source_topic: 'หัวข้อทดสอบ',
    caption: '',
    image_brief: '',
    generated_image_url: null,
    image_gen_status: '',
    ...overrides,
  };
}

function mockApi(calls: string[]) {
  vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('knowledge-base')) return [];
    if (u.includes('action=fetch')) return { job_id: 'job-1', status: 'done' };
    if (u.includes('action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
    if (u.includes('generate-article')) return { article: { title: 'ok', html: '<p>ok</p>' }, seo: { score: 95 }, aeo: { score: 90 } };
    throw new Error('unexpected ' + u);
  });
}

/**
 * `existingItem` ต้องเป็น object เดิมทุก render — Dialog reset local state ทุกครั้งที่
 * reference เปลี่ยน (effect deps `[open, existingItem, date]`) ซึ่งจะล้างการแก้ไข Topic ทิ้ง
 */
function renderDialog(item: PlanItem | null = makeItem(), onSave = vi.fn(async () => {})) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = render(
    <QueryClientProvider client={qc}>
      <ContentCardDialog
        open
        onOpenChange={() => {}}
        date={null}
        planId="plan-1"
        existingItem={item}
        onSave={onSave}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onSave };
}

/** อ่าน JSON body ของ request แรกที่ URL ตรงกับ fragment */
function bodyOf(fragment: string): Record<string, unknown> {
  const call = vi.mocked(apiFetch).mock.calls.find(([u]) => String(u).includes(fragment));
  if (!call) throw new Error('ไม่พบ request: ' + fragment);
  return JSON.parse(String((call[1] as RequestInit).body));
}

const topicInput = () => screen.getByPlaceholderText('หัวข้อคอนเทนต์...') as HTMLInputElement;

async function clickResearch() {
  fireEvent.click(await screen.findByRole('button', { name: /AI เขียนให้/ }));
}

async function saveDialog() {
  fireEvent.click(screen.getByRole('button', { name: /^บันทึก$/ }));
}

/** รอจน Research flow ยิง generate-article เสร็จ */
async function researchCompleted(calls: string[]) {
  await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ContentCardDialog — Mandatory Research', () => {
  it('ปุ่ม AI เขียนให้ ต้องผ่าน fetch → analyze → generate', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog();

    await clickResearch();
    await researchCompleted(calls);

    const order = calls.filter(c => c.includes('action=fetch') || c.includes('action=analyze') || c.includes('generate-article'));
    expect(order[0]).toContain('content-research.php?action=fetch');
    expect(order[1]).toContain('content-research.php?action=analyze');
    expect(order[2]).toContain('generate-article');
  });

  it('generate-article ต้องส่ง research_job_id ที่ได้จาก Research flow', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog();

    await clickResearch();
    await researchCompleted(calls);

    // Research seed must remain the Original User Topic even when the editable title/topic changed.
    expect(bodyOf('action=fetch')).toEqual({ seed_keyword: 'หัวข้อทดสอบ', content_item_id: 'item-1' });
    expect(bodyOf('generate-article')).toEqual({ item_id: 'item-1', research_job_id: 'job-1' });
  });
});

describe('ContentCardDialog — source_topic เป็น Research seed', () => {
  it('TC-01: ใช้ source_topic เป็น seed_keyword ไม่ใช้ title/topic', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog(makeItem({
      source_topic: 'youtube',
      topic: 'YouTube Marketing: กลยุทธ์เพิ่มยอดผู้ชม',
    }));

    await clickResearch();
    await researchCompleted(calls);

    const fetchBody = bodyOf('action=fetch');
    expect(fetchBody.seed_keyword).toBe('youtube');
    expect(fetchBody.seed_keyword).not.toBe('YouTube Marketing: กลยุทธ์เพิ่มยอดผู้ชม');
    expect(fetchBody.content_item_id).toBe('item-1');
    expect(bodyOf('generate-article').item_id).toBe('item-1');
  });

  it('TC-02: แก้ Title/Topic แล้วบันทึก — Research ยังใช้ source_topic เดิม', async () => {
    const calls: string[] = [];
    mockApi(calls);
    const item = makeItem({ source_topic: 'youtube', topic: 'YouTube Marketing' });
    const { onSave } = renderDialog(item);

    fireEvent.change(topicInput(), { target: { value: 'วิธีสร้างวิดีโอให้คนดูจนจบ' } });
    await saveDialog();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0]).toMatchObject({ topic: 'วิธีสร้างวิดีโอให้คนดูจนจบ' });

    await clickResearch();
    await researchCompleted(calls);

    const fetchBody = bodyOf('action=fetch');
    expect(fetchBody.seed_keyword).toBe('youtube');
    expect(fetchBody.seed_keyword).not.toBe('วิธีสร้างวิดีโอให้คนดูจนจบ');
    // การแก้ Title/Topic ต้องไม่แตะ source_topic
    expect(item.source_topic).toBe('youtube');
  });

  it('TC-03: source_topic เป็น null → fallback ไปใช้ Topic ปัจจุบัน', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog(makeItem({ source_topic: null, topic: 'youtube marketing' }));

    await clickResearch();
    await researchCompleted(calls);

    const fetchBody = bodyOf('action=fetch');
    expect(fetchBody.seed_keyword).toBe('youtube marketing');
    expect(fetchBody.seed_keyword).toBeTruthy();
    expect(bodyOf('generate-article')).toEqual({ item_id: 'item-1', research_job_id: 'job-1' });
  });

  it('TC-03: source_topic เป็น empty/whitespace → fallback ไปใช้ Topic ปัจจุบัน', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog(makeItem({ source_topic: '   ', topic: 'youtube marketing' }));

    await clickResearch();
    await researchCompleted(calls);

    expect(bodyOf('action=fetch').seed_keyword).toBe('youtube marketing');
  });

  it('TC-04: source_topic ต้องไม่ถูกส่งไปแก้ไขจาก ContentCardDialog', async () => {
    const calls: string[] = [];
    mockApi(calls);
    const item = makeItem({ source_topic: 'youtube', topic: 'YouTube Marketing' });
    const { onSave } = renderDialog(item);

    fireEvent.change(topicInput(), { target: { value: 'หัวข้อใหม่' } });
    await saveDialog();
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    const payload = onSave.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('source_topic');
    expect(payload.topic).toBe('หัวข้อใหม่');
    expect(item.source_topic).toBe('youtube');
  });

  it('TC-05: Research ต้องใช้ Content ID เดิม ห้ามสร้าง ID อื่น', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog(makeItem({ id: 'item-42', source_topic: 'youtube' }));

    await clickResearch();
    await researchCompleted(calls);

    expect(bodyOf('action=fetch').content_item_id).toBe('item-42');
    expect(bodyOf('generate-article').item_id).toBe('item-42');
  });

  it('TC-06: Regression — Research flow เดิมยังทำงาน และ UI อื่นไม่พัง', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog(makeItem({ source_topic: 'youtube', topic: 'YouTube Marketing' }));

    // แสดง Original User Topic ที่ Research จะใช้ ให้ผู้ใช้เห็นว่า seed ไม่ใช่ Topic ที่แก้ได้
    expect(await screen.findByText(/Research ใช้ Original User Topic/)).toBeInTheDocument();
    expect(topicInput().value).toBe('YouTube Marketing');

    await clickResearch();
    await researchCompleted(calls);

    expect(bodyOf('action=fetch').seed_keyword).toBe('youtube');
    // ไม่มี error toast จาก Research flow
    expect(toast.mock.calls.some(([arg]) => (arg as { variant?: string })?.variant === 'destructive')).toBe(false);
    // UI ส่วนอื่นยังอยู่
    expect(screen.getByRole('button', { name: /^บันทึก$/ })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);
  });
});
