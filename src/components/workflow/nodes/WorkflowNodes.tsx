import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { WorkflowNodeData } from '@/types/workflow';
import { cn } from '@/lib/utils';
import { Clock, GitBranch, Bell, Play, Square, Layers } from 'lucide-react';

function heatClass(level?: string) {
  if (level === 'critical') return 'border-red-500 bg-red-50';
  if (level === 'warn')     return 'border-amber-400 bg-amber-50';
  return 'border-green-400 bg-green-50';
}

function heatDot(level?: string) {
  if (level === 'critical') return 'bg-red-500';
  if (level === 'warn')     return 'bg-amber-400';
  if (level === 'ok')       return 'bg-green-500';
  return 'bg-gray-300';
}

export function StartNode({ data }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-md border-2 border-primary">
      <Play className="h-5 w-5 fill-current" />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function EndNode({ data }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground shadow-md border-2 border-border">
      <Square className="h-5 w-5 fill-current" />
      <Handle type="target" position={Position.Left} />
    </div>
  );
}

export function StageNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  const hasHeat = !!d.heatLevel;

  return (
    <div className={cn(
      'min-w-[140px] rounded-lg border-2 shadow-sm p-3 bg-white transition-shadow',
      hasHeat ? heatClass(d.heatLevel) : 'border-border',
      selected && 'ring-2 ring-primary ring-offset-1'
    )}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2 mb-1">
        <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm leading-tight">{d.label}</span>
        {hasHeat && <span className={cn('ml-auto w-2 h-2 rounded-full shrink-0', heatDot(d.heatLevel))} />}
      </div>
      {d.avgCycleMinutes !== undefined && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          เฉลี่ย {Math.round(d.avgCycleMinutes / 60 * 10) / 10}h
          {d.queueDepth ? ` · คิว ${d.queueDepth}` : ''}
        </div>
      )}
      {d.slaMinutes && !d.avgCycleMinutes && (
        <div className="text-[10px] text-muted-foreground">SLA {Math.round(d.slaMinutes / 60)}h</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function DecisionNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className={cn(
      'relative w-24 h-24 flex items-center justify-center',
      selected && 'drop-shadow-[0_0_4px_rgba(99,102,241,0.8)]'
    )}>
      <Handle type="target" position={Position.Left} style={{ left: -4 }} />
      <div className="absolute inset-0 rotate-45 border-2 border-amber-400 bg-amber-50 rounded-sm" />
      <div className="relative z-10 text-center px-1">
        <GitBranch className="h-4 w-4 mx-auto text-amber-600" />
        <span className="text-[11px] font-medium leading-tight block text-amber-800">{d.label}</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ right: -4 }} id="yes" />
      <Handle type="source" position={Position.Bottom} style={{ bottom: -4 }} id="no" />
    </div>
  );
}

export function DelayNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className={cn(
      'min-w-[120px] rounded-lg border-2 border-blue-300 bg-blue-50 shadow-sm p-3',
      selected && 'ring-2 ring-primary ring-offset-1'
    )}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-blue-600" />
        <span className="font-medium text-sm text-blue-800">{d.label}</span>
      </div>
      {d.slaMinutes && (
        <div className="text-[10px] text-blue-600 mt-1">รอ {Math.round(d.slaMinutes / 60)}h</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function NotifyNode({ data, selected }: NodeProps) {
  const d = data as WorkflowNodeData;
  return (
    <div className={cn(
      'min-w-[120px] rounded-lg border-2 border-purple-300 bg-purple-50 shadow-sm p-3',
      selected && 'ring-2 ring-primary ring-offset-1'
    )}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center gap-2">
        <Bell className="h-3.5 w-3.5 text-purple-600" />
        <span className="font-medium text-sm text-purple-800">{d.label}</span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export const nodeTypes = {
  start:    StartNode,
  end:      EndNode,
  stage:    StageNode,
  decision: DecisionNode,
  delay:    DelayNode,
  notify:   NotifyNode,
};
