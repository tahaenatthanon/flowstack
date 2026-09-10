import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuickCreateDialog from '@/components/content/dialogs/QuickCreateDialog';
import { apiFetch } from '@/lib/api';

/**
 * Research เป็น Mandatory Internal Flow — ผู้ใช้ปิดไม่ได้
 * ทุกการสร้าง Content ต้องผ่าน Fetch/Reuse → Analyze → Generate
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QuickCreateDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

async function gotoFormAndCreate() {
  fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
  const topicInput = await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/);
  fireEvent.change(topicInput, { target: { value: 'หัวข้อทดสอบ' } });
  fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));
}

function mockApi(calls: string[]) {
  vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers')) return [];
    if (u.includes('action=generate-plan')) return { items: [{ id: 'item-1', topic: 'หัวข้อทดสอบ' }] };
    if (u.includes('action=plan-item-date')) return { updated: true };
    if (u.includes('action=fetch')) return { job_id: 'job-1', status: 'done' };
    if (u.includes('action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
    if (u.includes('action=generate-article')) return { article: { title: 'ok' } };
    throw new Error('unexpected ' + u);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuickCreateDialog mandatory research', () => {
  it('เรียก research fetch → analyze → generate ทุกครั้งโดยไม่ต้องเปิดอะไรเพิ่ม', async () => {
    const calls: string[] = [];
    mockApi(calls);

    renderDialog();
    await gotoFormAndCreate();

    await waitFor(() => expect(calls.find(c => c.includes('action=fetch'))).toBeTruthy());
    expect(calls.find(c => c.includes('action=analyze'))).toBeTruthy();
    await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());

    // ลำดับต้องเป็น fetch → analyze → generate
    const order = calls.filter(c => c.includes('action=fetch') || c.includes('action=analyze') || c.includes('generate-article'));
    expect(order[0]).toContain('action=fetch');
    expect(order[1]).toContain('action=analyze');
    expect(order[2]).toContain('generate-article');
  });

  it('generate-article ต้องผูกกับ research job — ไม่มีทางเรียกโดยไม่มี research_job_id', async () => {
    const calls: string[] = [];
    mockApi(calls);

    renderDialog();
    await gotoFormAndCreate();

    await waitFor(() => expect(calls.find(c => c.includes('generate-article'))).toBeTruthy());
    const generateCall = vi.mocked(apiFetch).mock.calls.find(([u]) => String(u).includes('generate-article'))!;
    const body = JSON.parse((generateCall[1] as any).body);
    expect(body.research_job_id).toBe('job-1');
  });

  it('ไม่มี toggle ให้ผู้ใช้ปิด Research', async () => {
    const calls: string[] = [];
    mockApi(calls);

    renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
    await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/);

    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/ไม่ใช้ Research/)).toBeNull();
  });
});
