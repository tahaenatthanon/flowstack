import { Handle, Position } from '@xyflow/react';
import { Bell } from 'lucide-react';
import type { WorkflowNodeData } from '@/types/workflow';

interface Props { data: WorkflowNodeData; }

export function NotifyNode({ data }: Props) {
  return (
    <div className="min-w-[120px] rounded-lg border-2 border-blue-300 bg-blue-50 px-3 py-2 shadow-sm">
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-1.5">
        <Bell size={14} className="text-blue-500" />
        <span className="text-sm font-medium text-blue-700">{data.label}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
