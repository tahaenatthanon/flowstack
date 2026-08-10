import { Handle, Position } from '@xyflow/react';
import { Clock } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';

interface Props { data: WorkflowNodeData; }

export function DelayNode({ data }: Props) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-slate-300 bg-slate-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5">
        <Clock size={14} className="text-slate-500" />
        <span className="text-sm font-medium text-slate-700">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
