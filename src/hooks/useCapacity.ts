/**
 * src/hooks/useCapacity.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * React Query hooks สำหรับตรวจสอบ Capacity ของพนักงานตามปฏิทินทีม
 *
 * useCapacityCheck  – คำนวณ effective hours ทั้งช่วง (ใช้ใน task/subtask dialog)
 * useDailyCapacity  – ตรวจชั่วโมงในวันเดียว (ใช้ใน task hours / daily view)
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

/** Debounce a value — prevents API spam while user is still picking dates */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayCapacityDetail {
  capacity: number;
  /** working | weekend | holiday | full_leave | partial_leave | override_work | override_off */
  reason: string;
}

export interface DailyLoadDetail {
  capacity: number;
  used: number;
  available: number;
  overloaded: boolean;
}

export interface CapacityCheckResult {
  user_id: string;
  start_date: string;
  end_date: string;
  working_days: number;
  total_capacity: number;
  raw_hours: number | null;
  effective_hours: number | null;
  over_capacity: boolean;
  warning: boolean;
  day_capacities: Record<string, DayCapacityDetail>;
  daily_load: Record<string, DailyLoadDetail>;
}

export interface DailyCapacityResult {
  date: string;
  capacity: number;
  reason: string;
  used: number;
  available: number;
  overloaded: boolean;
}

// ─── useCapacityCheck ─────────────────────────────────────────────────────────

export interface CapacityCheckParams {
  /** assignee_user_id ของ task ที่กำลังสร้าง/แก้ไข */
  assigneeUserId: string | null | undefined;
  startDate: string;
  endDate: string;
  /** estimatedHours ที่พนักงานตั้งไว้ (ถ้าไม่ระบุจะไม่คำนวณ effective_hours) */
  estimatedHours?: number;
  /** ส่ง task id ปัจจุบันเพื่อไม่ให้นับซ้ำกับ daily load */
  excludeTaskId?: string;
  /** เปิด/ปิด query (default true) */
  enabled?: boolean;
}

/**
 * ตรวจสอบ capacity ของพนักงานทั้งช่วงวันที่ของ task.
 * ใช้ใน CreateTaskDialog, CreateSubtaskDialog, TaskDetailSheet
 */
export function useCapacityCheck(params: CapacityCheckParams) {
  const {
    assigneeUserId,
    startDate,
    endDate,
    estimatedHours,
    excludeTaskId,
    enabled = true,
  } = params;

  // Debounce date/hours params 400ms so rapid date-picker changes don't spam the API
  const dAssignee  = useDebounced(assigneeUserId, 400);
  const dStart     = useDebounced(startDate, 400);
  const dEnd       = useDebounced(endDate, 400);
  const dHours     = useDebounced(estimatedHours, 400);

  const ready =
    enabled &&
    !!dAssignee &&
    !!dStart &&
    !!dEnd &&
    dEnd >= dStart;

  const qs = new URLSearchParams({
    user_id:    dAssignee ?? '',
    start_date: dStart,
    end_date:   dEnd,
    ...(dHours !== undefined && { estimated_hours: String(dHours) }),
    ...(excludeTaskId && { exclude_task_id: excludeTaskId }),
  });

  return useQuery<CapacityCheckResult>({
    queryKey: ['capacity-check', dAssignee, dStart, dEnd, dHours, excludeTaskId],
    queryFn:  () => apiFetch<CapacityCheckResult>(`/capacity.php?${qs}`),
    enabled:  ready,
    staleTime: 60_000,
    retry: 1,
  });
}

// ─── useDailyCapacity ─────────────────────────────────────────────────────────

export interface DailyCapacityParams {
  assigneeUserId: string | null | undefined;
  date: string;
  excludeTaskId?: string;
  enabled?: boolean;
}

/**
 * ตรวจสอบชั่วโมงที่ใช้ไปแล้ว vs ที่เหลือในวันนั้นๆ.
 * ใช้ใน TimesheetPage, inline subtask form
 */
export function useDailyCapacity(params: DailyCapacityParams) {
  const { assigneeUserId, date, excludeTaskId, enabled = true } = params;

  const ready = enabled && !!assigneeUserId && !!date;

  const qs = new URLSearchParams({
    user_id:    assigneeUserId ?? '',
    start_date: date,
    end_date:   date,
    check_date: date,
    ...(excludeTaskId && { exclude_task_id: excludeTaskId }),
  });

  return useQuery<DailyCapacityResult>({
    queryKey: ['daily-capacity', assigneeUserId, date, excludeTaskId],
    queryFn:  () => apiFetch<DailyCapacityResult>(`/capacity.php?${qs}`),
    enabled:  ready,
    staleTime: 30_000,
    retry: 1,
  });
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/**
 * ดึง warning message สำหรับแสดงใน UI
 * คืนค่า null ถ้าไม่มี warning
 */
export function getCapacityWarningMessage(data: CapacityCheckResult | undefined): string | null {
  if (!data || !data.warning) return null;

  const over = (data.raw_hours ?? 0) - data.total_capacity;
  if (data.working_days === 0) {
    return 'ไม่มีวันทำงานในช่วงวันที่นี้ (วันหยุดหรือวันลาทั้งหมด)';
  }
  return (
    `ชั่วโมงประมาณ (${data.raw_hours} ชม.) เกิน Capacity จริง` +
    ` (${data.total_capacity} ชม. ใน ${data.working_days} วันทำงาน) — เกินไป ${over.toFixed(1)} ชม.`
  );
}

/**
 * ตรวจสอบว่ามีวันไหนที่ overloaded หรือไม่
 * คืน array ของวันที่เกิน capacity
 */
export function getOverloadedDays(data: CapacityCheckResult | undefined): string[] {
  if (!data?.daily_load) return [];
  return Object.entries(data.daily_load)
    .filter(([, v]) => v.overloaded)
    .map(([d]) => d);
}
