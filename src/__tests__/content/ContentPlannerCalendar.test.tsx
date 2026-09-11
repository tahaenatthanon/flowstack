import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentPlannerCalendar } from '@/components/content/ContentPlannerCalendar';
import type { ContentPlan, PlanItem, CalendarView } from '@/components/content/types';

/**
 * Regression: `ContentPlannerCalendar` เคยทำให้ content item หายไปเงียบๆ จาก
 * ทุกมุมมอง (Month/Quarter/Year) เมื่อไม่มี `scheduled_date` — ไม่ว่าจะมี
 * `day_label` หรือไม่ (เดิม key = scheduled_date || day_label แล้ว
 * `if (!key) continue;` ทิ้งไปเลย, หรือถ้ามี day_label ก็ถูกเก็บไว้ใต้ key
 * ที่ grid ไม่มีทาง render ได้ เพราะ renderCell ค้นด้วย toDateKey() เสมอ)
 *
 * เปลี่ยนพฤติกรรม: item ที่ไม่มี scheduled_date (ไม่ว่า day_label จะมีค่าอะไร)
 * ต้องแสดงใน bucket "ยังไม่กำหนดวันที่" เหนือ grid แทน ไม่หายไปเงียบๆ
 */

function makeItem(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: 'item-1', plan_id: 'plan-1', day_label: '', day_order: 0,
    scheduled_date: null, platform: 'facebook', topic: 'หัวข้อทดสอบ',
    caption: '', image_brief: '', generated_image_url: null, image_gen_status: 'none',
    content_type: 'article',
    ...overrides,
  };
}

function makePlan(items: PlanItem[]): ContentPlan {
  return {
    id: 'plan-1', title: 'แผนทดสอบ', week_start: '2026-01-01', status: 'draft',
    trigger_command: 'ทดสอบ', created_at: '2026-01-01T00:00:00Z', items,
  };
}

function renderCalendar(props: {
  plans: ContentPlan[];
  view?: CalendarView;
  typeFilter?: string;
  platformFilter?: string;
  onDateClick?: (date: Date, items: PlanItem[]) => void;
}) {
  const onDateClick = props.onDateClick ?? vi.fn();
  render(
    <ContentPlannerCalendar
      plans={props.plans}
      view={props.view ?? 'month'}
      currentDate={new Date(2026, 0, 15)}
      onNavigate={() => {}}
      onViewChange={() => {}}
      onDateClick={onDateClick}
      onDateDragOver={() => {}}
      onDateDrop={() => {}}
      typeFilter={props.typeFilter ?? 'all'}
      platformFilter={props.platformFilter ?? 'all'}
    />
  );
  return { onDateClick };
}

describe('ContentPlannerCalendar — unscheduled item bucket', () => {
  it('item ที่มี scheduled_date จริง แสดงบน grid ไม่อยู่ใน bucket', () => {
    const item = makeItem({ id: 'scheduled-1', scheduled_date: '2026-01-10', topic: 'มีวันที่แล้ว' });
    renderCalendar({ plans: [makePlan([item])] });

    expect(screen.getByText('มีวันที่แล้ว')).toBeInTheDocument();
    expect(screen.queryByText(/ยังไม่กำหนดวันที่/)).not.toBeInTheDocument();
  });

  it('item ที่ไม่มีทั้ง scheduled_date และ day_label → อยู่ใน bucket', () => {
    const item = makeItem({ id: 'unscheduled-1', scheduled_date: null, day_label: '', topic: 'ไม่มีวันที่เลย' });
    renderCalendar({ plans: [makePlan([item])] });

    expect(screen.getByText(/ยังไม่กำหนดวันที่/)).toBeInTheDocument();
    expect(screen.getByText('ไม่มีวันที่เลย')).toBeInTheDocument();
  });

  it('item ที่มี day_label แต่ไม่มี scheduled_date → ถือเป็น unscheduled เช่นกัน ไม่ใช่ dead key', () => {
    const item = makeItem({ id: 'day-label-only', scheduled_date: null, day_label: 'จันทร์', topic: 'มีแค่ day_label' });
    renderCalendar({ plans: [makePlan([item])] });

    expect(screen.getByText(/ยังไม่กำหนดวันที่/)).toBeInTheDocument();
    expect(screen.getByText('มีแค่ day_label')).toBeInTheDocument();
  });

  it('ไม่แสดง bucket เมื่อไม่มี unscheduled item', () => {
    const item = makeItem({ id: 'scheduled-1', scheduled_date: '2026-01-10' });
    renderCalendar({ plans: [makePlan([item])] });

    expect(screen.queryByText(/ยังไม่กำหนดวันที่/)).not.toBeInTheDocument();
  });

  it('typeFilter กรอง bucket เหมือนที่กรอง grid', () => {
    const item = makeItem({ id: 'unscheduled-video', scheduled_date: null, content_type: 'video', topic: 'วิดีโอไม่มีวันที่' });
    renderCalendar({ plans: [makePlan([item])], typeFilter: 'article' });

    expect(screen.queryByText(/ยังไม่กำหนดวันที่/)).not.toBeInTheDocument();
    expect(screen.queryByText('วิดีโอไม่มีวันที่')).not.toBeInTheDocument();
  });

  it('platformFilter กรอง bucket เหมือนที่กรอง grid', () => {
    const item = makeItem({ id: 'unscheduled-tiktok', scheduled_date: null, platform: 'tiktok', topic: 'TikTok ไม่มีวันที่' });
    renderCalendar({ plans: [makePlan([item])], platformFilter: 'facebook' });

    expect(screen.queryByText(/ยังไม่กำหนดวันที่/)).not.toBeInTheDocument();
  });

  it.each<CalendarView>(['month', 'quarter', 'year'])('bucket แสดงในมุมมอง %s', (view) => {
    const item = makeItem({ id: 'unscheduled-1', scheduled_date: null, topic: 'ไม่มีวันที่เลย' });
    renderCalendar({ plans: [makePlan([item])], view });

    expect(screen.getByText(/ยังไม่กำหนดวันที่/)).toBeInTheDocument();
  });

  it('คลิก chip ใน bucket เรียก onDateClick ด้วย items=[item] นั้น', () => {
    const item = makeItem({ id: 'unscheduled-1', scheduled_date: null, topic: 'คลิกแก้ไขได้' });
    const { onDateClick } = renderCalendar({ plans: [makePlan([item])] });

    screen.getByText('คลิกแก้ไขได้').click();

    expect(onDateClick).toHaveBeenCalledTimes(1);
    const [, items] = onDateClick.mock.calls[0];
    expect(items).toEqual([item]);
  });

  it('ลาก chip จาก bucket ตั้ง dataTransfer payload ตรงกับที่ day cell onDrop ใช้อยู่แล้ว', () => {
    // Regression: chip ใน unscheduled bucket ต้องใช้ dataTransfer shape เดียวกับ
    // chip ใน day cell (renderItemChip ตัวเดียวกัน) เพื่อให้ลากไปวางบนวันที่ใน
    // Calendar ได้โดยไม่ต้องแก้ onDateDrop/onDateDragOver ที่มีอยู่แล้วเลย —
    // ยืนยัน payload ตรงๆ แทนการจำลอง drop ทั้ง flow (HTML5 DnD จำลองผ่าน
    // browser automation ยาก ตามที่บันทึกไว้ตอน apply ขั้น 4)
    const item = makeItem({ id: 'unscheduled-1', plan_id: 'plan-1', scheduled_date: null, topic: 'ลากได้' });
    renderCalendar({ plans: [makePlan([item])] });

    const chip = screen.getByText('ลากได้');
    const setData = vi.fn();
    const dataTransfer = { setData, effectAllowed: '' };

    fireEvent.dragStart(chip, { dataTransfer });

    expect(setData).toHaveBeenCalledTimes(1);
    const [format, payload] = setData.mock.calls[0];
    expect(format).toBe('text/plain');
    expect(JSON.parse(payload)).toEqual({ itemId: 'unscheduled-1', planId: 'plan-1' });
    expect(dataTransfer.effectAllowed).toBe('move');
  });
});

/**
 * openspec/changes/lock-published-content-date — content item ที่มีอย่างน้อย
 * 1 แพลตฟอร์มเผยแพร่สำเร็จแล้ว (has_published_platform=true) ห้ามลากเปลี่ยนวัน
 * บนปฏิทิน ส่วน item อื่นในวันเดียวกันที่ยังไม่เผยแพร่ต้องไม่ได้รับผลกระทบ
 * (การล็อกเป็นแบบ per-item ไม่ใช่ per-day)
 */
describe('ContentPlannerCalendar — published platform lock', () => {
  it('chip ของ item ที่เผยแพร่แล้วบางแพลตฟอร์ม ไม่สามารถลากได้ (draggable=false)', () => {
    const item = makeItem({
      id: 'published-1', scheduled_date: '2026-01-10', topic: 'เผยแพร่ Facebook แล้ว',
      has_published_platform: true,
    });
    renderCalendar({ plans: [makePlan([item])] });

    const chip = screen.getByText('เผยแพร่ Facebook แล้ว');
    expect(chip.getAttribute('draggable')).toBe('false');
  });

  it('chip ของ item ที่ยังไม่เผยแพร่แพลตฟอร์มใดเลย ยังลากได้ตามปกติ (draggable=true)', () => {
    const item = makeItem({
      id: 'not-published-1', scheduled_date: '2026-01-10', topic: 'ยังไม่เผยแพร่',
      has_published_platform: false,
    });
    renderCalendar({ plans: [makePlan([item])] });

    const chip = screen.getByText('ยังไม่เผยแพร่');
    expect(chip.getAttribute('draggable')).toBe('true');
  });

  it('item ที่ไม่ได้ระบุ has_published_platform เลย (undefined) ถือว่ายังลากได้ตามปกติ', () => {
    const item = makeItem({ id: 'legacy-1', scheduled_date: '2026-01-10', topic: 'ไม่มี field ใหม่' });
    renderCalendar({ plans: [makePlan([item])] });

    const chip = screen.getByText('ไม่มี field ใหม่');
    expect(chip.getAttribute('draggable')).toBe('true');
  });

  it('วันเดียวกันมีทั้ง item ที่ล็อกและไม่ล็อก — ล็อกเฉพาะ item ที่เผยแพร่แล้ว ไม่กระทบ item ข้างเคียง', () => {
    const lockedItem = makeItem({
      id: 'locked', scheduled_date: '2026-01-10', topic: 'ล็อกอยู่',
      has_published_platform: true,
    });
    const unlockedItem = makeItem({
      id: 'unlocked', scheduled_date: '2026-01-10', topic: 'ไม่ล็อก',
      has_published_platform: false,
    });
    renderCalendar({ plans: [makePlan([lockedItem, unlockedItem])] });

    expect(screen.getByText('ล็อกอยู่').getAttribute('draggable')).toBe('false');
    expect(screen.getByText('ไม่ล็อก').getAttribute('draggable')).toBe('true');
  });
});

/**
 * openspec/changes/content-type-badge-display — chip เคยแสดงไอคอนแพลตฟอร์ม
 * แยกทีละอัน (สูงสุด 7 อันในพื้นที่ ~80px) เปลี่ยนเป็นแสดงสี/ไอคอนตามประเภท
 * เนื้อหา (บทความ/วีดีโอ) แทน — ไม่ขึ้นกับจำนวนแพลตฟอร์มที่เลือกไว้อีกต่อไป
 */
describe('ContentPlannerCalendar — content type badge (แทนที่ไอคอนแพลตฟอร์ม)', () => {
  it('chip ของ content item ประเภทบทความ มีพื้นหลังโทนฟ้า ไม่มีไอคอนแพลตฟอร์ม', () => {
    const item = makeItem({
      id: 'article-1', scheduled_date: '2026-01-10', topic: 'บทความทดสอบ',
      content_type: 'article', platforms: ['facebook', 'linkedin', 'twitter'],
    });
    renderCalendar({ plans: [makePlan([item])] });

    const chip = screen.getByText('บทความทดสอบ');
    expect(chip.className).toMatch(/bg-blue-50/);
    // ไม่มีไอคอนแพลตฟอร์มเหลืออยู่ — เหลือแค่ไอคอนประเภทเดียว (1 svg)
    expect(chip.querySelectorAll('svg')).toHaveLength(1);
  });

  it('chip ของ content item ประเภทวีดีโอ มีพื้นหลังโทนแดง', () => {
    const item = makeItem({
      id: 'video-1', scheduled_date: '2026-01-10', topic: 'วีดีโอทดสอบ',
      content_type: 'video',
    });
    renderCalendar({ plans: [makePlan([item])] });

    const chip = screen.getByText('วีดีโอทดสอบ');
    expect(chip.className).toMatch(/bg-red-50/);
  });

  it('content item ที่มี 7 แพลตฟอร์ม กับ item ที่มี 1 แพลตฟอร์ม แสดง chip เหมือนกันทุกประการเมื่อประเภทเดียวกัน', () => {
    const many = makeItem({
      id: 'many', scheduled_date: '2026-01-10', topic: 'มีหลายแพลตฟอร์ม',
      content_type: 'article', platforms: ['facebook', 'linkedin', 'twitter', 'instagram', 'lineoa', 'wordpress', 'wix'],
    });
    const one = makeItem({
      id: 'one', scheduled_date: '2026-01-11', topic: 'มีแพลตฟอร์มเดียว',
      content_type: 'article', platforms: ['facebook'],
    });
    renderCalendar({ plans: [makePlan([many, one])] });

    const manyChip = screen.getByText('มีหลายแพลตฟอร์ม');
    const oneChip = screen.getByText('มีแพลตฟอร์มเดียว');
    expect(manyChip.querySelectorAll('svg')).toHaveLength(1);
    expect(oneChip.querySelectorAll('svg')).toHaveLength(1);
    expect(manyChip.className.match(/bg-blue-50/)).toBeTruthy();
    expect(oneChip.className.match(/bg-blue-50/)).toBeTruthy();
  });

  it('ไอคอนล็อกยังแสดงคู่กับ type badge ได้ตามปกติเมื่อเผยแพร่แล้ว', () => {
    const item = makeItem({
      id: 'locked-typed', scheduled_date: '2026-01-10', topic: 'ล็อกแล้วมี type badge',
      content_type: 'video', has_published_platform: true,
    });
    renderCalendar({ plans: [makePlan([item])] });

    const chip = screen.getByText('ล็อกแล้วมี type badge');
    // ไอคอน Lock + ไอคอนประเภท = 2 svg
    expect(chip.querySelectorAll('svg')).toHaveLength(2);
    expect(chip.className).toMatch(/bg-red-50/);
  });
});
