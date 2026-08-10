import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJourneys } from '@/hooks/useJourneys';
import type { JourneySummary, JourneyStage } from '@/types/journey';

const STAGE_PILL: Record<JourneyStage, string> = {
  marketing: 'bg-blue-100 text-blue-700',
  sales:     'bg-violet-100 text-violet-700',
  project:   'bg-yellow-100 text-yellow-800',
  support:   'bg-red-100 text-red-700',
  renewal:   'bg-green-100 text-green-700',
};
const STAGE_EMOJI: Record<JourneyStage, string> = {
  marketing: '📣', sales: '💼', project: '🚀', support: '🎧', renewal: '🔄',
};
const STAGE_LABEL: Record<JourneyStage, string> = {
  marketing: 'การตลาด', sales: 'การขาย', project: 'โปรเจค',
  support: 'ซัพพอร์ต', renewal: 'ต่ออายุ',
};

type FilterType = 'all' | 'active' | 'sla';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  filter?: FilterType;
  onFilterChange?: (f: FilterType) => void;
}

export function WorkflowJourneyList({ selectedId, onSelect, onNew, filter: externalFilter, onFilterChange }: Props) {
  const [internalFilter, setInternalFilter] = useState<FilterType>('all');
  const filter = externalFilter ?? internalFilter;
  const setFilter = (f: FilterType) => { setInternalFilter(f); onFilterChange?.(f); };
  const [search, setSearch]  = useState('');

  const { data: all = [] } = useJourneys();

  const filtered = all.filter((j: JourneySummary) => {
    if (filter === 'active' && j.status !== 'active') return false;
    if (filter === 'sla'    && !j.sla_violated)       return false;
    if (search && !(j.journey_name ?? j.company_name ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="w-full sm:w-52 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden h-full">
      <div className="flex items-center gap-1.5 p-2 border-b border-slate-100">
        <div className="flex-1 flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-400">
          <Search size={10} />
          <input
            className="bg-transparent outline-none flex-1 text-slate-700"
            placeholder="ค้นหา..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={onNew}
          className="bg-violet-600 text-white rounded-md p-1.5 hover:bg-violet-700"
          title="สร้าง Journey ใหม่"
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="flex gap-1 p-1.5 border-b border-slate-100">
        {(['all','active','sla'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-2 py-0.5 rounded-full text-[9px] font-bold border',
              filter === f
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-500 border-slate-200'
            )}
          >
            {f === 'all' ? 'ทั้งหมด' : f === 'active' ? 'กำลังทำ' : 'เกิน SLA'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-1 flex items-center justify-between">
          <span>🗺 เส้นทางลูกค้า</span>
          <span className="bg-slate-100 text-slate-500 rounded-full px-1.5 py-0.5 font-normal normal-case">
            {filtered.length}
          </span>
        </p>

        {filtered.length === 0 && (
          <p className="text-[9px] text-slate-400 px-2 py-3 text-center">ไม่พบ Journey</p>
        )}

        {filtered.map((j: JourneySummary) => {
          const isViolated  = !!j.sla_violated;
          const isCompleted = j.status === 'completed';
          const isCancelled = j.status === 'cancelled';
          return (
            <button
              key={j.id}
              onClick={() => onSelect(j.id)}
              className={cn(
                'w-full text-left rounded-lg px-2 py-1.5 mb-0.5 border transition-colors',
                selectedId === j.id
                  ? 'bg-violet-50 border-violet-300'
                  : 'bg-white border-transparent hover:bg-slate-50',
                (isCompleted || isCancelled) && 'opacity-60'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                  isCompleted ? 'bg-green-500'
                  : isCancelled ? 'bg-slate-400'
                  : isViolated ? 'bg-red-500'
                  : j.days_in_stage && j.days_in_stage > 5 ? 'bg-amber-400'
                  : 'bg-green-500'
                )} />
                <span className="text-[10px] font-semibold text-slate-800 truncate flex-1">
                  {j.journey_name || j.company_name || j.id.slice(0, 8)}
                </span>
                {isCompleted && <span className="text-[8px] text-green-600 font-bold shrink-0">✓</span>}
                {isCancelled && <span className="text-[8px] text-slate-400 shrink-0">ยกเลิก</span>}
              </div>
              <div className="flex items-center gap-1">
                <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded-full', STAGE_PILL[j.current_stage])}>
                  {STAGE_EMOJI[j.current_stage]} {STAGE_LABEL[j.current_stage]}
                </span>
                {!isCompleted && !isCancelled && (
                  <span className={cn('text-[8px]', isViolated ? 'text-red-600 font-bold' : 'text-slate-400')}>
                    {j.days_in_stage} วัน{isViolated ? ' ⚠' : ''}
                  </span>
                )}
                {isCompleted && <span className="text-[8px] text-green-600">{j.stages_done}/5 stage</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
