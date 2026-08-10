import { Link2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JourneyTaskRow } from './JourneyTaskRow';
import type { JourneyStageData, JourneyStage } from '@/types/journey';

const STAGE_CONFIG: Record<JourneyStage, { emoji: string; label: string; iconBg: string }> = {
  marketing: { emoji: '📣', label: 'การตลาด',   iconBg: 'bg-blue-100' },
  sales:     { emoji: '💼', label: 'การขาย',    iconBg: 'bg-violet-100' },
  project:   { emoji: '🚀', label: 'โปรเจค',    iconBg: 'bg-yellow-100' },
  support:   { emoji: '🎧', label: 'ซัพพอร์ต', iconBg: 'bg-red-100' },
  renewal:   { emoji: '🔄', label: 'ต่ออายุ',  iconBg: 'bg-green-100' },
};

const ENTITY_ROUTE: Record<string, string> = {
  opportunity:    '/#/sales',
  project:        '/#/projects',
  support_ticket: '/#/support',
};

interface Props {
  stageNum: number;
  data: JourneyStageData;
  isOpen: boolean;
  onToggleStage: () => void;
  openTasks: Set<string>;
  onToggleTask: (taskId: string) => void;
  onLinkStage?: () => void;
  onCompleteStage?: () => void;
}

export function JourneyStageCard({ stageNum, data, isOpen, onToggleStage, openTasks, onToggleTask, onLinkStage, onCompleteStage }: Props) {
  const cfg = STAGE_CONFIG[data.stage];
  const isActive   = data.status === 'active';
  const isDone     = data.status === 'completed';
  const isFuture   = data.status === 'pending' || data.status === 'skipped';
  const isCritical = data.sla_exceeded;

  const slaPercent = data.sla_days && data.days_in_stage != null
    ? Math.min((data.days_in_stage / data.sla_days) * 100, 100)
    : 0;

  const cardBorder = isCritical
    ? 'border-red-400 shadow-[0_0_0_3px_rgba(239,68,68,.08)]'
    : isActive
    ? 'border-violet-400 shadow-[0_0_0_3px_rgba(124,58,237,.08)]'
    : isDone
    ? 'border-green-300'
    : 'border-slate-200';

  const doneTasks = data.tasks.filter(t => t.status === 'completed').length;
  const activeTasks = data.tasks.filter(t => ['in_progress', 'in-progress', 'blocked', 'overdue'].includes(t.status)).length;

  return (
    <div className={cn('bg-white rounded-xl border-[1.5px] overflow-hidden', cardBorder, isFuture && 'opacity-55')}>
      <button
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-slate-50 transition-colors text-left"
        onClick={onToggleStage}
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0', cfg.iconBg)}>
          {cfg.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-slate-800">{stageNum}. {cfg.label}</div>
          <div className="text-[9px] text-slate-500 mt-0.5 truncate">
            {data.entity_name
              ? data.entity_name
              : isFuture
              ? 'รอ stage ก่อนหน้าเสร็จ'
              : 'ยังไม่ผูก entity'}
            {data.tasks.length > 0 && ` · ${doneTasks}/${data.tasks.length} งาน`}
            {activeTasks > 0 && ` · ${activeTasks} กำลังทำ`}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', isCritical ? 'bg-red-500' : isDone ? 'bg-green-500' : 'bg-violet-500')}
              style={{ width: `${slaPercent}%` }}
            />
          </div>
          <span className={cn('text-[9px] whitespace-nowrap', isCritical ? 'text-red-600 font-bold' : 'text-slate-400')}>
            {data.days_in_stage ?? 0}/{data.sla_days ?? '?'} วัน{isCritical ? ' ⚠' : ''}
          </span>
        </div>

        <span className={cn(
          'text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0',
          isCritical ? 'bg-red-100 text-red-700'
          : isDone    ? 'bg-green-100 text-green-700'
          : isActive  ? 'bg-violet-100 text-violet-700'
          : 'bg-slate-100 text-slate-500'
        )}>
          {isCritical ? '⚠ เกิน SLA' : isDone ? '✓ เสร็จแล้ว' : isActive ? '▶ กำลังทำ' : 'รอ'}
        </span>

        <span className={cn('text-[10px] text-slate-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')}>▼</span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100">
          {data.entity_name && data.entity_type && (
            <div className={cn(
              'flex items-center gap-2 px-3.5 py-2 text-[10px] border-b border-slate-100',
              isCritical ? 'bg-red-50' : 'bg-slate-50'
            )}>
              <span>{cfg.emoji}</span>
              <div>
                <span className="font-semibold text-slate-800">{data.entity_name}</span>
                {isCritical && (
                  <span className="ml-2 text-red-600">
                    เกิน SLA {(data.days_in_stage ?? 0) - (data.sla_days ?? 0)} วัน
                  </span>
                )}
              </div>
              {data.entity_type && ENTITY_ROUTE[data.entity_type] && (
                <a
                  href={ENTITY_ROUTE[data.entity_type]}
                  className="ml-auto text-violet-600 text-[9px] underline font-bold whitespace-nowrap"
                  onClick={e => e.stopPropagation()}
                >
                  ดูรายละเอียด →
                </a>
              )}
            </div>
          )}

          <div className="px-3.5 py-2.5 flex flex-col gap-1.5">
            {data.tasks.length > 0 && (
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                งานใน {cfg.label} Stage
              </p>
            )}
            {data.tasks.map(task => (
              <JourneyTaskRow
                key={task.id}
                task={task}
                isOpen={openTasks.has(task.id)}
                onToggle={() => onToggleTask(task.id)}
              />
            ))}
            {data.tasks.length === 0 && (
              <p className="text-[9px] text-slate-400 text-center py-2">
                {isFuture ? 'งานจะแสดงเมื่อ stage นี้เริ่มต้น' : 'ไม่มีงานใน stage นี้'}
              </p>
            )}
            {isCritical && (
              <div className="mt-1 bg-red-50 border border-red-200 rounded-md px-2.5 py-2 text-[9px] text-red-700 flex items-center gap-1.5">
                🔴 Stage นี้เกิน SLA แล้ว — กรุณาตรวจสอบความคืบหน้าใน {cfg.label}
              </div>
            )}

            {/* Action buttons */}
            {(onLinkStage || onCompleteStage) && (
              <div className="flex gap-1.5 mt-2 pt-2 border-t border-slate-100">
                {onLinkStage && (
                  <button
                    onClick={e => { e.stopPropagation(); onLinkStage(); }}
                    className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  >
                    <Link2 size={9} /> ผูกรายการ
                  </button>
                )}
                {onCompleteStage && (
                  <button
                    onClick={e => { e.stopPropagation(); onCompleteStage(); }}
                    className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md border border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                  >
                    <CheckCircle2 size={9} /> ทำเครื่องหมายเสร็จ
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
