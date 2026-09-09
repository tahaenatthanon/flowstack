import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BatchGenerateDialog } from '@/components/content/dialogs/BatchGenerateDialog';
import { apiFetch } from '@/lib/api';

/**
 * Regression: Batch สร้างคอนเทนต์ ต้องส่ง tone/script_style/duration ต่อหัวข้อ
 * เช่นเดียวกับ QuickCreateDialog (ดู QuickCreateDialog.directMode.test.tsx) —
 * ก่อนหน้านี้ Batch ไม่มี UI ให้เลือกค่านี้เลยและไม่ส่ง field พวกนี้ไปที่ generate-plan
 * ทำให้ content ที่สร้างผ่าน Batch fallback เป็น default เสมอ (friendly / hook-story / 60s)
 */

const toast = vi.fn();

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

// Radix Select ต้องพึ่ง API เหล่านี้ ซึ่ง jsdom ไม่มีให้ — polyfill เฉพาะไฟล์นี้
beforeEach(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BatchGenerateDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

/** mock ทุก endpoint ที่ dialog เรียก และเก็บ body ไว้ตรวจ (เรียงตามลำดับที่ยิงจริง) */
function mockApi() {
  const bodies: Record<string, any>[] = [];
  vi.mocked(apiFetch).mockImplementation(async (url: unknown, init?: any) => {
    const u = String(url);
    if (init?.body) bodies.push({ url: u, body: JSON.parse(init.body as string) });
    if (u.includes('action=skills') || u.includes('action=contexts') || u.includes('action=triggers')) return [];
    if (u.includes('action=generate-plan')) return { items: [{ id: `item-${bodies.length}`, topic: 'AI generated topic' }] };
    if (u.includes('action=fetch')) return { job_id: 'job-1', status: 'done' };
    if (u.includes('action=analyze')) return { job_id: 'job-1', status: 'done', analysis: {} };
    if (u.includes('action=generate-article')) return { article: { title: 'ok' }, seo: { gate: 'passed', score: 95 } };
    throw new Error('unexpected ' + u);
  });
  return bodies;
}

const findBodies = (bodies: Record<string, any>[], fragment: string) =>
  bodies.filter(b => b.url.includes(fragment)).map(b => b.body);

/** div.rounded-lg.border ที่ครอบหัวข้อที่ index (0-based) — ใช้ scope query ไม่ให้ index เพี้ยน
 *  เมื่อหัวข้ออื่นเปิด "ตั้งค่าเพิ่มเติม" ค้างไว้แล้วเพิ่ม combobox (เช่น ภาษา) แทรกเข้ามา */
function getTopicRow(rowIndex: number): HTMLElement {
  const inputs = screen.getAllByPlaceholderText(/วิธีเลือกเครื่องมือ AI/);
  return inputs[rowIndex].closest('.rounded-lg.border') as HTMLElement;
}

/** เปิด "ตั้งค่าเพิ่มเติม" ของหัวข้อที่ index (0-based) แล้วเลือกแพลตฟอร์มให้ผ่าน validation */
async function openSettingsAndPickPlatform(rowIndex: number, platformLabel = 'Facebook') {
  const row = getTopicRow(rowIndex);
  fireEvent.click(within(row).getByRole('button', { name: /ตั้งค่าเพิ่มเติม/ }));
  const platformButton = await within(row).findByRole('button', { name: new RegExp(`^${platformLabel}$`) });
  fireEvent.click(platformButton);
}

/** Radix Select ในสภาพแวดล้อม jsdom เปิด listbox ได้ชัวร์สุดผ่าน keyboard (focus + Enter) */
function openSelect(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

async function startAndConfirm() {
  fireEvent.click(screen.getByRole('button', { name: /เริ่มสร้างคอนเทนต์/ }));
  const confirmButton = await screen.findByRole('button', { name: /ยืนยันและเริ่มสร้าง/ });
  fireEvent.click(confirmButton);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BatchGenerateDialog — tone/script_style/duration ต่อหัวข้อ', () => {
  it('หัวข้อ article (default) ส่ง tone=friendly โดยไม่ต้องเลือกอะไรเพิ่ม', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.change(screen.getByPlaceholderText(/วิธีเลือกเครื่องมือ AI/), { target: { value: 'หัวข้อทดสอบ' } });
    await openSettingsAndPickPlatform(0);
    await startAndConfirm();

    await waitFor(() => expect(findBodies(bodies, 'action=generate-plan').length).toBe(1));
    const plan = findBodies(bodies, 'action=generate-plan')[0];
    expect(plan.type).toBe('article');
    expect(plan.tone).toBe('friendly');
    expect(plan).not.toHaveProperty('script_style');
    expect(plan).not.toHaveProperty('duration');
  });

  it('เลือกโทน "ทางการ" ให้หัวข้อ article → ส่ง tone=formal', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.change(screen.getByPlaceholderText(/วิธีเลือกเครื่องมือ AI/), { target: { value: 'หัวข้อทดสอบ' } });
    await openSettingsAndPickPlatform(0);
    fireEvent.click(screen.getByRole('button', { name: /ทางการ/ }));
    await startAndConfirm();

    await waitFor(() => expect(findBodies(bodies, 'action=generate-plan').length).toBe(1));
    expect(findBodies(bodies, 'action=generate-plan')[0].tone).toBe('formal');
  });

  it('หัวข้อ video ที่เปลี่ยนเป็น VSL + 3min → ส่ง script_style=vsl, duration=180', async () => {
    const bodies = mockApi();
    renderDialog();

    fireEvent.change(screen.getByPlaceholderText(/วิธีเลือกเครื่องมือ AI/), { target: { value: 'หัวข้อวีดีโอ' } });

    // สลับ content type ของหัวข้อแรกเป็น Video
    openSelect(within(getTopicRow(0)).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Video', hidden: true }));

    await openSettingsAndPickPlatform(0, 'TikTok');
    fireEvent.click(screen.getByRole('button', { name: /VSL/ }));
    fireEvent.click(screen.getByRole('button', { name: '3min' }));
    await startAndConfirm();

    await waitFor(() => expect(findBodies(bodies, 'action=generate-plan').length).toBe(1));
    const plan = findBodies(bodies, 'action=generate-plan')[0];
    expect(plan.type).toBe('video');
    expect(plan.script_style).toBe('vsl');
    expect(plan.duration).toBe(180);
    expect(plan).not.toHaveProperty('tone');
  });

  it('หลายหัวข้อคนละ content type ในการรันเดียว — แต่ละ generate-plan call มี field ตรงตามหัวข้อนั้น ไม่ปนกัน', async () => {
    const bodies = mockApi();
    renderDialog();

    // หัวข้อ 1: article (default)
    fireEvent.change(screen.getByPlaceholderText(/วิธีเลือกเครื่องมือ AI/), { target: { value: 'หัวข้อบทความ' } });
    await openSettingsAndPickPlatform(0);

    // เพิ่มหัวข้อ 2 แล้วสลับเป็น video
    fireEvent.click(screen.getByRole('button', { name: /เพิ่มหัวข้อ/ }));
    fireEvent.change(getTopicRow(1).querySelector('input')!, { target: { value: 'หัวข้อวีดีโอ' } });

    openSelect(within(getTopicRow(1)).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Video', hidden: true }));
    await openSettingsAndPickPlatform(1, 'TikTok');

    await startAndConfirm();

    await waitFor(() => expect(findBodies(bodies, 'action=generate-plan').length).toBe(2));
    const [firstPlan, secondPlan] = findBodies(bodies, 'action=generate-plan');

    expect(firstPlan.source_topic).toBe('หัวข้อบทความ');
    expect(firstPlan.type).toBe('article');
    expect(firstPlan.tone).toBe('friendly');
    expect(firstPlan).not.toHaveProperty('script_style');

    expect(secondPlan.source_topic).toBe('หัวข้อวีดีโอ');
    expect(secondPlan.type).toBe('video');
    expect(secondPlan.script_style).toBe('hook-story');
    expect(secondPlan.duration).toBe(60);
    expect(secondPlan).not.toHaveProperty('tone');
  });
});
