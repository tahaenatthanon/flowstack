import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BatchGenerateDialog } from '@/components/content/dialogs/BatchGenerateDialog';
import { apiFetch } from '@/lib/api';

/**
 * Regression:
 * 1) Batch สร้างคอนเทนต์ ต้องส่ง tone/script_style/duration ต่อหัวข้อ เช่นเดียวกับ
 *    QuickCreateDialog (ดู QuickCreateDialog.directMode.test.tsx) — ก่อนหน้านี้ Batch
 *    ไม่มี UI ให้เลือกค่านี้เลยและไม่ส่ง field พวกนี้ไปที่ generate-plan ทำให้ content
 *    ที่สร้างผ่าน Batch fallback เป็น default เสมอ (friendly / hook-story / 60s)
 * 2) Batch ต้องมีหัวข้อคอนเทนต์อย่างน้อย 3 หัวข้อต่อการรัน — ฟอร์มเริ่มต้นด้วย 3 แถวว่าง
 *    ลบแถวลงต่ำกว่า 3 ไม่ได้ และกดเริ่มสร้างไม่ได้ถ้ากรอกไม่ครบ 3 หัวข้อ
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

/** div.rounded-lg.border ที่ครอบหัวข้อที่ index (0-based) — scope query ไม่ให้ index เพี้ยน
 *  เมื่อหัวข้ออื่นเปิด "ตั้งค่าเพิ่มเติม" ค้างไว้แล้วเพิ่ม combobox (เช่น ภาษา) แทรกเข้ามา */
function getTopicRow(rowIndex: number): HTMLElement {
  const inputs = screen.getAllByPlaceholderText(/วิธีเลือกเครื่องมือ AI/);
  return inputs[rowIndex].closest('.rounded-lg.border') as HTMLElement;
}

/** Radix Select ในสภาพแวดล้อม jsdom เปิด listbox ได้ชัวร์สุดผ่าน keyboard (focus + Enter) */
function openSelect(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
}

/** กรอกหัวข้อที่ rowIndex ให้ผ่าน validation (topic + platform) พร้อมตัวเลือกสลับ content type
 *  และ callback เพิ่มเติมหลังเปิด "ตั้งค่าเพิ่มเติม" แล้ว (เช่น เลือกโทน/สไตล์) */
async function fillTopic(rowIndex: number, topicText: string, opts: {
  contentType?: 'article' | 'video';
  platform?: string;
  after?: (row: HTMLElement) => void;
} = {}) {
  const row = getTopicRow(rowIndex);
  fireEvent.change(within(row).getByPlaceholderText(/วิธีเลือกเครื่องมือ AI/), { target: { value: topicText } });

  if (opts.contentType === 'video') {
    openSelect(within(row).getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: 'Video', hidden: true }));
  }

  fireEvent.click(within(row).getByRole('button', { name: /ตั้งค่าเพิ่มเติม/ }));
  const platformLabel = opts.platform ?? (opts.contentType === 'video' ? 'TikTok' : 'Facebook');
  const platformButton = await within(row).findByRole('button', { name: new RegExp(`^${platformLabel}$`) });
  fireEvent.click(platformButton);

  opts.after?.(row);
}

async function startAndConfirm() {
  fireEvent.click(screen.getByRole('button', { name: /เริ่มสร้างคอนเทนต์/ }));
  const confirmButton = await screen.findByRole('button', { name: /ยืนยันและเริ่มสร้าง/ });
  fireEvent.click(confirmButton);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BatchGenerateDialog — ต้องมีอย่างน้อย 3 หัวข้อ', () => {
  it('เริ่มต้นด้วย 3 แถวว่าง และลบลงต่ำกว่า 3 ไม่ได้', async () => {
    renderDialog();
    const deleteButtons = await screen.findAllByRole('button', { name: /ลบหัวข้อ/ });
    expect(deleteButtons).toHaveLength(3);
    deleteButtons.forEach(btn => expect(btn).toBeDisabled());
  });

  it('กรอกไม่ครบ 3 หัวข้อ → ปุ่มเริ่มสร้างถูก disabled และกดแล้วไม่เปิด confirm', async () => {
    mockApi();
    renderDialog();

    await fillTopic(0, 'หัวข้อ 1');
    await fillTopic(1, 'หัวข้อ 2');
    // หัวข้อที่ 3 ปล่อยว่างไว้โดยตั้งใจ

    const startButton = screen.getByRole('button', { name: /เริ่มสร้างคอนเทนต์/ });
    expect(startButton).toBeDisabled();

    fireEvent.click(startButton);
    expect(screen.queryByRole('button', { name: /ยืนยันและเริ่มสร้าง/ })).toBeNull();
  });
});

describe('BatchGenerateDialog — tone/script_style/duration ต่อหัวข้อ', () => {
  it('หัวข้อ article (default) ทั้ง 3 หัวข้อ ส่ง tone=friendly โดยไม่ต้องเลือกอะไรเพิ่ม', async () => {
    const bodies = mockApi();
    renderDialog();

    await fillTopic(0, 'หัวข้อ 1');
    await fillTopic(1, 'หัวข้อ 2');
    await fillTopic(2, 'หัวข้อ 3');
    await startAndConfirm();

    await waitFor(() => expect(findBodies(bodies, 'action=generate-plan').length).toBe(3));
    for (const plan of findBodies(bodies, 'action=generate-plan')) {
      expect(plan.type).toBe('article');
      expect(plan.tone).toBe('friendly');
      expect(plan).not.toHaveProperty('script_style');
      expect(plan).not.toHaveProperty('duration');
    }
  });

  it('เลือกโทน "ทางการ" ให้หัวข้อแรก → เฉพาะหัวข้อนั้นส่ง tone=formal หัวข้ออื่นยัง friendly', async () => {
    const bodies = mockApi();
    renderDialog();

    await fillTopic(0, 'หัวข้อ 1', {
      after: row => fireEvent.click(within(row).getByRole('button', { name: /ทางการ/ })),
    });
    await fillTopic(1, 'หัวข้อ 2');
    await fillTopic(2, 'หัวข้อ 3');
    await startAndConfirm();

    await waitFor(() => expect(findBodies(bodies, 'action=generate-plan').length).toBe(3));
    const [first, second, third] = findBodies(bodies, 'action=generate-plan');
    expect(first.tone).toBe('formal');
    expect(second.tone).toBe('friendly');
    expect(third.tone).toBe('friendly');
  });

  it('หัวข้อ video ที่เปลี่ยนเป็น VSL + 3min → ส่ง script_style=vsl, duration=180', async () => {
    const bodies = mockApi();
    renderDialog();

    await fillTopic(0, 'หัวข้อวีดีโอ', {
      contentType: 'video',
      after: row => {
        fireEvent.click(within(row).getByRole('button', { name: /VSL/ }));
        fireEvent.click(within(row).getByRole('button', { name: '3min' }));
      },
    });
    await fillTopic(1, 'หัวข้อ 2');
    await fillTopic(2, 'หัวข้อ 3');
    await startAndConfirm();

    await waitFor(() => expect(findBodies(bodies, 'action=generate-plan').length).toBe(3));
    const [videoPlan] = findBodies(bodies, 'action=generate-plan');
    expect(videoPlan.type).toBe('video');
    expect(videoPlan.script_style).toBe('vsl');
    expect(videoPlan.duration).toBe(180);
    expect(videoPlan).not.toHaveProperty('tone');
  });

  it('หลายหัวข้อคนละ content type ในการรันเดียว — แต่ละ generate-plan call มี field ตรงตามหัวข้อนั้น ไม่ปนกัน', async () => {
    const bodies = mockApi();
    renderDialog();

    await fillTopic(0, 'หัวข้อบทความ');
    await fillTopic(1, 'หัวข้อวีดีโอ', { contentType: 'video' });
    await fillTopic(2, 'หัวข้อบทความ2');
    await startAndConfirm();

    await waitFor(() => expect(findBodies(bodies, 'action=generate-plan').length).toBe(3));
    const [first, second, third] = findBodies(bodies, 'action=generate-plan');

    expect(first.source_topic).toBe('หัวข้อบทความ');
    expect(first.type).toBe('article');
    expect(first.tone).toBe('friendly');
    expect(first).not.toHaveProperty('script_style');

    expect(second.source_topic).toBe('หัวข้อวีดีโอ');
    expect(second.type).toBe('video');
    expect(second.script_style).toBe('hook-story');
    expect(second.duration).toBe(60);
    expect(second).not.toHaveProperty('tone');

    expect(third.source_topic).toBe('หัวข้อบทความ2');
    expect(third.type).toBe('article');
    expect(third.tone).toBe('friendly');
  });
});
