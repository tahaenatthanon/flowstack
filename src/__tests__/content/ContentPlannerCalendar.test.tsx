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
