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
    expect(plan.tone).toBe('friendly');
    expect(plan.trigger_command).not.toContain('[tone:');
  });

  it('ส่ง Writing Style ที่ผู้ใช้เลือกเป็น tone แยกจาก trigger_command', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
    fireEvent.change(await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: 'YouTube' } });
    fireEvent.click(screen.getByRole('button', { name: /ทางการ/ }));
    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));

    await waitFor(() => expect(findBody(bodies, 'action=generate-plan')).toBeTruthy());
    const plan = findBody(bodies, 'action=generate-plan')!;
    expect(plan.tone).toBe('formal');
    expect(plan.trigger_command).toBe('YouTube');
    expect(plan.trigger_command).not.toContain('[tone:');
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
    expect(plan.script_style).toBe('hook-story');
    expect(plan.duration).toBe(60);
    expect(plan).not.toHaveProperty('days');
    expect(plan).not.toHaveProperty('week_start');
    expect(plan).not.toHaveProperty('tone');
    expect(plan.trigger_command).toBe('YouTube [VIDEO]');
  });

  it('ส่ง Video Script Style และ Duration เป็น structured configuration', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /วีดีโอสคริปต์/ }));
    fireEvent.change(await screen.findByPlaceholderText(/5 วิธีใช้ AI สร้างรายได้/), { target: { value: 'AI Automation' } });
    fireEvent.click(screen.getByRole('button', { name: /VSL/ }));
    fireEvent.click(screen.getByRole('button', { name: '3min' }));
    fireEvent.click(screen.getByRole('button', { name: /สร้างวีดีโอสคริปต์/ }));

    await waitFor(() => expect(findBody(bodies, 'action=generate-plan')).toBeTruthy());
    const plan = findBody(bodies, 'action=generate-plan')!;
    expect(plan.script_style).toBe('vsl');
    expect(plan.duration).toBe(180);
    expect(plan.trigger_command).toBe('AI Automation [VIDEO]');
    expect(plan.trigger_command).not.toContain('[script:');
    expect(plan.trigger_command).not.toContain('[duration:');
  });

  it('ใช้ Original User Topic เป็น seed ของ Research ไม่ใช่ topic ที่ AI เขียนใหม่', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
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

  it('direct mode ยังผ่าน Mandatory Research flow — Research ปิดไม่ได้', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
    // ไม่มี toggle ให้ปิด Research
    expect(screen.queryByRole('switch')).toBeNull();
    fireEvent.change(await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: 'YouTube' } });
    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));

    await waitFor(() => expect(findBody(bodies, 'action=generate-article')).toBeTruthy());
    expect(bodies.filter(b => b.url.includes('content-research.php')).length).toBeGreaterThan(0);
    expect(findBody(bodies, 'action=generate-plan')!.generation_mode).toBe('direct');
    expect(findBody(bodies, 'action=generate-article')!.research_job_id).toBe('job-1');
  });
});

describe('QuickCreateDialog — platform selection ไม่ถูกจำกัดโดย Content Type', () => {
  it('Content Type = Video แต่ยังเลือก WordPress + Facebook (web/social) ร่วมกับ TikTok ได้', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /วีดีโอสคริปต์/ }));
    await screen.findByPlaceholderText(/5 วิธีใช้ AI สร้างรายได้/);
    // Default preselect เมื่อเลือก Video คือ TikTok — ต้องยังเลือก WordPress/Facebook เพิ่มได้
    // (เดิม platformOptions ของ Video ไม่มี wordpress/facebook อยู่ใน list เลย)
    fireEvent.click(screen.getByRole('button', { name: 'WordPress' }));
    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    fireEvent.change(screen.getByPlaceholderText(/5 วิธีใช้ AI สร้างรายได้/), { target: { value: 'Mixed Platform' } });
    fireEvent.click(screen.getByRole('button', { name: /สร้างวีดีโอสคริปต์/ }));

    await waitFor(() => expect(findBody(bodies, 'action=generate-plan')).toBeTruthy());
    const plan = findBody(bodies, 'action=generate-plan')!;
    expect(plan.type).toBe('video');
    expect(plan.platforms).toEqual(expect.arrayContaining(['tiktok', 'wordpress', 'facebook']));
  });

  it('Content Type = Article แต่ยังเลือก TikTok (video platform) ร่วมด้วยได้', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: /บทความ & โซเชียล/ }));
    await screen.findByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/);
    // Default preselect เมื่อเลือก Article คือ Facebook — ต้องยังเลือก TikTok เพิ่มได้
    // (เดิม platformOptions ของ Article ไม่มี tiktok อยู่ใน list เลย)
    fireEvent.click(screen.getByRole('button', { name: 'TikTok' }));
    fireEvent.change(screen.getByPlaceholderText(/5 เหตุผลที่ธุรกิจต้องใช้ AI/), { target: { value: 'Mixed Platform' } });
    fireEvent.click(screen.getByRole('button', { name: /สร้างบทความ/ }));

    await waitFor(() => expect(findBody(bodies, 'action=generate-plan')).toBeTruthy());
    const plan = findBody(bodies, 'action=generate-plan')!;
    expect(plan.type).toBe('article');
    expect(plan.platforms).toEqual(expect.arrayContaining(['facebook', 'tiktok']));
  });
});
