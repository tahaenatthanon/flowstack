import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PRIORITY_LABELS } from '@/lib/labels';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import {
  Plus, RefreshCw, Pencil, Trash2, Calendar, Loader2, Play,
} from 'lucide-react';
import PageShell from '@/components/PageShell';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';

interface RecurringTask {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  description: string;
  frequency: string;
  interval_value: number;
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  due_date_offset: number;
  assignee: string;
  priority: string;
  status: string;
  estimated_days: number;
  task_type: string;
  is_active: number;
  next_occurrence: string | null;
  instance_count?: number;
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'รายวัน',
  weekly: 'รายสัปดาห์',
  biweekly: 'ทุก 2 สัปดาห์',
  monthly: 'รายเดือน',
  quarterly: 'รายไตรมาส',
  yearly: 'รายปี',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const DAY_LABELS = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

const emptyForm = {
  title: '', description: '', project_id: '', frequency: 'weekly',
  interval_value: 1, day_of_week: null as number | null, day_of_month: null as number | null,
  start_date: new Date().toISOString().slice(0, 10), end_date: '',
  due_date_offset: 0, assignee: '', priority: 'medium', estimated_days: 1,
  task_type: 'task', create_first_instance: false,
};

export function RecurringTasksContent() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [projectFilter, setProjectFilter] = useState<string>('__none__');
  const { activeTaskExecutionTypes } = useWorkTypeCatalog();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => apiFetch<{ id: string; name: string }[]>('/projects.php'),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => apiFetch<{ id: string; email: string; display_name: string }[]>('/users.php?active_only=1'),
  });

  const { data: recurringTasks = [], isLoading } = useQuery({
    queryKey: ['recurring-tasks-all', projectFilter],
    queryFn: () => {
      const url = projectFilter && projectFilter !== '__none__'
        ? `/recurring-tasks.php?project_id=${projectFilter}`
        : '/recurring-tasks.php';
      return apiFetch<RecurringTask[]>(url);
    },
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<RecurringTask>('/recurring-tasks.php', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-tasks-all'] });
      toast({ title: 'สร้างงานทำซ้ำสำเร็จ' });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      apiFetch<RecurringTask>(`/recurring-tasks.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-tasks-all'] });
      toast({ title: 'อัปเดตสำเร็จ' });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/recurring-tasks.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-tasks-all'] });
      toast({ title: 'ลบสำเร็จ' });
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const triggerMut = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/recurring-tasks.php?id=${id}&trigger=1`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-tasks-all'] });
      toast({ title: 'สร้างงานครั้งถัดไปสำเร็จ' });
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm);
  }

  function openEdit(rt: RecurringTask) {
    setEditId(rt.id);
    setForm({
      title: rt.title, description: rt.description ?? '', project_id: rt.project_id,
      frequency: rt.frequency, interval_value: rt.interval_value,
      day_of_week: rt.day_of_week, day_of_month: rt.day_of_month,
      start_date: rt.start_date, end_date: rt.end_date ?? '',
      due_date_offset: rt.due_date_offset, assignee: rt.assignee ?? '',
      priority: rt.priority, estimated_days: rt.estimated_days,
      task_type: rt.task_type, create_first_instance: false,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.title || !form.project_id) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' });
      return;
    }
    const payload: Record<string, unknown> = {
      title: form.title, description: form.description, project_id: form.project_id,
      frequency: form.frequency, interval_value: form.interval_value,
      start_date: form.start_date, due_date_offset: form.due_date_offset,
      assignee: form.assignee, priority: form.priority,
      estimated_days: form.estimated_days, task_type: form.task_type,
      create_first_instance: form.create_first_instance,
    };
    if (form.day_of_week !== null) payload.day_of_week = form.day_of_week;
    if (form.day_of_month !== null) payload.day_of_month = form.day_of_month;
    if (form.end_date) payload.end_date = form.end_date;

    if (editId) {
      updateMut.mutate({ id: editId, updates: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const getProjectName = (pid: string) => projects.find((p) => p.id === pid)?.name ?? '-';

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="ทุกโปรเจกต์" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">ทุกโปรเจกต์</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> สร้างงานทำซ้ำ
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : recurringTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">ยังไม่มีงานที่ทำซ้ำ</p>
            <p className="text-sm text-muted-foreground mt-1">สร้างงานทำซ้ำเพื่อสร้างงานอัตโนมัติตามกำหนด</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {recurringTasks.map((rt) => (
            <Card key={rt.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{rt.title}</span>
                      <Badge variant="outline">{getProjectName(rt.project_id)}</Badge>
                      <Badge className={PRIORITY_COLORS[rt.priority] ?? ''}>
                        {PRIORITY_LABELS[rt.priority] ?? rt.priority}
                      </Badge>
                      <Badge variant={rt.is_active ? 'default' : 'secondary'}>
                        {rt.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-3.5 w-3.5" /> {FREQ_LABELS[rt.frequency] ?? rt.frequency}
                        {rt.interval_value > 1 && ` (ทุก ${rt.interval_value})`}
                      </span>
                      {rt.next_occurrence && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          ครั้งถัดไป: {new Date(rt.next_occurrence).toLocaleDateString('th-TH')}
                        </span>
                      )}
                      {rt.instance_count != null && (
                        <span>สร้างแล้ว {rt.instance_count} ครั้ง</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => triggerMut.mutate(rt.id)}
                      disabled={triggerMut.isPending || !rt.is_active} title="สร้างครั้งถัดไป">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(rt)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={async () => { if (await confirm({ title: 'ลบรายการ', description: 'ยืนยันลบ?', variant: 'destructive' })) deleteMut.mutate(rt.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'แก้ไขงานทำซ้ำ' : 'สร้างงานทำซ้ำ'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>ชื่องาน *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>รายละเอียด</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>โปรเจกต์ *</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="เลือกโปรเจกต์" /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>ความถี่</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQ_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>ทุกๆ (จำนวน)</Label>
                <Input type="number" min={1} value={form.interval_value}
                  onChange={(e) => setForm((f) => ({ ...f, interval_value: +e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>ครบกำหนดภายใน (วัน)</Label>
                <Input type="number" min={0} value={form.due_date_offset}
                  onChange={(e) => setForm((f) => ({ ...f, due_date_offset: +e.target.value }))} />
              </div>
            </div>
            {(form.frequency === 'weekly' || form.frequency === 'biweekly') && (
              <div className="grid gap-2">
                <Label>วันในสัปดาห์</Label>
                <Select value={form.day_of_week?.toString() ?? '__none__'}
                  onValueChange={(v) => setForm((f) => ({ ...f, day_of_week: v === '__none__' ? null : +v }))}>
                  <SelectTrigger><SelectValue placeholder="เลือกวัน" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                    {DAY_LABELS.map((d, i) => <SelectItem key={i} value={i.toString()}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(form.frequency === 'monthly' || form.frequency === 'quarterly' || form.frequency === 'yearly') && (
              <div className="grid gap-2">
                <Label>วันที่ในเดือน</Label>
                <Input type="number" min={1} max={31} value={form.day_of_month ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, day_of_month: e.target.value ? +e.target.value : null }))} />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>วันเริ่มต้น</Label>
                <Input type="date" value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>วันสิ้นสุด</Label>
                <Input type="date" value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>ผู้รับผิดชอบ</Label>
                <Select value={form.assignee || '__none__'} onValueChange={(v) => setForm((f) => ({ ...f, assignee: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="เลือกผู้รับผิดชอบ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                    {users.map((u) => <SelectItem key={u.id} value={u.email}>{u.display_name || u.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>ความสำคัญ</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>จำนวนวันโดยประมาณ</Label>
                <Input type="number" min={0.5} step={0.5} value={form.estimated_days}
                  onChange={(e) => setForm((f) => ({ ...f, estimated_days: +e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>ประเภทงาน</Label>
                <Select value={form.task_type} onValueChange={(v) => setForm((f) => ({ ...f, task_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeTaskExecutionTypes.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editId && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.create_first_instance}
                  onChange={(e) => setForm((f) => ({ ...f, create_first_instance: e.target.checked }))} />
                สร้างงานทันทีสำหรับครั้งแรก
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editId ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RecurringTasksPage() {
  return (
    <PageShell
      breadcrumbs={[{ label: 'จัดการโปรเจค', href: '/projects' }, { label: 'งานที่ทำซ้ำ', isCurrent: true }]}
      title="งานที่ทำซ้ำ"
      description="จัดการงานที่ต้องทำซ้ำเป็นประจำ"
    >
      <RecurringTasksContent />
    </PageShell>
  );
}
