import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuickCreateDialog from '@/components/content/dialogs/QuickCreateDialog';
import { apiFetch } from '@/lib/api';

/**
 * Regression: Direct Content Creation ต้องไม่ถูกตีความเป็น weekly plan
 * และ Original User Topic ต้องเป็น seed ของ Research (ไม่ใช่ topic ที่ AI เขียนใหม่)
 *
 * ครอบคลุม tasks 3.1-3.3 ฝั่ง frontend ของ change fix-direct-content-week-context
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

// topic ที่ AI เขียนใหม่ในขั้น plan — ห้ามถูกใช้แทน seed ของผู้ใช้
const AI_REWRITTEN_TOPIC = 'เริ่มต้นสัปดาห์ด้วย 5 ฟีเจอร์ YouTube ที่ต้องรู้';

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QuickCreateDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

/** mock ทุก endpoint ที่ dialog เรียก และเก็บ body ไว้ตรวจ */
function mockApi() {
  const bodies: Record<string, any>[] = [];
  vi.mocked(apiFetch).mockImplementation(async (url: unknown, init?: any) => {
    const u = String(url);
    if (init?.body) bodies.push({ url: u, body: JSON.parse(init.body as string) });
    if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers')) return [];
    if (u.includes('action=generate-plan')) return { items: [{ id: 'item-1', topic: AI_REWRITTEN_TOPIC }] };
    if (u.includes('action=fetch')) return { job_id: 'job-1', status: 'done' };
    if (u.includes('action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
    if (u.includes('action=generate-article')) return { article: { title: 'ok' }, seo: { gate: 'passed', score: 95 } };
    throw new Error('unexpected ' + u);
  });
  return bodies;
}

const findBody = (bodies: Record<string, any>[], fragment: string) =>
  bodies.find(b => b.url.includes(fragment))?.body;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuickCreateDialog direct generation mode', () => {
  it('ส่ง generation_mode=direct และไม่ส่ง days/week_start สำหรับบทความ', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
    fireEvent.change(await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: 'YouTube' } });
    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));

    await waitFor(() => expect(findBody(bodies, 'action=generate-plan')).toBeTruthy());
    const plan = findBody(bodies, 'action=generate-plan')!;

    expect(plan.generation_mode).toBe('direct');
    expect(plan.source_topic).toBe('YouTube');
    expect(plan.type).toBe('article');
    // `days` และ `week_start` เป็นตัวขับ weekly/day context — ห้ามส่งใน direct mode
    expect(plan).not.toHaveProperty('days');
    expect(plan).not.toHaveProperty('week_start');
    expect(plan.trigger_command).toContain('YouTube');
  });

  it('ส่ง generation_mode=direct และไม่ส่ง days/week_start สำหรับวีดีโอ', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /วีดีโอสคริปต์/ }));
    fireEvent.change(await screen.findByPlaceholderText(/5 วิธีใช้ AI สร้างรายได้/), { target: { value: 'YouTube' } });
    fireEvent.click(screen.getByRole('button', { name: /สร้างวีดีโอสคริปต์/ }));

    await waitFor(() => expect(findBody(bodies, 'action=generate-plan')).toBeTruthy());
    const plan = findBody(bodies, 'action=generate-plan')!;

    expect(plan.generation_mode).toBe('direct');
    expect(plan.source_topic).toBe('YouTube');
    expect(plan.type).toBe('video');
    expect(plan).not.toHaveProperty('days');
    expect(plan).not.toHaveProperty('week_start');
  });

  it('เมื่อเปิด Research ใช้ Original User Topic เป็น seed ไม่ใช่ topic ที่ AI เขียนใหม่', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
    fireEvent.click(await screen.findByRole('switch'));
    fireEvent.change(await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: '  YouTube  ' } });
    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));

    await waitFor(() => expect(findBody(bodies, 'action=fetch')).toBeTruthy());
    const fetchBody = findBody(bodies, 'action=fetch')!;

    expect(fetchBody.seed_keyword).toBe('YouTube');
    expect(fetchBody.seed_keyword).not.toBe(AI_REWRITTEN_TOPIC);
    expect(fetchBody.content_item_id).toBe('item-1');

    // generate-article ต้องผูกกับ research job เดิม
    await waitFor(() => expect(findBody(bodies, 'action=generate-article')).toBeTruthy());
    expect(findBody(bodies, 'action=generate-article')!.research_job_id).toBe('job-1');
  });

  it('เมื่อปิด Research ยังใช้ direct mode และไม่แตะ endpoint research', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
    fireEvent.change(await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: 'YouTube' } });
    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));

    await waitFor(() => expect(findBody(bodies, 'action=generate-article')).toBeTruthy());
    expect(bodies.filter(b => b.url.includes('content-research.php'))).toHaveLength(0);
    expect(findBody(bodies, 'action=generate-plan')!.generation_mode).toBe('direct');
  });
});
