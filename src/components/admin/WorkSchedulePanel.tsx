import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

const DAY_LABELS: Record<number, string> = {
  1: 'จันทร์', 2: 'อังคาร', 3: 'พุธ', 4: 'พฤหัส', 5: 'ศุกร์', 6: 'เสาร์', 7: 'อาทิตย์'
};

interface User {
  id: string;
  display_name: string;
  email: string;
  is_active: number;
}

interface ScheduleDay { id?: string; day_of_week: number; is_working: number; work_hours: number; }
interface WorkSchedule { id: string; name: string; description: string; is_default: number; hours_per_day: number; days: ScheduleDay[]; }
interface UserAssignment { user_id: string; schedule_id: string; display_name: string; email: string; schedule_name: string; }

function defaultDays(): ScheduleDay[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i + 1,
    is_working: i < 5 ? 1 : 0,
    work_hours: i < 5 ? 8 : 0,
  }));
}

function ScheduleFormDialog({ open, onClose, initial }: {
  open: boolean; onClose: () => void; initial?: WorkSchedule;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [isDefault, setIsDefault] = useState(!!(initial?.is_default));
  const [days, setDays] = useState<ScheduleDay[]>(initial?.days ?? defaultDays());

  const mut = useMutation({
    mutationFn: (body: object) => initial
      ? apiFetch(`/work-schedules.php?id=${initial.id}`, { method: 'PUT', body: JSON.stringify(body) })
      : apiFetch('/work-schedules.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-schedules'] });
      toast({ title: initial ? 'แก้ไขสำเร็จ' : 'สร้างสำเร็จ' });
      onClose();
    },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const updateDay = (dow: number, field: 'is_working' | 'work_hours', value: number) => {
    setDays(prev => prev.map(d => d.day_of_week === dow ? { ...d, [field]: value } : d));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'แก้ไขตารางงาน' : 'สร้างตารางงานใหม่'}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>ชื่อตารางงาน</Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ออฟฟิส จ–ศ" />
          </div>
          <div>
            <Label>คำอธิบาย (ไม่บังคับ)</Label>
            <Input className="mt-1" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} id="is-default" />
            <Label htmlFor="is-default" className="cursor-pointer">ใช้เป็นค่าเริ่มต้นของบริษัท</Label>
          </div>
          <div>
            <Label className="text-sm mb-2 block">วันทำงานและชั่วโมง</Label>
            <div className="space-y-2">
              {days.map(day => (
                <div key={day.day_of_week} className="flex items-center gap-3">
                  <Switch
                    checked={!!day.is_working}
                    onCheckedChange={v => updateDay(day.day_of_week, 'is_working', v ? 1 : 0)}
                  />
                  <span className="w-16 text-sm">{DAY_LABELS[day.day_of_week]}</span>
                  <Input
                    type="number" min={0} max={24} step={0.5}
                    className="w-20 h-8 text-sm"
                    value={day.work_hours}
                    disabled={!day.is_working}
                    onChange={e => updateDay(day.day_of_week, 'work_hours', parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-xs text-muted-foreground">ชั่วโมง</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={!name || mut.isPending} onClick={() => mut.mutate({ name, description: desc, is_default: isDefault, days })}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {initial ? 'บันทึก' : 'สร้าง'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WorkSchedulePanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editTarget, setEditTarget] = useState<WorkSchedule | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: schedules = [], isLoading } = useQuery<WorkSchedule[]>({
    queryKey: ['work-schedules'],
    queryFn: () => apiFetch('/work-schedules.php'),
  });

  const { data: assignments = [] } = useQuery<UserAssignment[]>({
    queryKey: ['work-schedule-assignments'],
    queryFn: () => apiFetch('/work-schedules.php?action=user_assignments'),
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/users.php'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/work-schedules.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-schedules'] }); toast({ title: 'ลบสำเร็จ' }); },
    onError: (e: Error) => toast({ title: 'ลบไม่สำเร็จ', description: e.message, variant: 'destructive' }),
  });

  const assignMut = useMutation({
    mutationFn: (body: { user_id: string; schedule_id: string }) =>
      apiFetch('/work-schedules.php?action=assign', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-schedule-assignments'] }); toast({ title: 'กำหนด Schedule สำเร็จ' }); },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const unassignMut = useMutation({
    mutationFn: (userId: string) =>
      apiFetch(`/work-schedules.php?action=assign&user_id=${userId}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-schedule-assignments'] }); toast({ title: 'รีเซ็ต Schedule สำเร็จ' }); },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const getAssignment = (userId: string) => assignments.find(a => a.user_id === userId);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">ตารางการทำงาน</h3>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> สร้างตารางงาน
          </Button>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        <div className="grid gap-3 sm:grid-cols-2">
          {schedules.map(s => (
            <Card key={s.id}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  {s.name}
                  {!!s.is_default && (
                    <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                      <Star className="h-2.5 w-2.5 mr-0.5" />ค่าเริ่มต้น
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                <div className="flex gap-1 flex-wrap">
                  {(s.days ?? []).map(d => (
                    <Badge key={d.day_of_week} variant={d.is_working ? 'secondary' : 'outline'}
                      className={`text-[10px] ${!d.is_working ? 'opacity-40' : ''}`}>
                      {DAY_LABELS[d.day_of_week]} {d.is_working ? `${d.work_hours}h` : '–'}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1 justify-end">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditTarget(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!s.is_default && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm('ลบ Schedule นี้?')) deleteMut.mutate(s.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">กำหนด Schedule ให้พนักงาน</h3>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-xs">พนักงาน</th>
                <th className="px-3 py-2 text-left font-medium text-xs">Schedule ปัจจุบัน</th>
                <th className="px-3 py-2 text-left font-medium text-xs">เปลี่ยน</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.filter(u => u.is_active !== 0).map(u => {
                const asgn = getAssignment(u.id);
                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium text-xs">{u.display_name}</div>
                      <div className="text-[10px] text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {asgn ? asgn.schedule_name : <span className="italic">ค่าเริ่มต้นบริษัท</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={asgn?.schedule_id ?? '__none__'}
                        onValueChange={v => {
                          if (v === '__none__') {
                            if (asgn) unassignMut.mutate(u.id);
                            return;
                          }
                          assignMut.mutate({ user_id: u.id, schedule_id: v });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">ค่าเริ่มต้นบริษัท</SelectItem>
                          {schedules.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <ScheduleFormDialog open onClose={() => setShowCreate(false)} />}
      {editTarget && <ScheduleFormDialog open onClose={() => setEditTarget(null)} initial={editTarget} key={editTarget.id} />}
    </div>
  );
}
