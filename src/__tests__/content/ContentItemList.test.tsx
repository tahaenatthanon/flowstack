import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContentItemList } from '@/components/content/ContentItemList';
import type { ContentPlan, PlanItem } from '@/components/content/types';

/**
 * openspec/changes/content-planner-platform-filter-fix — platformFilter เคย
 * เทียบ item.platform === platformFilter แบบ exact-match ซึ่ง item.platform
 * เป็นสตริงรวมหลายแพลตฟอร์มคั่นด้วย comma (เช่น "facebook,linkedin") ทำให้
 * item หลายแพลตฟอร์มไม่มีทาง match กับตัวกรองใดๆ เลยแม้จะมีแพลตฟอร์มนั้นจริง
 */

function makeItem(overrides: Partial<PlanItem>): PlanItem {
  return {
    id: 'item-1', plan_id: 'plan-1', day_label: '', day_order: 0,
    scheduled_date: '2026-01-10', platform: 'facebook', topic: 'หัวข้อทดสอบ',
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

function renderList(props: { plans: ContentPlan[]; typeFilter?: string; platformFilter?: string }) {
  render(
    <ContentItemList
      plans={props.plans}
      onEditItem={vi.fn()}
      onDeleteItem={vi.fn()}
      typeFilter={props.typeFilter ?? 'all'}
      platformFilter={props.platformFilter ?? 'all'}
    />
  );
}

describe('ContentItemList — platformFilter match กับ content item หลายแพลตฟอร์ม', () => {
  it('item ที่มีหลายแพลตฟอร์ม ปรากฏเมื่อกรองด้วยแพลตฟอร์มที่มันมี', () => {
    const item = makeItem({ id: 'multi-1', topic: 'มีหลายแพลตฟอร์ม', platforms: ['facebook', 'linkedin'] });
    renderList({ plans: [makePlan([item])], platformFilter: 'linkedin' });

    expect(screen.getByText('มีหลายแพลตฟอร์ม')).toBeInTheDocument();
  });

  it('item ที่มีหลายแพลตฟอร์ม ไม่ปรากฏเมื่อกรองด้วยแพลตฟอร์มที่มันไม่มี', () => {
    const item = makeItem({ id: 'multi-2', topic: 'ไม่มี youtube', platforms: ['facebook', 'linkedin'] });
    renderList({ plans: [makePlan([item])], platformFilter: 'youtube' });

    expect(screen.queryByText('ไม่มี youtube')).not.toBeInTheDocument();
    expect(screen.getByText(/ยังไม่มีบทความ|ไม่พบบทความ/)).toBeInTheDocument();
  });

  it('item แพลตฟอร์มเดียวยังกรองถูกต้องเหมือนเดิม (ไม่ถดถอย)', () => {
    const item = makeItem({ id: 'single-1', topic: 'แพลตฟอร์มเดียว', platform: 'facebook' });
    renderList({ plans: [makePlan([item])], platformFilter: 'facebook' });

    expect(screen.getByText('แพลตฟอร์มเดียว')).toBeInTheDocument();
  });

  it('platformFilter="all" แสดงทุก item โดยไม่กรองตามแพลตฟอร์ม', () => {
    const item = makeItem({ id: 'multi-3', topic: 'ไม่กรอง', platforms: ['facebook', 'linkedin'] });
    renderList({ plans: [makePlan([item])], platformFilter: 'all' });

    expect(screen.getByText('ไม่กรอง')).toBeInTheDocument();
  });
});
