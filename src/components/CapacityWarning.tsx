/**
 * src/components/CapacityWarning.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Component สำหรับแสดง Capacity Warning ฝั่ง React
 *
 * ใช้งาน:
 *   <CapacityWarning
 *     assigneeUserId={assigneeUserId}
 *     startDate={startDate}
 *     endDate={endDate}
 *     estimatedHours={computedHours}
 *     excludeTaskId={editTask?.id}
 *   />
 *
 * แสดงผลแบบ inline เฉพาะเมื่อมี warning เท่านั้น (ไม่ render อะไรถ้าปกติ)
 */

import { AlertTriangle, Clock, CalendarOff, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useCapacityCheck,
  getCapacityWarningMessage,
  getOverloadedDays,
  type CapacityCheckResult,
} from '@/hooks/useCapacity';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapacityWarningProps {
  assigneeUserId: string | null | undefined;
  startDate: string;
  endDate: string;
  estimatedHours: number;
  excludeTaskId?: string;
  /** แสดง breakdown per-day ด้วยหรือไม่ (default false) */
  showDayBreakdown?: boolean;
  className?: string;
}

// ─── Day reason labels ────────────────────────────────────────────────────────

const DAY_REASON_LABELS: Record<string, { label: string; color: string }> = {
  working:       { label: 'ทำงาน',               color: 'text-green-700 bg-green-50' },
  weekend:       { label: 'หยุดสุดสัปดาห์',      color: 'text-gray-500 bg-gray-100' },
  holiday:       { label: 'วันหยุดบริษัท',        color: 'text-blue-700 bg-blue-50' },
  full_leave:    { label: 'ลาเต็มวัน',            color: 'text-yellow-700 bg-yellow-50' },
  partial_leave: { label: 'ลาครึ่งวัน',           color: 'text-yellow-600 bg-yellow-50' },
  override_work: { label: 'วันทำงาน (สลับวัน)',   color: 'text-purple-700 bg-purple-50' },
  override_off:  { label: 'วันหยุด (สลับวัน)',    color: 'text-orange-700 bg-orange-50' },
};

function getDayReasonCfg(reason: string) {
  return DAY_REASON_LABELS[reason] ?? { label: reason, color: 'text-muted-foreground bg-muted' };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayBreakdownRow({
  date,
  capacity,
  reason,
  used,
  available,
  overloaded,
}: {
  date: string;
  capacity: number;
  reason: string;
  used?: number;
  available?: number;
  overloaded?: boolean;
}) {
  const cfg      = getDayReasonCfg(reason);
  const dateLabel = format(parseISO(date), 'EEE d MMM', { locale: th });

  return (
    <div className={cn('flex items-center justify-between text-[11px] px-2 py-1 rounded', overloaded && 'bg-destructive/10')}>
      <span className="w-24 shrink-0 text-muted-foreground">{dateLabel}</span>
      <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium', cfg.color)}>
        {cfg.label}
      </span>
      <span className="tabular-nums ml-auto pl-2">
        {capacity > 0 ? (
          <>
            <span className={cn('font-medium', overloaded ? 'text-destructive' : 'text-foreground')}>
              {used !== undefined ? `${used.toFixed(1)} / ` : ''}
            </span>
            <span className="text-muted-foreground">{capacity.toFixed(1)} ชม.</span>
            {available !== undefined && available > 0 && (
              <span className="text-green-600 ml-1">(เหลือ {available.toFixed(1)})</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground/60">— ไม่นับ</span>
        )}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CapacityWarning({
  assigneeUserId,
  startDate,
  endDate,
  estimatedHours,
  excludeTaskId,
  showDayBreakdown = false,
  className,
}: CapacityWarningProps) {
  const { data, isLoading, isError } = useCapacityCheck({
    assigneeUserId,
    startDate,
    endDate,
    estimatedHours,
    excludeTaskId,
    enabled: !!assigneeUserId && !!startDate && !!endDate && estimatedHours > 0,
  });

  // ไม่ render อะไรถ้ายังโหลดอยู่ หรือ error หรือไม่มี warning
  if (isLoading || isError || !data) return null;

  const warningMsg    = getCapacityWarningMessage(data);
  const overloadedDays = getOverloadedDays(data);

  // ไม่มีปัญหา — แสดงแค่ info เบาๆ (ไม่บังคับ)
  if (!warningMsg && overloadedDays.length === 0) {
    // แสดงสรุปสั้นๆ ว่าผ่าน — ไม่แสดงอะไรถ้า showDayBreakdown = false
    if (!showDayBreakdown) return null;

    return (
      <div className={cn('text-[11px] text-green-700 flex items-center gap-1', className)}>
        <Info className="h-3 w-3 shrink-0" />
        {data.working_days} วันทำงาน, Capacity รวม {data.total_capacity} ชม.
        {data.effective_hours !== null && ` (ประมาณ ${data.effective_hours} ชม.)`}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* ─── Warning Banner ─── */}
      {warningMsg && (
        <div className="flex gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">เกิน Capacity ของพนักงาน</p>
            <p className="text-xs">{warningMsg}</p>
            {data.effective_hours !== null && data.effective_hours < (data.raw_hours ?? 0) && (
              <p className="text-xs">
                ระบบจะบันทึก <strong>{data.effective_hours} ชม.</strong> เป็น effective hours
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Overloaded days banner ─── */}
      {overloadedDays.length > 0 && (
        <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">มีวันที่ชั่วโมงงานเกิน 8 ชม./วัน</p>
            <p className="text-xs">
              {overloadedDays.map(d => format(parseISO(d), 'EEE d MMM', { locale: th })).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* ─── No working days ─── */}
      {data.working_days === 0 && (
        <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" />
          <p>ช่วงวันที่นี้ไม่มีวันทำงาน (วันหยุดหรือวันลาทั้งหมด)</p>
        </div>
      )}

      {/* ─── Day Breakdown (optional) ─── */}
      {showDayBreakdown && Object.keys(data.day_capacities).length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
            ดู Capacity รายวัน ({data.working_days} วันทำงาน / {data.total_capacity} ชม. รวม)
          </summary>
          <div className="mt-1.5 space-y-0.5 rounded border p-1.5">
            {Object.entries(data.day_capacities).map(([date, cap]) => {
              const load = data.daily_load[date];
              return (
                <DayBreakdownRow
                  key={date}
                  date={date}
                  capacity={cap.capacity}
                  reason={cap.reason}
                  used={load?.used}
                  available={load?.available}
                  overloaded={load?.overloaded}
                />
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Compact version for inline use ──────────────────────────────────────────

/**
 * แสดงเฉพาะบรรทัดเดียว เช่น "(เหลือ 4.0 ชม. วันนี้)"
 * ใช้ใน inline subtask row หรือ subtask hour entry
 */
export function DailyCapacityBadge({
  available,
  overloaded,
}: {
  available: number;
  overloaded: boolean;
}) {
  if (overloaded) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive font-medium">
        <AlertTriangle className="h-3 w-3" /> เกิน capacity
      </span>
    );
  }
  if (available <= 0) return null;
  return (
    <span className="text-[10px] text-muted-foreground">
      เหลือ {available.toFixed(1)} ชม.
    </span>
  );
}
