import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useResearchRun, researchSeedTopic } from '@/hooks/useResearchRun';
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

  it('continues fetch → analyze → generate when the fetch API returns a fallback Research job', async () => {
    const calls: string[] = [];
    vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('action=fetch')) {
        return {
          job_id: 'fallback-job',
          status: 'done',
          seed_keyword: 'youtube',
          fallback: true,
          fallback_reason: 'fresh_fetch_failed',
          fetch_error: 'provider unavailable',
        };
      }
      if (u.includes('action=analyze')) return { job_id: 'fallback-job', status: 'done', analysis: {} };
      if (u.includes('generate-article')) return { article: { title: 'generated from fallback' } };
      throw new Error('unexpected ' + u);
    });

    render(<Harness topic="youtube" itemId="item-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(screen.getByTestId('step').textContent).toBe('done'));
    expect(calls).toEqual([
      expect.stringContaining('content-research.php?action=fetch'),
      expect.stringContaining('content-research.php?action=analyze'),
      expect.stringContaining('generate-article'),
    ]);

    const generateOptions = (vi.mocked(apiFetch).mock.calls[2][1] as any) ?? {};
    expect(JSON.parse(generateOptions.body)).toEqual({
      item_id: 'item-1',
      research_job_id: 'fallback-job',
    });
  });

  it('TC-05: skips analyze when the fetch response already carries an analysis', async () => {
    const calls: string[] = [];
    vi.mocked(apiFetch).mockImplementation(async (url: unknown) => {
      const u = String(url);
      calls.push(u);
      if (u.includes('action=fetch')) {
        return { job_id: 'cached-job', status: 'done', cached: true, analysis: { primary_keyword: 'youtube' } };
      }
      if (u.includes('generate-article')) return { article: { title: 'ok' } };
      throw new Error('unexpected ' + u);
    });

    render(<Harness topic="youtube" itemId="item-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(screen.getByTestId('step').textContent).toBe('done'));
    expect(calls.find(c => c.includes('action=analyze'))).toBeUndefined();
    expect(calls).toHaveLength(2);

    const generateOptions = (vi.mocked(apiFetch).mock.calls[1][1] as any) ?? {};
    expect(JSON.parse(generateOptions.body)).toEqual({ item_id: 'item-1', research_job_id: 'cached-job' });
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

  it('TC-03: blocks generation when fetch fails without a usable fallback', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(
      new Error('ดึงข้อมูล Research ไม่สำเร็จ: provider down และไม่พบ Research เดิมที่ยังใช้งานได้'),
    );
    render(<Harness topic="youtube" itemId="item-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'run' }));

    await waitFor(() => expect(screen.getByTestId('step').textContent).toBe('failed'));
    expect(screen.getByTestId('error').textContent).toContain('ไม่พบ Research เดิมที่ยังใช้งานได้');
    // ห้ามเรียก analyze หรือ generate ต่อ
    expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(1);
  });
});

describe('researchSeedTopic', () => {
  it('TC-08: source_topic มี priority เหนือ topic ปัจจุบัน', () => {
    expect(researchSeedTopic('youtube', 'YouTube Marketing Strategy')).toBe('youtube');
  });

  it('TC-03: null / undefined / ค่าว่าง → fallback ไปใช้ topic ปัจจุบัน', () => {
    expect(researchSeedTopic(null, 'youtube marketing')).toBe('youtube marketing');
    expect(researchSeedTopic(undefined, 'youtube marketing')).toBe('youtube marketing');
    expect(researchSeedTopic('', 'youtube marketing')).toBe('youtube marketing');
    expect(researchSeedTopic('   ', 'youtube marketing')).toBe('youtube marketing');
  });

  it('trim ค่าที่ได้เสมอ และคืนค่าว่างเมื่อไม่มีหัวข้อทั้งคู่ (ให้ผู้เรียก block เอง)', () => {
    expect(researchSeedTopic('  youtube  ', 'title')).toBe('youtube');
    expect(researchSeedTopic(null, '  youtube  ')).toBe('youtube');
    expect(researchSeedTopic(null, null)).toBe('');
    expect(researchSeedTopic('  ', '  ')).toBe('');
  });
});
