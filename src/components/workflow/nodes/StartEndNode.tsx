import { Handle, Position } from '@xyflow/react';
import type { WorkflowNodeData } from '@/types/workflow';

interface Props { data: WorkflowNodeData; }

export function StartEndNode({ data }: Props) {
  const isStart = data.nodeType === 'start';
  return (
    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-md ${isStart ? 'bg-emerald-500' : 'bg-slate-500'}`}>
      <span className="text-center px-1">{data.label}</span>
      {!isStart && <Handle type="target" position={Position.Left} />}
      {isStart && <Handle type="source" position={Position.Right} />}
    </div>
  );
}
