import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, BarChart2, Sparkles } from 'lucide-react';
import type { WorkflowNode, StepAnalytics } from '@/types/workflow';
import { WorkflowAIPanel } from './WorkflowAIPanel';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  selectedNode: WorkflowNode | null;
  stepAnalytics: StepAnalytics | null;
  definitionId: string;
  onLabelChange?: (nodeId: string, label: string) => void;
  onSlaChange?: (nodeId: string, slaMinutes: number) => void;
}

export function WorkflowSidePanel({ selectedNode, stepAnalytics, definitionId, onLabelChange, onSlaChange }: Props) {
  return (
    <div className="w-72 border-l bg-white flex flex-col shrink-0">
      <Tabs defaultValue="properties" className="flex flex-col h-full">
        <TabsList className="grid grid-cols-3 m-2 shrink-0">
          <TabsTrigger value="properties"><Settings size={14} /></TabsTrigger>
          <TabsTrigger value="analytics"><BarChart2 size={14} /></TabsTrigger>
          <TabsTrigger value="ai"><Sparkles size={14} /></TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="flex-1 overflow-y-auto p-3 space-y-3">
          {!selectedNode && <p className="text-xs text-slate-400 text-center mt-8">เลือก node เพื่อแก้ไข</p>}
          {selectedNode && (
            <>
              <div>
                <label className="text-xs font-medium text-slate-600">ชื่อ</label>
                <input
                  className="mt-1 w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={selectedNode.data.label}
                  onChange={e => onLabelChange?.(selectedNode.id, e.target.value)}
                />
              </div>
              {selectedNode.type === 'stage' && (
                <div>
                  <label className="text-xs font-medium text-slate-600">SLA (นาที)</label>
                  <input
                    type="number"
                    className="mt-1 w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={selectedNode.data.slaMinutes ?? 1440}
                    onChange={e => onSlaChange?.(selectedNode.id, Number(e.target.value))}
                  />
                  <p className="text-xs text-slate-400 mt-0.5">{((selectedNode.data.slaMinutes ?? 1440) / 60).toFixed(1)} ชั่วโมง</p>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="flex-1 overflow-y-auto p-3 space-y-3">
          {!stepAnalytics && <p className="text-xs text-slate-400 text-center mt-8">เลือก Stage node เพื่อดู analytics</p>}
          {stepAnalytics && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-slate-50 p-2 text-center">
                  <div className="text-lg font-bold text-slate-700">
                    {stepAnalytics.avg_cycle_minutes != null
                      ? `${Math.round((stepAnalytics.avg_cycle_minutes / 60) * 10) / 10}ชม.`
                      : '—'}
                  </div>
                  <div className="text-xs text-slate-500">เฉลี่ย</div>
                </div>
                <div className="rounded-md bg-slate-50 p-2 text-center">
                  <div className={`text-lg font-bold ${stepAnalytics.queue_depth > 0 ? 'text-amber-600' : 'text-slate-700'}`}>{stepAnalytics.queue_depth}</div>
                  <div className="text-xs text-slate-500">ค้างอยู่</div>
                </div>
              </div>

              {stepAnalytics.trend_30d.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">แนวโน้ม 30 วัน (ชม.)</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={stepAnalytics.trend_30d}>
                      <XAxis dataKey="date" hide />
                      <YAxis hide />
                      <Tooltip formatter={(v: number) => [`${Math.round((v / 60) * 10) / 10} ชม.`]} />
                      <Line type="monotone" dataKey="avg_minutes" stroke="#6366f1" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {stepAnalytics.stalled_entities.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">ค้างอยู่นาน</p>
                  {stepAnalytics.stalled_entities.map((e, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b last:border-0">
                      <span className="text-slate-600 truncate">{e.entity_name}</span>
                      <span className="text-red-600 ml-2">{e.days_stalled} วัน</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="ai" className="flex-1 overflow-hidden">
          <WorkflowAIPanel definitionId={definitionId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
