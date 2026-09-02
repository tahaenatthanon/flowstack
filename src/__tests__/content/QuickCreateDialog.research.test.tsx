import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuickCreateDialog from '@/components/content/dialogs/QuickCreateDialog';
import { apiFetch } from '@/lib/api';

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QuickCreateDialog research toggle', () => {
  it('does NOT call research endpoints when toggle is off (default)', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers')) return [];
      if (u.includes('action=generate-plan')) return { items: [{ id: 'item-1', topic: 'หัวข้อทดสอบ' }] };
      if (u.includes('action=generate-article')) return { article: { title: 'ok' } };
      throw new Error('unexpected ' + u);
    });

    renderDialog();
    await gotoFormAndCreate();

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/brand-content.php?action=generate-article', expect.anything());
    });
    // ห้ามเรียก research endpoint เมื่อปิด toggle
    const researchCalls = vi.mocked(apiFetch).mock.calls.filter(([u]) => String(u).includes('content-research.php'));
    expect(researchCalls).toHaveLength(0);
  });

  it('calls research fetch → analyze → generate when toggle is on', async () => {
    const calls: string[] = [];
    vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers')) return [];
      if (u.includes('action=generate-plan')) return { items: [{ id: 'item-1', topic: 'หัวข้อทดสอบ' }] };
      if (u.includes('action=fetch')) return { job_id: 'job-1', status: 'done' };
      if (u.includes('action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
      if (u.includes('action=generate-article')) return { article: { title: 'ok' } };
      throw new Error('unexpected ' + u);
    });

    renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
    // เปิด toggle "ใช้ AI Research"
    fireEvent.click(await screen.findByRole('switch'));
    fireEvent.change(await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: 'หัวข้อทดสอบ' } });
    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));

    await waitFor(() => {
      const fetchCall = calls.find(c => c.includes('action=fetch'));
      expect(fetchCall).toBeTruthy();
    });
    expect(calls.find(c => c.includes('action=analyze'))).toBeTruthy();
    expect(calls.find(c => c.includes('generate-article'))).toBeTruthy();
  });
});
