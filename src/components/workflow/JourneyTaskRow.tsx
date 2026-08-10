import { cn } from '@/lib/utils';
import type { JourneyTask } from '@/types/journey';

const STATUS_CHECK: Record<string, { cls: string; icon: string }> = {
  completed:     { cls: 'bg-green-500 text-white',   icon: '✓' },
  in_progress:   { cls: 'bg-violet-600 text-white',  icon: '▶' },
  'in-progress': { cls: 'bg-violet-600 text-white',  icon: '▶' },
  cancelled:     { cls: 'bg-slate-400 text-white',   icon: '×' },
  blocked:       { cls: 'bg-red-500 text-white',     icon: '!' },
  overdue:       { cls: 'bg-amber-500 text-white',   icon: '⚠' },
};
function checkProps(status: string) {
  return STATUS_CHECK[status] ?? { cls: 'bg-slate-200 text-slate-500', icon: '○' };
}

const TASK_ROW_BG: Record<string, string> = {
  completed:     'bg-green-50 border-green-200',
  in_progress:   'bg-violet-50 border-violet-200',
  'in-progress': 'bg-violet-50 border-violet-200',
  blocked:       'bg-red-50 border-red-200',
  overdue:       'bg-amber-50 border-amber-200',
};

interface Props {
  task: JourneyTask;
  isOpen: boolean;
  onToggle: () => void;
}

export function JourneyTaskRow({ task, isOpen, onToggle }: Props) {
  const check  = checkProps(task.status);
  const rowBg  = TASK_ROW_BG[task.status] ?? 'bg-slate-50 border-slate-100';
  const ownerName = [task.first_name, task.last_name].filter(Boolean).join(' ') || null;
  const doneSubtasks = task.subtasks.filter(s => s.status === 'completed').length;

  return (
    <div className={cn('rounded-lg overflow-hidden border', rowBg, task.status === 'in_progress' && 'border-violet-300')}>
      <button
        className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 hover:brightness-95 transition-all text-left', rowBg)}
        onClick={onToggle}
      >
        <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0', check.cls)}>
          {check.icon}
        </div>
        <span className={cn('text-[10px] font-semibold flex-1 min-w-0 truncate',
          task.status === 'blocked' ? 'text-red-700' : 'text-slate-800'
        )}>
          {task.name}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {ownerName && (
            <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600">{ownerName}</span>
          )}
          {task.actual_hours != null && (
            <span className="text-[9px] text-slate-500">{task.actual_hours}ชม.</span>
          )}
          {task.status === 'in_progress' && task.due_date && (
            <span className="text-[8px] text-red-600 font-bold">ครบ {task.due_date.slice(0, 10)}</span>
          )}
          <span className={cn('text-[10px] text-slate-400 transition-transform flex-shrink-0', isOpen && 'rotate-180')}>▼</span>
        </div>
      </button>

      {isOpen && (
        <div className="px-3 pt-2 pb-3 bg-white border-t border-slate-100 ml-4">
          <div className="flex flex-wrap gap-3 mb-2">
            {task.start_date && (
              <span className="text-[9px]"><span className="text-slate-400">เริ่ม:</span><span className="font-semibold ml-1">{task.start_date.slice(0, 10)}</span></span>
            )}
            {task.completed_date && (
              <span className="text-[9px]"><span className="text-slate-400">เสร็จ:</span><span className="font-semibold ml-1">{task.completed_date.slice(0, 10)}</span></span>
            )}
            {task.actual_hours != null && (
              <span className="text-[9px]"><span className="text-slate-400">ชั่วโมงจริง:</span><span className="font-semibold ml-1">{task.actual_hours} ชม.</span></span>
            )}
            {task.estimated_hours != null && (
              <span className="text-[9px]"><span className="text-slate-400">ประมาณ:</span><span className="font-semibold ml-1">{task.estimated_hours} ชม.</span></span>
            )}
          </div>

          {task.subtasks.length > 0 && (
            <>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">งานย่อย</p>
              <div className="flex flex-col gap-1">
                {task.subtasks.map(sub => {
                  const sc = checkProps(sub.status);
                  const subOwner = [sub.first_name, sub.last_name].filter(Boolean).join(' ');
                  return (
                    <div key={sub.id} className="flex items-center gap-1.5 bg-slate-50 rounded-md px-2 py-1">
                      <div className={cn('w-3 h-3 rounded-full flex items-center justify-center text-[7px] font-bold flex-shrink-0', sc.cls)}>
                        {sc.icon}
                      </div>
                      <span className="text-[9px] flex-1 text-slate-700 min-w-0 truncate">{sub.name}</span>
                      {sub.actual_hours != null && (
                        <span className="text-[8px] text-slate-400 whitespace-nowrap">{sub.actual_hours}ชม.</span>
                      )}
                      {subOwner && (
                        <span className="text-[8px] text-slate-400 whitespace-nowrap">{subOwner}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${task.subtasks.length > 0 ? (doneSubtasks / task.subtasks.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-[8px] text-slate-500 whitespace-nowrap">
                  {doneSubtasks}/{task.subtasks.length} งานย่อย
                </span>
              </div>
            </>
          )}

          {task.notes && (
            <div className={cn(
              'mt-2 text-[9px] rounded-md px-2 py-1.5 border-l-2 italic',
              task.status === 'blocked'
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'bg-slate-50 border-slate-300 text-slate-500'
            )}>
              {task.status === 'blocked' ? '🔴 ' : '📝 '}{task.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
