import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Play, RefreshCw, Clock, CheckCircle2, XCircle, Minus,
  ChevronDown, ChevronUp, Plus, Pencil, Trash2, AlertTriangle, Loader2, Square,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { th } from 'date-fns/locale';

interface CronJob {
  id: string;
  key: string;
  name: string;
  description: string | null;
  interval_label: string | null;
  type: 'http' | 'include';
  endpoint: string | null;
  file_path: string | null;
  http_method: 'GET' | 'POST';
  query_string: string | null;
  enabled: number;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_processed: number | null;
  last_errors: number | null;
  last_notes: string | null;
  state: 'ok' | 'error' | 'running' | 'cancelling' | 'stuck' | 'never';
}

interface HistoryRow {
  started_at: string;
  finished_at: string | null;
  records_processed: number;
  errors: number;
  notes: string | null;
}

interface RunResult {
  success: boolean;
  output: string;
  processed: number;
  errors: number;
}

const emptyForm = () => ({
  key: '', name: '', description: '', interval_label: '',
  type: 'http' as 'http' | 'include',
  endpoint: '', file_path: '', http_method: 'GET' as 'GET' | 'POST', query_string: '',
});

function StatusBadge({ job }: { job: CronJob }) {
  if (job.state === 'cancelling')
    return <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300"><Loader2 className="h-3 w-3 animate-spin" />กำลังหยุด...</Badge>;
  if (job.state === 'running')
    return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300"><RefreshCw className="h-3 w-3 animate-spin" />กำลังรัน</Badge>;
  if (job.state === 'stuck')
    return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />ค้าง</Badge>;
  if (job.state === 'error')
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />มีข้อผิดพลาด</Badge>;
  if (job.state === 'ok')
    return <Badge className="gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100"><CheckCircle2 className="h-3 w-3" />สำเร็จ</Badge>;
  return <Badge variant="secondary" className="gap-1"><Minus className="h-3 w-3" />ยังไม่เคยรัน</Badge>;
}

function HistoryPanel({ jobKey, onClear }: { jobKey: string; onClear: () => void }) {
  const { data: rows = [], isFetching } = useQuery<HistoryRow[]>({
    queryKey: ['cron-history', jobKey],
    queryFn: () => apiFetch(`/cron-manager.php?action=history&job=${jobKey}`),
  });
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="mt-2 border-t pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">10 ครั้งล่าสุด</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive px-2"
          onClick={() => setConfirmClear(true)}>
          ล้าง History
        </Button>
      </div>
      {isFetching && <p className="text-xs text-muted-foreground">กำลังโหลด...</p>}
      {!isFetching && rows.length === 0 && <p className="text-xs text-muted-foreground">ไม่มีประวัติ</p>}
      {rows.length > 0 && (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left pb-1 font-medium">เริ่ม</th>
              <th className="text-right pb-1 font-medium">ระยะเวลา</th>
              <th className="text-right pb-1 font-medium">ประมวลผล</th>
              <th className="text-right pb-1 font-medium">errors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const dur = r.started_at && r.finished_at
                ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000) + 's'
                : r.started_at ? 'รันอยู่' : '-';
              return (
                <tr key={i} className="border-b border-dashed last:border-0">
                  <td className="py-1 text-muted-foreground">
                    {formatDistanceToNow(new Date(r.started_at), { addSuffix: true, locale: th })}
                  </td>
                  <td className="py-1 text-right">{dur}</td>
                  <td className="py-1 text-right">{r.records_processed}</td>
                  <td className={`py-1 text-right ${r.errors > 0 ? 'text-destructive font-medium' : ''}`}>{r.errors}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ล้าง History?</AlertDialogTitle>
            <AlertDialogDescription>ประวัติการรันทั้งหมดของ job นี้จะถูกลบถาวร</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onClear(); setConfirmClear(false); }}>
              ล้าง History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function JobFormDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ReturnType<typeof emptyForm> | null;
  onSave: (data: ReturnType<typeof emptyForm>) => void;
}) {
  const isEdit = !!initial?.key;
  const [form, setForm] = useState<ReturnType<typeof emptyForm>>(initial ?? emptyForm());

  const handleOpen = (v: boolean) => {
    if (v) setForm(initial ?? emptyForm());
    onOpenChange(v);
  };

  const set = (k: keyof ReturnType<typeof emptyForm>, v: string) =>
    setForm(p => ({ ...p, [k]: v }));

  const valid =
    !!form.key.match(/^[a-z0-9-]+$/) &&
    !!form.name.trim() &&
    (form.type === 'http' ? !!form.endpoint.trim() : !!form.file_path.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'แก้ไข Cron Job' : 'เพิ่ม Cron Job'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Key <span className="text-destructive">*</span></Label>
              <Input value={form.key} onChange={e => set('key', e.target.value)}
                placeholder="my-job" disabled={isEdit} className="font-mono text-sm" />
              <p className="text-[10px] text-muted-foreground">[a-z0-9-] เท่านั้น</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ชื่อ <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Job" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">คำอธิบาย</Label>
            <Textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="ทำอะไร ทำทำไม..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ความถี่ (display เท่านั้น)</Label>
            <Input value={form.interval_label} onChange={e => set('interval_label', e.target.value)}
              placeholder="เช่น ทุก 1 นาที" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ประเภท</Label>
            <Select value={form.type} onValueChange={v => set('type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP (curl ไปยัง endpoint)</SelectItem>
                <SelectItem value="include">Include (PHP include file)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.type === 'http' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Endpoint <span className="text-destructive">*</span></Label>
                <Input value={form.endpoint} onChange={e => set('endpoint', e.target.value)}
                  placeholder="my-job.php" className="font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Method</Label>
                <Select value={form.http_method} onValueChange={v => set('http_method', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {form.type === 'include' && (
            <div className="space-y-1">
              <Label className="text-xs">File Path <span className="text-destructive">*</span></Label>
              <Input value={form.file_path} onChange={e => set('file_path', e.target.value)}
                placeholder="api/cron/my-script.php" className="font-mono text-sm" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Query String (optional)</Label>
            <Input value={form.query_string} onChange={e => set('query_string', e.target.value)}
              placeholder="trigger=1&mode=test" className="font-mono text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button disabled={!valid} onClick={() => { onSave(form); onOpenChange(false); }}>
            {isEdit ? 'บันทึก' : 'เพิ่ม Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CronJobsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [running, setRunning]           = useState<Record<string, boolean>>({});
  const [results, setResults]           = useState<Record<string, RunResult>>({});
  const [expanded, setExpanded]         = useState<Record<string, boolean>>({});
  const [showHistory, setShowHistory]   = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen]         = useState(false);
  const [editTarget, setEditTarget]     = useState<CronJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CronJob | null>(null);
  const [disabledRunConfirm, setDisabledRunConfirm] = useState<CronJob | null>(null);

  const { data: jobs = [], isFetching, refetch } = useQuery<CronJob[]>({
    queryKey: ['cron-jobs'],
    queryFn: () => apiFetch('/cron-manager.php'),
    refetchInterval: 15_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cron-jobs'] });

  const createMut = useMutation({
    mutationFn: (body: object) => apiFetch('/cron-manager.php?action=create', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); toast({ title: 'เพิ่ม Job สำเร็จ' }); },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ key, body }: { key: string; body: object }) =>
      apiFetch(`/cron-manager.php?action=update&job=${key}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { invalidate(); toast({ title: 'บันทึกสำเร็จ' }); },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (key: string) => apiFetch(`/cron-manager.php?action=delete&job=${key}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); toast({ title: 'ลบ Job สำเร็จ' }); },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const stopMut = useMutation({
    mutationFn: (key: string) => apiFetch(`/cron-manager.php?action=stop&job=${key}`, { method: 'POST' }),
    onSuccess: (data: any, key) => {
      invalidate();
      toast({ title: `หยุด job สำเร็จ`, description: `ปิด ${data?.stopped ?? 0} run` });
    },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const clearHistoryMut = useMutation({
    mutationFn: (key: string) => apiFetch(`/cron-manager.php?action=clear-history&job=${key}`, { method: 'DELETE' }),
    onSuccess: (_, key) => {
      qc.invalidateQueries({ queryKey: ['cron-history', key] });
      invalidate();
      toast({ title: 'ล้าง History สำเร็จ' });
    },
  });

  const doRun = async (job: CronJob) => {
    setRunning(p => ({ ...p, [job.key]: true }));
    try {
      const res = await apiFetch<RunResult>(`/cron-manager.php?action=run&job=${job.key}`, { method: 'POST' });
      setResults(p => ({ ...p, [job.key]: res }));
      setExpanded(p => ({ ...p, [job.key]: true }));
      toast({
        title: res.success ? `รัน ${job.name} สำเร็จ` : `รัน ${job.name} มีข้อผิดพลาด`,
        description: `ประมวลผล ${res.processed} รายการ, errors ${res.errors}`,
        variant: res.success ? 'default' : 'destructive',
      });
      invalidate();
    } catch (e: unknown) {
      const err = e as Error;
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    } finally {
      setRunning(p => ({ ...p, [job.key]: false }));
    }
  };

  const handleRunClick = (job: CronJob) => {
    if (!job.enabled) { setDisabledRunConfirm(job); return; }
    doRun(job);
  };

  const handleSave = (form: ReturnType<typeof emptyForm>) => {
    if (editTarget) {
      updateMut.mutate({ key: editTarget.key, body: form });
    } else {
      createMut.mutate(form);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Cron Jobs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">จัดการ background jobs — รัน trigger ด้วยตนเอง หรือตรวจสอบสถานะ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={() => { setEditTarget(null); setFormOpen(true); }}>
            <Plus className="h-3.5 w-3.5" />เพิ่ม Job
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        {jobs.map((job) => {
          const isRunning   = running[job.key] || job.state === 'running';
          const isStuck     = job.state === 'stuck';
          const result      = results[job.key];
          const isExpanded  = expanded[job.key];
          const historyOpen = showHistory[job.key];
          const runBlocked  = isRunning && !isStuck;

          return (
            <div key={job.key} className={`rounded-lg border bg-card p-4 space-y-3 ${!job.enabled ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{job.name}</span>
                    <StatusBadge job={job} />
                    {!job.enabled && <Badge variant="secondary" className="text-[10px]">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{job.description}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">{job.key}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    checked={!!job.enabled}
                    onCheckedChange={v => updateMut.mutate({ key: job.key, body: { enabled: v ? 1 : 0 } })}
                    title={job.enabled ? 'ปิด job' : 'เปิด job'}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => { setEditTarget(job); setFormOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(job)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  {(job.state === 'running' || job.state === 'stuck' || job.state === 'cancelling') ? (
                    <Button size="sm" variant="destructive" className="gap-1.5 ml-1"
                      onClick={() => stopMut.mutate(job.key)}
                      disabled={stopMut.isPending || job.state === 'cancelling'}>
                      {stopMut.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Square className="h-3.5 w-3.5" />}
                      หยุด
                    </Button>
                  ) : (
                    <Button size="sm" className="gap-1.5 ml-1" onClick={() => handleRunClick(job)} disabled={runBlocked}>
                      {running[job.key]
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Play className="h-3.5 w-3.5" />}
                      {running[job.key] ? 'กำลังรัน...' : 'Run Now'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {job.interval_label && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span className="text-foreground font-medium">{job.interval_label}</span>
                  </span>
                )}
                {job.last_started_at && (
                  <span>รันล่าสุด: <span className="text-foreground">
                    {formatDistanceToNow(new Date(job.last_started_at), { addSuffix: true, locale: th })}
                  </span></span>
                )}
                {job.last_processed !== null && (
                  <span>ประมวลผล: <span className="text-foreground font-medium">{job.last_processed}</span> รายการ</span>
                )}
                {(job.last_errors ?? 0) > 0 && (
                  <span className="text-destructive">errors: <span className="font-medium">{job.last_errors}</span></span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowHistory(p => ({ ...p, [job.key]: !historyOpen }))}>
                  {historyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  ดู History
                </button>
              </div>

              {historyOpen && (
                <HistoryPanel jobKey={job.key} onClear={() => clearHistoryMut.mutate(job.key)} />
              )}

              {result && (
                <div className="space-y-1.5">
                  <button
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded(p => ({ ...p, [job.key]: !isExpanded }))}>
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    Output ล่าสุด
                  </button>
                  {isExpanded && (
                    <pre className={`text-[11px] p-3 rounded-md font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto
                      ${result.success
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200'
                        : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200'}`}>
                      {result.output || '(ไม่มี output)'}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {jobs.length === 0 && !isFetching && (
        <p className="text-sm text-muted-foreground text-center py-8">ไม่พบข้อมูล</p>
      )}

      <JobFormDialog
        key={editTarget?.key ?? '__new__'}
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editTarget ? {
          key: editTarget.key,
          name: editTarget.name,
          description: editTarget.description ?? '',
          interval_label: editTarget.interval_label ?? '',
          type: editTarget.type,
          endpoint: editTarget.endpoint ?? '',
          file_path: editTarget.file_path ?? '',
          http_method: editTarget.http_method,
          query_string: editTarget.query_string ?? '',
        } : null}
        onSave={handleSave}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ Job "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบจะไม่สามารถกู้คืนได้ และจะลบประวัติการรันทั้งหมดของ job นี้ด้วย
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteMut.mutate(deleteTarget!.key); setDeleteTarget(null); }}>
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!disabledRunConfirm} onOpenChange={v => !v && setDisabledRunConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Job นี้ถูกปิดอยู่</AlertDialogTitle>
            <AlertDialogDescription>
              "{disabledRunConfirm?.name}" ถูก disable อยู่ ต้องการรันครั้งเดียวโดยไม่เปิด job ไหม?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={() => { doRun(disabledRunConfirm!); setDisabledRunConfirm(null); }}>
              รันครั้งเดียว
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
