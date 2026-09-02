import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useResearchRun } from '@/hooks/useResearchRun';
import { apiFetch } from '@/lib/api';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

function Harness({ topic, itemId }: { topic: string; itemId: string }) {
  const { run, step, error } = useResearchRun();
  return (
    <div>
      <button onClick={() => run({ topic, itemId }).catch(() => {})}>run</button>
      <span data-testid="step">{step}</span>
      <span data-testid="error">{error ?? ''}</span>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useResearchRun', () => {
  it('runs fetch → analyze → generate in order', async () => {
    const calls: string[] = [];
    vi.mocked(apiFetch).mockImplementation(async (url: unknown, options?: unknown) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('action=fetch')) return { job_id: 'job-1', status: 'done' };
      if (u.includes('action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
      if (u.includes('generate-article')) return { article: { title: 'ok' } };
      throw new Error('unexpected ' + u);
    });

    render(<Harness topic="หัวข้อทดสอบ" itemId="item-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(screen.getByTestId('step').textContent).toBe('done'));

    expect(calls[0]).toContain('content-research.php?action=fetch');
    expect(calls[1]).toContain('content-research.php?action=analyze');
    expect(calls[2]).toContain('generate-article');
    expect(calls).toHaveLength(3);

    // fetch ใช้ seed keyword = topic (trim) + content_item_id
    const fetchOptions = (vi.mocked(apiFetch).mock.calls[0][1] as any) ?? {};
    expect(JSON.parse(fetchOptions.body)).toEqual({ seed_keyword: 'หัวข้อทดสอบ', content_item_id: 'item-1' });
    // generate ใช้ research_job_id
    const genOptions = (vi.mocked(apiFetch).mock.calls[2][1] as any) ?? {};
    expect(JSON.parse(genOptions.body)).toEqual({ item_id: 'item-1', research_job_id: 'job-1' });
  });

  it('stops at fetching step when fetch returns no job id', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ status: 'failed' } as any);
    render(<Harness topic="t" itemId="i" />);
    fireEvent.click(screen.getByRole('button', { name: 'run' }));
    await waitFor(() => expect(screen.getByTestId('step').textContent).toBe('failed'));
    expect(screen.getByTestId('error').textContent).toContain('ค้นข้อมูล Research ไม่สำเร็จ');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  });

  it('stops at analyzing step when analyze throws', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ job_id: 'job-1', status: 'done' } as any)
      .mockRejectedValueOnce(new Error('AI provider error: Add credits'));
    render(<Harness topic="t" itemId="i" />);
    fireEvent.click(screen.getByRole('button', { name: 'run' }));
    await waitFor(() => expect(screen.getByTestId('step').textContent).toBe('failed'));
    expect(screen.getByTestId('error').textContent).toContain('AI provider error');
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2);
  });
});
