import { Handle, Position } from '@xyflow/react';
import type { WorkflowNodeData } from '@/types/workflow';

interface Props { data: WorkflowNodeData; }

export function DecisionNode({ data }: Props) {
  return (
    <div className="w-20 h-20 rotate-45 bg-yellow-100 border-2 border-yellow-400 shadow-sm flex items-center justify-center">
      <span className="-rotate-45 text-xs font-semibold text-yellow-800 text-center px-1">{data.label}</span>
      <Handle type="target" position={Position.Left} style={{ left: -8, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="yes" style={{ right: -8, top: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ bottom: -8, left: '50%' }} />
    </div>
  );
}
