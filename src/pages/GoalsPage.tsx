import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DbGoal } from '@/types/project';
import PageShell from '@/components/PageShell';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Target, TrendingUp, AlertTriangle, CheckCircle2, Edit, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { format } from 'date-fns';
import { safeFmt } from '@/lib/dateUtils';

const GOAL_TYPE_LABELS: Record<string, string> = {
  objective: 'วัตถุประสงค์',
  key_result: 'ผลลัพธ์หลัก',
  kpi: 'KPI',
  milestone: 'เหตุการณ์สำคัญ',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  at_risk: 'มีความเสี่ยง',
  on_hold: 'หยุดชั่วคราว',
  cancelled: 'ยกเลิก',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  at_risk: 'bg-red-100 text-red-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  goal_type: 'objective',
  status: 'active',
  target_value: 100,
  current_value: 0,
  unit: '%',
  start_date: format(new Date(), 'yyyy-MM-dd'),
  end_date: format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd'),
};

export default function GoalsPage() {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<DbGoal | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const { data: goals = [], isLoading } = useQuery<DbGoal[]>({
    queryKey: ['goals'],
    queryFn: () => apiFetch('/goals.php'),
  });

  const createMutation = useMutation({
    mutationFn: (goal: typeof EMPTY_FORM) => apiFetch('/goals.php', {
      method: 'POST',
      body: JSON.stringify({ ...goal, target_value: Number(goal.target_value), current_value: Number(goal.current_value) }),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); toast.success('สร้างเป้าหมายสำเร็จ'); closeDialog(); },
    onError: (err: any) => toast.error(err.message || 'ไม่สามารถสร้างเป้าหมายได้'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: any) => apiFetch(`/goals.php?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, target_value: Number(data.target_value), current_value: Number(data.current_value) }),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); toast.success('อัปเดตเป้าหมายสำเร็จ'); closeDialog(); },
    onError: (err: any) => toast.error(err.message || 'ไม่สามารถอัปเดตได้'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/goals.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); toast.success('ลบเป้าหมายสำเร็จ'); },
    onError: (err: any) => toast.error(err.message || 'ไม่สามารถลบได้'),
  });

  const openCreate = () => { setEditingGoal(null); setForm({ ...EMPTY_FORM }); setDialogOpen(true); };
  const openEdit = (goal: DbGoal) => {
    setEditingGoal(goal);
    setForm({
      title: goal.title || '',
      description: goal.description || '',
      goal_type: goal.goal_type || 'objective',
      status: goal.status || 'active',
      target_value: goal.target_value ?? 100,
      current_value: goal.current_value ?? 0,
      unit: goal.unit || '%',
      start_date: goal.start_date ? goal.start_date.split('T')[0] : format(new Date(), 'yyyy-MM-dd'),
      end_date: goal.end_date ? goal.end_date.split('T')[0] : format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingGoal(null); setForm({ ...EMPTY_FORM }); };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('กรุณากรอกชื่อเป้าหมาย'); return; }
    if (editingGoal) updateMutation.mutate({ id: editingGoal.id, ...form });
    else createMutation.mutate(form);
  };
  const handleDelete = async (goal: DbGoal) => {
    const ok = await confirm({ title: 'ลบเป้าหมาย', description: `ลบเป้าหมาย "${goal.title}"?`, variant: 'destructive' });
    if (!ok) return;
    deleteMutation.mutate(goal.id);
  };
  const toggleExpand = (id: string) => {
    setExpandedGoals(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const activeGoals = goals.filter((g: any) => g.status === 'active');
  const completedGoals = goals.filter((g: any) => g.status === 'completed');
  const atRiskGoals = goals.filter((g: any) => g.status === 'at_risk');
  const topLevelGoals = goals.filter((g: any) => !g.parent_goal_id);
  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><p className="text-muted-foreground">กำลังโหลด...</p></div>;
  }

  return (
    <PageShell
      breadcrumbs={[{ label: 'เป้าหมาย & OKR', isCurrent: true }]}
      title="เป้าหมาย & OKR"
      description="ติดตามเป้าหมายและ Key Results ของทีม"
      actions={<><Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />เพิ่มเป้าหมาย</Button></>}
    >

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'เป้าหมายทั้งหมด', value: goals.length, icon: Target, color: 'text-muted-foreground' },
          { label: 'กำลังดำเนินการ', value: activeGoals.length, icon: TrendingUp, color: 'text-blue-500' },
          { label: 'เสร็จสิ้น', value: completedGoals.length, icon: CheckCircle2, color: 'text-green-500' },
          { label: 'มีความเสี่ยง', value: atRiskGoals.length, icon: AlertTriangle, color: 'text-red-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}><CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></div>
              <Icon className={`w-8 h-8 ${color}`} />
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* Goals List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>เป้าหมายทั้งหมด</CardTitle>
          {goals.length > 0 && <span className="text-sm text-muted-foreground">{goals.length} รายการ</span>}
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p className="mb-4">ยังไม่มีเป้าหมาย</p>
              <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />สร้างเป้าหมายแรก</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {topLevelGoals.map((goal: any) => {
                const isExpanded = expandedGoals.has(goal.id);
                const childGoals = goals.filter((g: any) => g.parent_goal_id === goal.id);
                const progress = goal.target_value > 0 ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : (goal.progress_percentage || 0);
                return (
                  <div key={goal.id} className="border rounded-lg overflow-hidden">
                    <div className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                      {childGoals.length > 0 ? (
                        <button onClick={() => toggleExpand(goal.id)} className="mt-0.5 text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      ) : <div className="w-4 h-4 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[goal.status] || 'bg-muted text-muted-foreground'}`}>
                            {STATUS_LABELS[goal.status] || goal.status}
                          </span>
                          <Badge variant="outline" className="text-xs">{GOAL_TYPE_LABELS[goal.goal_type] || goal.goal_type}</Badge>
                        </div>
                        <h3 className="font-semibold truncate">{goal.title}</h3>
                        {goal.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{goal.description}</p>}
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>ความคืบหน้า</span>
                            <span className="font-medium">{goal.current_value || 0} / {goal.target_value || 100} {goal.unit}</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                        {(goal.start_date || goal.end_date) && (
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {goal.start_date && <span>เริ่ม: {safeFmt(goal.start_date)}</span>}
                            {goal.end_date && <span>สิ้นสุด: {safeFmt(goal.end_date)}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(goal)}><Edit className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(goal)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                    {isExpanded && childGoals.length > 0 && (
                      <div className="border-t bg-muted/20">
                        {childGoals.map((child: any) => {
                          const cp = child.target_value > 0 ? Math.min(100, Math.round((child.current_value / child.target_value) * 100)) : (child.progress_percentage || 0);
                          return (
                            <div key={child.id} className="flex items-start gap-3 p-4 pl-10 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[child.status] || 'bg-muted text-muted-foreground'}`}>{STATUS_LABELS[child.status] || child.status}</span>
                                  <Badge variant="outline" className="text-xs">{GOAL_TYPE_LABELS[child.goal_type] || child.goal_type}</Badge>
                                </div>
                                <p className="font-medium text-sm">{child.title}</p>
                                <div className="mt-1.5 space-y-1">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>ความคืบหน้า</span><span>{child.current_value || 0} / {child.target_value || 100} {child.unit}</span>
                                  </div>
                                  <Progress value={cp} className="h-1.5" />
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(child)}><Edit className="w-3 h-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(child)}><Trash2 className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader><DialogTitle>{editingGoal ? 'แก้ไขเป้าหมาย' : 'เพิ่มเป้าหมายใหม่'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>ชื่อเป้าหมาย *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="เช่น เพิ่มยอดขาย 30% ในไตรมาส 2" required />
            </div>
            <div className="space-y-1.5">
              <Label>รายละเอียด</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="อธิบายเพิ่มเติม..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ประเภท</Label>
                <Select value={form.goal_type} onValueChange={v => setForm(f => ({ ...f, goal_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(GOAL_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>สถานะ</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>เป้าหมาย</Label><Input type="number" min={0} value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: Number(e.target.value) }))} /></div>
              <div className="space-y-1.5"><Label>ปัจจุบัน</Label><Input type="number" min={0} value={form.current_value} onChange={e => setForm(f => ({ ...f, current_value: Number(e.target.value) }))} /></div>
              <div className="space-y-1.5"><Label>หน่วย</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="%" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>วันเริ่มต้น</Label><Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>วันสิ้นสุด</Label><Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>ยกเลิก</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'กำลังบันทึก...' : editingGoal ? 'บันทึก' : 'สร้าง'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
