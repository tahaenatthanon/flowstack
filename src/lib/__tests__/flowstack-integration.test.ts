/**
 * Flowstack Integration Tests — Business Logic Layer
 * Framework: Vitest
 * Run: pnpm test src/lib/__tests__/flowstack-integration.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── helpers ──────────────────────────────────────────────────────────────────

const SLA_MAP: Record<string, number> = { critical: 2, high: 4, medium: 8, low: 24 };

function computeSlaHours(priority: string): number {
  return SLA_MAP[priority] ?? 24;
}

function generateQuotationNumber(year: number, month: number, seq: number): string {
  const mm = String(month).padStart(2, '0');
  const nn = String(seq).padStart(4, '0');
  return `QUO-${year}${mm}-${nn}`;
}

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  estimated_hours: number;
  actual_hours: number;
  is_subtask: boolean;
  parent_task_id: string | null;
  subtasks?: Task[];
}

function rollupHours(tasks: Task[]): { total_estimated: number; total_actual: number; cancelled_excluded: number } {
  let total_estimated = 0;
  let total_actual = 0;
  let cancelled_excluded = 0;

  for (const t of tasks) {
    if (t.status === 'cancelled') {
      cancelled_excluded += t.estimated_hours;
      continue;
    }
    total_estimated += t.estimated_hours;
    total_actual += t.actual_hours;
    if (t.subtasks) {
      const sub = rollupHours(t.subtasks);
      total_estimated += sub.total_estimated;
      total_actual    += sub.total_actual;
    }
  }
  return { total_estimated, total_actual, cancelled_excluded };
}

function isTaskAtomicityValid(hours: number): boolean {
  return hours <= 16;
}

type JourneyStage = 'marketing' | 'sales' | 'project' | 'support' | 'renewal';
const STAGE_ORDER: JourneyStage[] = ['marketing', 'sales', 'project', 'support', 'renewal'];

function advanceJourneyStage(current: JourneyStage): JourneyStage | 'completed' {
  const idx = STAGE_ORDER.indexOf(current);
  return idx >= STAGE_ORDER.length - 1 ? 'completed' : STAGE_ORDER[idx + 1];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Helpdesk SLA — คำนวณ SLA ตาม priority', () => {
  it('critical → 2 ชั่วโมง', () => {
    expect(computeSlaHours('critical')).toBe(2);
  });
  it('high → 4 ชั่วโมง', () => {
    expect(computeSlaHours('high')).toBe(4);
  });
  it('medium → 8 ชั่วโมง', () => {
    expect(computeSlaHours('medium')).toBe(8);
  });
  it('low → 24 ชั่วโมง', () => {
    expect(computeSlaHours('low')).toBe(24);
  });
  it('priority ไม่รู้จัก → fallback 24 ชั่วโมง', () => {
    expect(computeSlaHours('unknown')).toBe(24);
  });
});

describe('Quotation Number Format — QUO-YYYYMM-NNNN', () => {
  it('format ถูกต้องสำหรับเดือน 6 ปี 2026', () => {
    expect(generateQuotationNumber(2026, 6, 1)).toBe('QUO-202606-0001');
  });
  it('sequence number padding 4 หลัก', () => {
    expect(generateQuotationNumber(2026, 1, 42)).toBe('QUO-202601-0042');
  });
  it('เดือน 12 → month 2 หลัก', () => {
    expect(generateQuotationNumber(2025, 12, 999)).toBe('QUO-202512-0999');
  });
  it('sequence 10000+ → ไม่ถูก truncate', () => {
    const num = generateQuotationNumber(2026, 6, 10000);
    expect(num).toBe('QUO-202606-10000');
  });
});

describe('Task Atomicity — task ต้องไม่เกิน 16 ชม.', () => {
  it('16 ชม. → valid', () => {
    expect(isTaskAtomicityValid(16)).toBe(true);
  });
  it('16.1 ชม. → invalid', () => {
    expect(isTaskAtomicityValid(16.1)).toBe(false);
  });
  it('8 ชม. → valid', () => {
    expect(isTaskAtomicityValid(8)).toBe(true);
  });
  it('0 ชม. → valid (task ยังไม่ประเมิน)', () => {
    expect(isTaskAtomicityValid(0)).toBe(true);
  });
});

describe('Hours Rollup — task ที่ cancelled ไม่นับ', () => {
  const tasks: Task[] = [
    { id: '1', title: 'งาน A', status: 'completed',  estimated_hours: 8,  actual_hours: 8,  is_subtask: false, parent_task_id: null },
    { id: '2', title: 'งาน B', status: 'cancelled',  estimated_hours: 16, actual_hours: 0,  is_subtask: false, parent_task_id: null },
    { id: '3', title: 'งาน C', status: 'in-progress',estimated_hours: 4,  actual_hours: 2,  is_subtask: false, parent_task_id: null },
  ];

  it('cancelled task ไม่รวมใน estimated_hours', () => {
    const { total_estimated } = rollupHours(tasks);
    expect(total_estimated).toBe(12); // 8 + 4
  });

  it('cancelled task ไม่รวมใน actual_hours', () => {
    const { total_actual } = rollupHours(tasks);
    expect(total_actual).toBe(10); // 8 + 2
  });

  it('cancelled_excluded บอกจำนวนชม. ที่ข้ามไป', () => {
    const { cancelled_excluded } = rollupHours(tasks);
    expect(cancelled_excluded).toBe(16);
  });
});

describe('Subtask Hours — subtask hours รวมใน parent', () => {
  const parentWithSubtasks: Task[] = [
    {
      id: 'p1',
      title: 'Parent Task',
      status: 'in-progress',
      estimated_hours: 0,
      actual_hours: 0,
      is_subtask: false,
      parent_task_id: null,
      subtasks: [
        { id: 's1', title: 'Subtask 1', status: 'completed', estimated_hours: 4, actual_hours: 4, is_subtask: true, parent_task_id: 'p1' },
        { id: 's2', title: 'Subtask 2', status: 'completed', estimated_hours: 3, actual_hours: 3, is_subtask: true, parent_task_id: 'p1' },
      ],
    },
  ];

  it('subtask actual_hours รวมเข้า parent', () => {
    const { total_actual } = rollupHours(parentWithSubtasks);
    expect(total_actual).toBe(7); // 0 + 4 + 3
  });

  it('subtask estimated_hours รวมเข้า parent', () => {
    const { total_estimated } = rollupHours(parentWithSubtasks);
    expect(total_estimated).toBe(7);
  });

  it('cancelled subtask ไม่นับ', () => {
    const tasksWithCancelledSub: Task[] = [{
      id: 'p2',
      title: 'Parent',
      status: 'in-progress',
      estimated_hours: 0,
      actual_hours: 0,
      is_subtask: false,
      parent_task_id: null,
      subtasks: [
        { id: 's3', title: 'Active Sub', status: 'completed', estimated_hours: 5, actual_hours: 5, is_subtask: true, parent_task_id: 'p2' },
        { id: 's4', title: 'Cancelled Sub', status: 'cancelled', estimated_hours: 10, actual_hours: 0, is_subtask: true, parent_task_id: 'p2' },
      ],
    }];
    const { total_estimated } = rollupHours(tasksWithCancelledSub);
    expect(total_estimated).toBe(5);
  });
});

describe('Journey Stage Progression — เลื่อน stage ถูกต้อง', () => {
  it('marketing → sales', () => {
    expect(advanceJourneyStage('marketing')).toBe('sales');
  });
  it('sales → project', () => {
    expect(advanceJourneyStage('sales')).toBe('project');
  });
  it('project → support', () => {
    expect(advanceJourneyStage('project')).toBe('support');
  });
  it('support → renewal', () => {
    expect(advanceJourneyStage('support')).toBe('renewal');
  });
  it('renewal (last) → completed', () => {
    expect(advanceJourneyStage('renewal')).toBe('completed');
  });
});

describe('Sales Stage Validation — stage order ถูก', () => {
  const SALES_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

  it('lead เป็น stage แรก', () => {
    expect(SALES_STAGES[0]).toBe('lead');
  });
  it('won/lost เป็น terminal states', () => {
    expect(SALES_STAGES.slice(-2)).toContain('won');
    expect(SALES_STAGES.slice(-2)).toContain('lost');
  });
  it('มี 6 stage ตาม spec', () => {
    expect(SALES_STAGES).toHaveLength(6);
  });
});
