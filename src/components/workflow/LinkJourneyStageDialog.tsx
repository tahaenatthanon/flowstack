import { useState } from 'react';
import { Search, Loader2, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLinkJourneyEntity, useJourneyEntitySearch } from '@/hooks/useJourneys';
import type { JourneyStage, JourneyDetail } from '@/types/journey';

const STAGE_LABEL: Record<JourneyStage, string> = {
  marketing: '📣 การตลาด',
  sales:     '💼 การขาย',
  project:   '🚀 โปรเจค',
  support:   '🎧 ซัพพอร์ต',
  renewal:   '🔄 ต่ออายุ',
};

const ENTITY_LABEL: Record<string, string> = {
  opportunity:    'โอกาสการขาย',
  project:        'โปรเจกต์',
  support_ticket: 'Helpdesk Ticket',
};

const STAGE_DEFAULT_ENTITY: Record<JourneyStage, string> = {
  marketing: 'opportunity',
  sales:     'opportunity',
  project:   'project',
  support:   'support_ticket',
  renewal:   'opportunity',
};

const OPP_STATUS_THAI: Record<string, string> = {
  lead: 'ลูกค้าเป้าหมาย', qualified: 'คัดกรองแล้ว', proposal: 'นำเสนอแล้ว',
  negotiation: 'เจรจา', won: 'ชนะ', lost: 'แพ้',
};
const PROJ_STATUS_THAI: Record<string, string> = {
  planning: 'วางแผน', active: 'กำลังทำ', on_hold: 'หยุดชั่วคราว',
  completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
};
const TICKET_STATUS_THAI: Record<string, string> = {
  open: 'เปิด', in_progress: 'กำลังแก้', resolved: 'แก้แล้ว',
  closed: 'ปิด', escalated: 'ยกระดับ',
};

function statusThai(entityType: string, status: string) {
  if (entityType === 'opportunity')    return OPP_STATUS_THAI[status] ?? status;
  if (entityType === 'project')        return PROJ_STATUS_THAI[status] ?? status;
  if (entityType === 'support_ticket') return TICKET_STATUS_THAI[status] ?? status;
  return status;
}

interface Props {
  journey: JourneyDetail;
  defaultStage?: JourneyStage;
  onClose: () => void;
}

export function LinkJourneyStageDialog({ journey, defaultStage, onClose }: Props) {
  const { toast } = useToast();
  const linkMutation = useLinkJourneyEntity();

  const STAGE_ORDER: JourneyStage[] = ['marketing', 'sales', 'project', 'support', 'renewal'];

  const [stage, setStage] = useState<JourneyStage>(defaultStage ?? journey.current_stage);
  const [entityType, setEntityType] = useState<string>(STAGE_DEFAULT_ENTITY[defaultStage ?? journey.current_stage]);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: entities = [], isLoading } = useJourneyEntitySearch(entityType, q);

  const handleStageChange = (s: JourneyStage) => {
    setStage(s);
    setEntityType(STAGE_DEFAULT_ENTITY[s]);
    setSelectedId(null);
    setQ('');
  };

  const handleSubmit = () => {
    if (!selectedId) return;
    linkMutation.mutate(
      { instance_id: journey.id, stage, entity_type: entityType, entity_id: selectedId },
      {
        onSuccess: () => {
          toast({ title: 'ผูกรายการสำเร็จ' });
          onClose();
        },
        onError: () => toast({ title: 'ผูกรายการไม่สำเร็จ', variant: 'destructive' }),
      }
    );
  };

  const selected = entities.find(e => e.id === selectedId);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ผูกรายการกับ Stage</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Stage picker */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Stage</label>
            <Select value={stage} onValueChange={v => handleStageChange(v as JourneyStage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_ORDER.map(s => (
                  <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Entity type picker */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">ประเภทรายการ</label>
            <Select value={entityType} onValueChange={v => { setEntityType(v); setSelectedId(null); setQ(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ENTITY_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">ค้นหารายการ</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="พิมพ์ชื่อหรือบริษัท..."
                className="pl-8 h-8 text-sm"
                value={q}
                onChange={e => { setQ(e.target.value); setSelectedId(null); }}
              />
            </div>
          </div>

          {/* Entity list */}
          <div className="border rounded-md overflow-hidden max-h-56 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังโหลด...
              </div>
            )}
            {!isLoading && entities.length === 0 && (
              <p className="text-center py-6 text-sm text-muted-foreground">ไม่พบรายการ</p>
            )}
            {!isLoading && entities.map(e => (
              <div
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-slate-50 transition-colors ${selectedId === e.id ? 'bg-violet-50 border-l-2 border-l-violet-500' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  <div className="text-[10px] text-slate-400">{e.company_name || '—'} {e.year_label ? `· ${e.year_label}` : ''}</div>
                </div>
                <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-600 whitespace-nowrap flex-shrink-0">
                  {statusThai(entityType, e.status)}
                </span>
              </div>
            ))}
          </div>

          {selected && (
            <div className="text-xs text-slate-500 bg-violet-50 border border-violet-200 rounded-md px-3 py-2">
              เลือก: <span className="font-semibold text-violet-800">{selected.name}</span> → {STAGE_LABEL[stage]}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={!selectedId || linkMutation.isPending} onClick={handleSubmit}>
            {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
            ผูกรายการ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
