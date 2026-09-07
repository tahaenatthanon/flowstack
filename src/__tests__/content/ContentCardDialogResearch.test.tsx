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
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/hooks/useContent', () => ({
  useContentGlobalSettings: () => ({ data: undefined }),
}));
vi.mock('@/components/content/ArticleEditor', () => ({ default: () => null }));
vi.mock('@/components/content/ImageViewer', () => ({ default: () => null }));

function makeItem(): PlanItem {
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
  } as PlanItem;
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

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ContentCardDialog
        open
        onOpenChange={() => {}}
        date={null}
        planId="plan-1"
        existingItem={makeItem()}
        onSave={vi.fn(async () => {})}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ContentCardDialog — Mandatory Research', () => {
  it('ปุ่ม AI เขียนให้ ต้องผ่าน fetch → analyze → generate', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /AI เขียนให้/ }));

    await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());

    const order = calls.filter(c => c.includes('action=fetch') || c.includes('action=analyze') || c.includes('generate-article'));
    expect(order[0]).toContain('content-research.php?action=fetch');
    expect(order[1]).toContain('content-research.php?action=analyze');
    expect(order[2]).toContain('generate-article');
  });

  it('generate-article ต้องส่ง research_job_id ที่ได้จาก Research flow', async () => {
    const calls: string[] = [];
    mockApi(calls);
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /AI เขียนให้/ }));
    await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());

    const fetchCall = vi.mocked(apiFetch).mock.calls.find(([u]) => String(u).includes('action=fetch'))!;
    // Research seed must remain the Original User Topic even when the editable title/topic changed.
    expect(JSON.parse((fetchCall[1] as any).body)).toEqual({ seed_keyword: 'หัวข้อทดสอบ', content_item_id: 'item-1' });

    const generateCall = vi.mocked(apiFetch).mock.calls.find(([u]) => String(u).includes('generate-article'))!;
    expect(JSON.parse((generateCall[1] as any).body)).toEqual({ item_id: 'item-1', research_job_id: 'job-1' });
  });
});
