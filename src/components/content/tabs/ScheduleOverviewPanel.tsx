import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAllSchedules } from '@/hooks/useContent';
import type { ContentSchedule } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Card not used but kept for completeness
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, Clock, ExternalLink, Pencil, Rss, Play, Check, Plus, Trash2, Save, RefreshCw, Loader2 } from 'lucide-react';

// ─── Schedule Status Constants ───────────────────────────────────────────────
const SCHED_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'รอโพสต์',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  publishing: { label: 'กำลังโพสต์', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  sent:       { label: 'โพสต์แล้ว',  color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' },
  failed:     { label: 'ล้มเหลว',     color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' },
};

export default function ScheduleOverviewPanel() {
  const { toast } = useToast();
  const { data: schedules = [], isLoading, refetch } = useAllSchedules();

  const [editSchedDialog, setEditSchedDialog]   = useState<{ id: string; scheduled_at: string } | null>(null);
  const [editSchedDt, setEditSchedDt]           = useState('');
  const [updatingSchedId, setUpdatingSchedId]   = useState<string | null>(null);

  const pending = schedules.filter(s => s.status === 'pending');
  const past    = schedules.filter(s => s.status !== 'pending').slice().reverse().slice(0, 20);

  const handleManualCron = async () => {
    try {
      const r: any = await apiFetch('/brand-content.php?action=cron-publish', { method: 'POST' });
      refetch();
      toast({ title: `ประมวลผลแล้ว ${r.processed} รายการ` });
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editSchedDialog || !editSchedDt) return;
    if (new Date(editSchedDt) < new Date()) { toast({ title: 'เวลาที่เลือกผ่านมาแล้ว', description: 'กรุณาเลือกเวลาในอนาคต', variant: 'destructive' }); return; }
    setUpdatingSchedId(editSchedDialog.id);
    try {
      await apiFetch(`/brand-content.php?action=schedules&id=${editSchedDialog.id}`, {
        method: 'PUT',
        body: JSON.stringify({ scheduled_at: editSchedDt }),
      });
      refetch();
      setEditSchedDialog(null);
      toast({ title: 'อัปเดตเวลาโพสต์แล้ว' });
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    } finally {
      setUpdatingSchedId(null);
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (schedules.length === 0) return (
    <div className="text-center py-8 border rounded-lg border-dashed text-muted-foreground">
      <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
      <p className="text-sm">ยังไม่มีกำหนดการโพสต์</p>
      <p className="text-xs mt-1">ไปที่แผนคอนเทนต์ → ขยายรายการวัน → ตั้งเวลาโพสต์</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          รอโพสต์ <strong className="text-amber-600">{pending.length}</strong> รายการ
          {' · '}โพสต์แล้วทั้งหมด <strong className="text-green-600">{schedules.filter(s => s.status === 'sent').length}</strong> รายการ
          <span className="ml-2 text-[10px] opacity-60">ระบบตรวจสอบอัตโนมัติทุก 60 วินาที</span>
        </p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleManualCron}>
          <RefreshCw className="h-3 w-3" />ตรวจสอบตอนนี้
        </Button>
      </div>

      {pending.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">รอโพสต์</p>
          {pending.map(sc => {
            const pm = PLATFORM_MAP[sc.platform ?? ''] ?? { label: sc.platform, color: 'bg-gray-100 text-gray-700' };
            const dt = new Date(sc.scheduled_at);
            const isPast = dt < new Date();
            return (
              <div key={sc.id} className="flex items-center gap-3 p-3 border rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
                <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${pm.color}`}>{pm.label}</span>
                    <span className="text-xs font-medium truncate">{sc.channel_name}</span>
                    <span className="text-xs text-muted-foreground truncate">{sc.plan_title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{sc.day_label} · {sc.topic}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className={`text-xs font-medium ${isPast ? 'text-red-600' : 'text-amber-700'}`}>
                    {isPast ? 'เลยกำหนด' : dt.toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:text-primary" title="แก้ไขเวลา"
                    onClick={() => {
                      setEditSchedDialog({ id: sc.id, scheduled_at: sc.scheduled_at });
                      setEditSchedDt(new Date(sc.scheduled_at).toISOString().slice(0, 16));
                    }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">ประวัติ</p>
          <div className="space-y-1">
            {past.map(sc => {
              const pm = PLATFORM_MAP[sc.platform ?? ''] ?? { label: sc.platform, color: 'bg-gray-100 text-gray-700' };
              const ss = SCHED_STATUS[sc.status] ?? { label: sc.status, color: 'bg-gray-100 text-gray-600' };
              return (
                <div key={sc.id} className="flex items-center gap-3 px-3 py-2 border rounded-lg bg-background text-xs">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${pm.color}`}>{pm.label}</span>
                  <span className="flex-1 min-w-0 truncate text-muted-foreground">{sc.channel_name} · {sc.topic}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ss.color}`}>{ss.label}</span>
                  <span className="text-muted-foreground shrink-0">{new Date(sc.scheduled_at).toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Schedule Time Dialog */}
      <Dialog open={!!editSchedDialog} onOpenChange={open => { if (!open) setEditSchedDialog(null); }}>
        <DialogContent className="w-full sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" />แก้ไขเวลาโพสต์</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>วันและเวลา <span className="text-destructive">*</span></Label>
            <Input type="datetime-local" value={editSchedDt} onChange={e => setEditSchedDt(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSchedDialog(null)}>ยกเลิก</Button>
            <Button disabled={!!updatingSchedId || !editSchedDt} onClick={handleUpdateSchedule} className="gap-2">
              {updatingSchedId ? <><Loader2 className="h-4 w-4 animate-spin" />กำลังบันทึก...</> : <><Save className="h-4 w-4" />บันทึก</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { default as ChannelManagementSection } from './ChannelManagementSection';
