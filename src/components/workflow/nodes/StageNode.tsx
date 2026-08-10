import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';
import { cn } from '@/lib/utils';

interface Props { data: WorkflowNodeData; selected?: boolean; }

const heatColors: Record<string, string> = {
  ok:       'border-emerald-400 bg-emerald-50',
  warn:     'border-amber-400 bg-amber-50',
  critical: 'border-red-500 bg-red-50',
};
const subHeat: Record<string, string> = {
  ok: 'text-emerald-600', warn: 'text-amber-600', critical: 'text-red-600',
};

export function StageNode({ data, selected }: Props) {
  const [expanded, setExpanded] = useState(false);
  const heat = data.heatLevel ?? 'ok';
  const hasSubSteps = (data.subSteps ?? []).length > 0;

  return (
    <div className={cn('min-w-[160px] rounded-lg border-2 shadow-sm bg-white', heatColors[heat], selected && 'ring-2 ring-blue-400')}>
      <Handle type="target" position={Position.Left} />
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">{data.label}</span>
          {hasSubSteps && (
            <button onClick={() => setExpanded(v => !v)} className="text-slate-400 hover:text-slate-600">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}
        </div>
        {data.avgCycleMinutes != null && (
          <div className="text-xs text-slate-500 mt-0.5">
            เฉลี่ย {Math.round((data.avgCycleMinutes / 60) * 10) / 10} ชม.
            {data.queueDepth != null && data.queueDepth > 0 && (
              <span className="ml-2 text-amber-600">ค้าง {data.queueDepth}</span>
            )}
          </div>
        )}
      </div>
      {expanded && hasSubSteps && (
        <div className="border-t border-slate-200 px-3 py-1.5 space-y-1">
          {data.subSteps!.map(s => (
            <div key={s.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-600 truncate max-w-[110px]">{s.name}</span>
              <span className={cn('font-medium ml-2', subHeat[s.heatLevel])}>
                {Math.round((s.durationMinutes / 60) * 10) / 10}ชม.
              </span>
            </div>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
