import { useState, useEffect } from 'react';
import { Link2, Pencil, Trash2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJourneyDetail, useCompleteJourneyStage, useUpdateJourney, useDeleteJourney } from '@/hooks/useJourneys';
import { JourneyStageCard } from './JourneyStageCard';
import { LinkJourneyStageDialog } from './LinkJourneyStageDialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import type { JourneyStage } from '@/types/journey';

const STAGE_ORDER: JourneyStage[] = ['marketing', 'sales', 'project', 'support', 'renewal'];
const STAGE_LABEL_TH: Record<JourneyStage, string> = {
  marketing: 'การตลาด', sales: 'การขาย', project: 'โปรเจค',
  support: 'ซัพพอร์ต', renewal: 'ต่ออายุ',
};
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:    { label: 'กำลังดำเนินการ', cls: 'bg-violet-100 text-violet-700' },
  completed: { label: 'เสร็จสิ้น',      cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ยกเลิก',         cls: 'bg-slate-100 text-slate-500' },
};

interface Props {
  journeyId: string;
  onDeleted?: () => void;
}

export function WorkflowJourneyDetail({ journeyId, onDeleted }: Props) {
  const { data: journey, isLoading } = useJourneyDetail(journeyId);
  const completeStage = useCompleteJourneyStage();
  const updateJourney = useUpdateJourney();
  const deleteJourney = useDeleteJourney();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const [openStages, setOpenStages] = useState<Set<JourneyStage>>(new Set());
  const [openTasks, setOpenTasks]   = useState<Set<string>>(new Set());
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkStage, setLinkStage]   = useState<JourneyStage | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName]   = useState('');

  useEffect(() => {
    if (!journey) return;
    const autoOpenStages = new Set<JourneyStage>();
    const autoOpenTasks  = new Set<string>();
    STAGE_ORDER.forEach(stage => {
      const s = journey.stages[stage];
      if (!s) return;
      if (s.status === 'active' || s.sla_exceeded) autoOpenStages.add(stage);
      s.tasks.forEach(t => {
        if (['in_progress', 'in-progress', 'blocked', 'overdue'].includes(t.status)) autoOpenTasks.add(t.id);
      });
    });
    setOpenStages(autoOpenStages);
    setOpenTasks(autoOpenTasks);
  }, [journey?.id]);

  const toggleStage = (stage: JourneyStage) =>
    setOpenStages(prev => { const n = new Set(prev); n.has(stage) ? n.delete(stage) : n.add(stage); return n; });

  const toggleTask = (taskId: string) =>
    setOpenTasks(prev => { const n = new Set(prev); n.has(taskId) ? n.delete(taskId) : n.add(taskId); return n; });

  const handleSaveName = () => {
    if (!draftName.trim()) return;
    updateJourney.mutate(
      { id: journeyId, journey_name: draftName.trim() },
      {
        onSuccess: () => { toast({ title: 'บันทึกชื่อแล้ว' }); setEditingName(false); },
        onError:   () => toast({ title: 'ไม่สามารถบันทึกได้', variant: 'destructive' }),
      }
    );
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'ลบ Journey นี้?',
      description: 'ข้อมูลการผูก entity และประวัติทั้งหมดจะหายไปถาวร',
      confirmLabel: 'ลบ',
      variant: 'destructive',
    });
    if (!ok) return;
    deleteJourney.mutate(journeyId, {
      onSuccess: () => { toast({ title: 'ลบ Journey แล้ว' }); onDeleted?.(); },
      onError:   () => toast({ title: 'ไม่สามารถลบได้', variant: 'destructive' }),
    });
  };

  const handleCancelJourney = async () => {
    const ok = await confirm({
      title: 'ยกเลิก Journey นี้?',
      description: 'Journey จะถูกเปลี่ยนสถานะเป็นยกเลิก แต่ข้อมูลยังคงอยู่',
      confirmLabel: 'ยกเลิก Journey',
      variant: 'destructive',
    });
    if (!ok) return;
    updateJourney.mutate(
      { id: journeyId, status: 'cancelled' },
      {
        onSuccess: () => toast({ title: 'ยกเลิก Journey แล้ว' }),
        onError:   () => toast({ title: 'ไม่สามารถยกเลิกได้', variant: 'destructive' }),
      }
    );
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">กำลังโหลด...</div>
  );
  if (!journey) return (
    <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">เลือก Journey จากรายการ</div>
  );

  const stagesDone    = STAGE_ORDER.filter(s => journey.stages[s]?.status === 'completed').length;
  const totalDays     = journey.started_at ? Math.floor((Date.now() - new Date(journey.started_at).getTime()) / 86400000) : 0;
  const daysInCurrent = journey.stages[journey.current_stage]?.days_in_stage ?? 0;
  const currentSla    = journey.stages[journey.current_stage]?.sla_days ?? 9999;
  const statusCfg     = STATUS_LABEL[journey.status] ?? STATUS_LABEL.active;
  const currentName   = journey.journey_name || journey.company_name || journey.id.slice(0, 8);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="text-sm font-bold border border-violet-400 rounded px-1.5 py-0.5 outline-none w-48"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
              />
              <button onClick={handleSaveName} className="text-green-600 hover:text-green-700 p-0.5"><Check size={13} /></button>
              <button onClick={() => setEditingName(false)} className="text-slate-400 hover:text-slate-600 p-0.5"><X size={13} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <div className="text-sm font-bold text-slate-800 truncate">{currentName}</div>
              <button
                onClick={() => { setDraftName(currentName); setEditingName(true); }}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', statusCfg.cls)}>
              {statusCfg.label}
            </span>
            <span className="text-[9px] text-slate-400">
              · เริ่ม {journey.started_at?.slice(0, 10) ?? '—'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className={cn('flex items-center px-3 py-1.5 rounded-lg border text-xs',
          daysInCurrent > currentSla ? 'bg-red-50 border-red-200' : 'border-slate-200'
        )}>
          <div>
            <div className={cn('text-lg font-black leading-none', daysInCurrent > currentSla ? 'text-red-600' : 'text-slate-800')}>{daysInCurrent}</div>
            <div className="text-[8px] text-slate-400 leading-none mt-0.5">วันใน<br/>stage ปัจจุบัน</div>
          </div>
        </div>
        <div className="flex items-center px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
          <div>
            <div className="text-lg font-black leading-none text-violet-600">{stagesDone}/5</div>
            <div className="text-[8px] text-slate-400 leading-none mt-0.5">Stage<br/>สำเร็จ</div>
          </div>
        </div>
        <div className="flex items-center px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
          <div>
            <div className="text-lg font-black leading-none">{totalDays}</div>
            <div className="text-[8px] text-slate-400 leading-none mt-0.5">วัน<br/>รวม</div>
          </div>
        </div>

        {/* Actions */}
        <div className="ml-auto flex gap-1.5">
          {journey.status === 'active' && (
            <button
              onClick={() => { setLinkStage(null); setShowLinkDialog(true); }}
              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            >
              <Link2 size={11} /> ผูกรายการ
            </button>
          )}
          {journey.status === 'active' && (
            <button
              onClick={handleCancelJourney}
              className="text-[10px] px-2 py-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              ยกเลิก Journey
            </button>
          )}
          <button
            onClick={handleDelete}
            className="text-[10px] px-2 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 flex items-center gap-1"
          >
            <Trash2 size={10} /> ลบ
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3.5 flex gap-3 items-start">
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="bg-amber-50 border border-dashed border-amber-200 rounded-lg px-3 py-1.5 text-[9px] text-amber-800 flex items-center gap-2">
            <span>💡</span>
            <span>คลิก stage เพื่อดูงาน · คลิก task เพื่อดูรายละเอียด · ผูกรายการหรือทำเครื่องหมายเสร็จได้จากปุ่มใน stage</span>
          </div>

          {STAGE_ORDER.map((stage, idx) => {
            const stageData = journey.stages[stage];
            if (!stageData) return null;
            const canComplete = stageData.status === 'active'
              && stageData.entity_id !== null
              && stageData.stage_status !== 'completed'
              && journey.status === 'active';
            return (
              <div key={stage}>
                {idx > 0 && (
                  <div className="flex justify-center text-slate-300 text-base h-2">↓</div>
                )}
                <JourneyStageCard
                  stageNum={idx + 1}
                  data={stageData}
                  isOpen={openStages.has(stage)}
                  onToggleStage={() => toggleStage(stage)}
                  openTasks={openTasks}
                  onToggleTask={toggleTask}
                  onLinkStage={journey.status === 'active' ? () => { setLinkStage(stage); setShowLinkDialog(true); } : undefined}
                  onCompleteStage={canComplete
                    ? () => completeStage.mutate(
                        { instance_id: journeyId, stage },
                        {
                          onSuccess: () => toast({ title: `Stage "${STAGE_LABEL_TH[stage]}" เสร็จแล้ว` }),
                          onError:   () => toast({ title: 'ไม่สามารถอัปเดตได้', variant: 'destructive' }),
                        }
                      )
                    : undefined
                  }
                />
              </div>
            );
          })}
        </div>

        {/* Sidebar */}
        <div className="w-44 flex-shrink-0 flex flex-col gap-2">
          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">บริษัท</p>
            <p className="text-xs font-bold">{journey.company_name || '—'}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1">Stage ปัจจุบัน</p>
            <p className="text-xs font-bold">{STAGE_LABEL_TH[journey.current_stage]}</p>
            <p className="text-[9px] text-slate-400 mt-0.5">{daysInCurrent} วัน{daysInCurrent > currentSla ? ' ⚠ เกิน SLA' : ''}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-2">ความคืบหน้า</p>
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-10 h-10" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#7c3aed" strokeWidth="3"
                    strokeDasharray={`${(stagesDone / 5) * 100} 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-violet-700">
                  {Math.round((stagesDone / 5) * 100)}%
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold">{stagesDone}/{STAGE_ORDER.length} เวที</p>
                <p className="text-[9px] text-slate-400">สำเร็จ</p>
                {journey.sla_violated ? (
                  <p className="text-[9px] text-red-600 font-bold mt-0.5">⚠ เกิน SLA</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-2.5">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Timeline</p>
            <div className="flex flex-col gap-1">
              <div className="text-[9px]"><span className="text-slate-400">เริ่ม:</span><span className="font-semibold ml-1">{journey.started_at?.slice(0,10) ?? '—'}</span></div>
              <div className="text-[9px]"><span className="text-slate-400">ผ่านมา:</span><span className={cn('font-semibold ml-1', totalDays > 60 ? 'text-red-600' : '')}>{totalDays} วัน</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog — at root level, outside flex layout */}
      {showLinkDialog && journey && (
        <LinkJourneyStageDialog
          journey={journey}
          defaultStage={linkStage ?? journey.current_stage}
          onClose={() => { setShowLinkDialog(false); setLinkStage(null); }}
        />
      )}
    </div>
  );
}
