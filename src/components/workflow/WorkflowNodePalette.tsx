import { Circle, Square, Diamond, Clock, Bell } from 'lucide-react';
import type { WorkflowNodeType } from '@/types/workflow';

const NODE_TYPES: { type: WorkflowNodeType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'start',    label: 'เริ่มต้น',  icon: Circle,  color: 'bg-emerald-100 border-emerald-400 text-emerald-700' },
  { type: 'end',      label: 'สิ้นสุด',   icon: Circle,  color: 'bg-slate-100 border-slate-400 text-slate-700' },
  { type: 'stage',    label: 'ขั้นตอน',   icon: Square,  color: 'bg-blue-100 border-blue-400 text-blue-700' },
  { type: 'decision', label: 'เงื่อนไข',  icon: Diamond, color: 'bg-yellow-100 border-yellow-400 text-yellow-700' },
  { type: 'delay',    label: 'รอ/Delay',  icon: Clock,   color: 'bg-slate-100 border-slate-300 text-slate-600' },
  { type: 'notify',   label: 'แจ้งเตือน', icon: Bell,    color: 'bg-blue-50 border-blue-300 text-blue-600' },
];

export function WorkflowNodePalette() {
  const onDragStart = (e: React.DragEvent, nodeType: WorkflowNodeType) => {
    e.dataTransfer.setData('application/reactflow', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-44 border-r bg-white flex flex-col gap-1 p-3 overflow-y-auto shrink-0">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Node Types</p>
      {NODE_TYPES.map(({ type, label, icon: Icon, color }) => (
        <div
          key={type}
          draggable
          onDragStart={e => onDragStart(e, type)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-grab text-sm font-medium ${color} hover:opacity-80 active:cursor-grabbing select-none`}
        >
          <Icon size={14} />
          {label}
        </div>
      ))}
      <div className="mt-4 border-t pt-3">
        <p className="text-xs text-slate-400">ลาก node ลงบน canvas</p>
      </div>
    </div>
  );
}
