import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DbAutomationRule } from '@/types/project';
import PageShell from '@/components/PageShell';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Zap, Play, Pause, Trash2, Edit, X, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/useConfirm';

const TRIGGER_LABELS: Record<string, string> = {
  task_created:        'สร้างงานใหม่',
  task_updated:        'อัปเดตงาน',
  task_deleted:        'ลบงาน',
  status_changed:      'เปลี่ยนสถานะ',
  priority_changed:    'เปลี่ยนความสำคัญ',
  assignee_changed:    'เปลี่ยนผู้รับผิดชอบ',
  due_date_approaching:'ใกล้วันกำหนด',
  due_date_passed:     'เลยวันกำหนด',
  subtask_completed:   'งานย่อยเสร็จ',
  dependency_resolved: 'ความสัมพันธ์ถูกแก้ไข',
};

const CONDITION_FIELDS = [
  { value: 'status',    label: 'สถานะ' },
  { value: 'priority',  label: 'ความสำคัญ' },
  { value: 'assignee',  label: 'ผู้รับผิดชอบ' },
  { value: 'task_type', label: 'ประเภทงาน' },
  { value: 'title',     label: 'ชื่องาน' },
];

const CONDITION_OPERATORS = [
  { value: 'equals',      label: 'เท่ากับ' },
  { value: 'not_equals',  label: 'ไม่เท่ากับ' },
  { value: 'contains',    label: 'มีคำว่า' },
  { value: 'is_empty',    label: 'ว่างเปล่า' },
  { value: 'is_not_empty',label: 'ไม่ว่างเปล่า' },
];

const ACTION_TYPES = [
  { value: 'update_status',    label: 'เปลี่ยนสถานะ' },
  { value: 'assign_to',        label: 'มอบหมายให้' },
  { value: 'set_due_date',     label: 'ตั้งวันกำหนดส่ง' },
  { value: 'create_subtask',   label: 'สร้างงานย่อย' },
  { value: 'send_notification',label: 'ส่งการแจ้งเตือน' },
];

const STATUS_OPTIONS = ['pending','in-progress','completed','overdue','cancelled'];
const PRIORITY_OPTIONS = ['low','medium','high'];
const TASK_TYPE_OPTIONS = ['task','meeting','onsite','ot','leave','holiday'];

interface Condition { field: string; operator: string; value: string; }
interface Action    { type: string; value?: string; assignee?: string; days?: number; title?: string; message?: string; }

function ConditionRow({ cond, onChange, onRemove }: { cond: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  const noValue = ['is_empty','is_not_empty'].includes(cond.operator);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={cond.field} onValueChange={v => onChange({ ...cond, field: v })}>
        <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
        <SelectContent>{CONDITION_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={cond.operator} onValueChange={v => onChange({ ...cond, operator: v })}>
        <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
        <SelectContent>{CONDITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
      {!noValue && (
        <Input className="h-8 text-xs w-32" value={cond.value} placeholder="ค่า..."
          onChange={e => onChange({ ...cond, value: e.target.value })} />
      )}
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function ActionRow({ action, onChange, onRemove }: { action: Action; onChange: (a: Action) => void; onRemove: () => void }) {
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <Select value={action.type} onValueChange={v => onChange({ type: v })}>
        <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
        <SelectContent>{ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
      </Select>

      {action.type === 'update_status' && (
        <Select value={action.value ?? ''} onValueChange={v => onChange({ ...action, value: v })}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="เลือกสถานะ" /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      )}
      {action.type === 'assign_to' && (
        <Input className="h-8 text-xs w-36" placeholder="ชื่อผู้รับผิดชอบ"
          value={action.assignee ?? ''}
          onChange={e => onChange({ ...action, assignee: e.target.value })} />
      )}
      {action.type === 'set_due_date' && (
        <div className="flex items-center gap-1">
          <Input type="number" className="h-8 text-xs w-20" placeholder="7" min={1}
            value={action.days ?? ''}
            onChange={e => onChange({ ...action, days: parseInt(e.target.value) || 1 })} />
          <span className="text-xs text-muted-foreground">วันจากนี้</span>
        </div>
      )}
      {action.type === 'create_subtask' && (
        <Input className="h-8 text-xs w-40" placeholder="ชื่องานย่อย"
          value={action.title ?? ''}
          onChange={e => onChange({ ...action, title: e.target.value })} />
      )}
      {action.type === 'send_notification' && (
        <Input className="h-8 text-xs w-48" placeholder="ข้อความแจ้งเตือน"
          value={action.message ?? ''}
          onChange={e => onChange({ ...action, message: e.target.value })} />
      )}
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive mt-1"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function summariseConditions(conds: Condition[]) {
  if (!conds.length) return 'ทุกกรณี';
  return conds.map(c => {
    const f = CONDITION_FIELDS.find(x => x.value === c.field)?.label ?? c.field;
    const o = CONDITION_OPERATORS.find(x => x.value === c.operator)?.label ?? c.operator;
    return `${f} ${o}${c.value ? ` "${c.value}"` : ''}`;
  }).join(' และ ');
}

function summariseActions(acts: Action[]) {
  if (!acts.length) return 'ไม่มีการกระทำ';
  return acts.map(a => {
    const t = ACTION_TYPES.find(x => x.value === a.type)?.label ?? a.type;
    if (a.type === 'update_status') return `${t}: ${a.value ?? ''}`;
    if (a.type === 'assign_to') return `${t}: ${a.assignee ?? ''}`;
    if (a.type === 'set_due_date') return `${t}: +${a.days ?? 1} วัน`;
    if (a.type === 'create_subtask') return `${t}: "${a.title ?? ''}"`;
    return t;
  }).join(', ');
}

const EMPTY_FORM = { name: '', description: '', trigger_event: 'task_created', is_active: true };

export default function AutomationPage() {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editingRule, setEditingRule] = useState<DbAutomationRule | null>(null);
  const [form, setForm]               = useState({ ...EMPTY_FORM });
  const [conditions, setConditions]   = useState<Condition[]>([]);
  const [actions, setActions]         = useState<Action[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: rules = [], isLoading } = useQuery<DbAutomationRule[]>({
    queryKey: ['automation-rules'],
    queryFn: () => apiFetch('/automation.php'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/automation.php?id=${id}&toggle`, { method: 'POST' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['automation-rules'] }); toast.success('อัปเดตสถานะสำเร็จ'); },
    onError: (err: any) => toast.error(err.message || 'ไม่สามารถอัปเดตได้'),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editingRule
      ? apiFetch(`/automation.php?id=${editingRule.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : apiFetch('/automation.php', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      toast.success(editingRule ? 'บันทึกสำเร็จ' : 'สร้างกฎสำเร็จ');
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message || 'เกิดข้อผิดพลาด'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/automation.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['automation-rules'] }); toast.success('ลบกฎสำเร็จ'); },
    onError: (err: any) => toast.error(err.message || 'ไม่สามารถลบได้'),
  });

  const openCreate = () => {
    setEditingRule(null);
    setForm({ ...EMPTY_FORM });
    setConditions([]);
    setActions([]);
    setShowAdvanced(false);
    setDialogOpen(true);
  };

  const openEdit = (rule: DbAutomationRule) => {
    setEditingRule(rule);
    setForm({ name: rule.name, description: rule.description ?? '', trigger_event: rule.trigger_event, is_active: rule.is_active });
    setConditions(Array.isArray(rule.conditions) ? rule.conditions : []);
    setActions(Array.isArray(rule.actions) ? rule.actions : []);
    setShowAdvanced(true);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingRule(null); setForm({ ...EMPTY_FORM }); setConditions([]); setActions([]); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('กรุณากรอกชื่อกฎ'); return; }
    if (actions.length === 0) { toast.error('กรุณาเพิ่มอย่างน้อย 1 การกระทำ'); return; }
    saveMutation.mutate({ ...form, conditions, actions });
  };

  const handleDelete = async (rule: DbAutomationRule) => {
    const ok = await confirm({ title: 'ลบกฎ', description: `ลบกฎ "${rule.name}"?`, variant: 'destructive' });
    if (!ok) return;
    deleteMutation.mutate(rule.id);
  };

  const addCondition = () => setConditions(c => [...c, { field: 'status', operator: 'equals', value: '' }]);
  const updateCondition = (i: number, c: Condition) => setConditions(prev => prev.map((x, idx) => idx === i ? c : x));
  const removeCondition = (i: number) => setConditions(prev => prev.filter((_, idx) => idx !== i));

  const addAction = () => setActions(a => [...a, { type: 'update_status', value: 'completed' }]);
  const updateAction = (i: number, a: Action) => setActions(prev => prev.map((x, idx) => idx === i ? a : x));
  const removeAction = (i: number) => setActions(prev => prev.filter((_, idx) => idx !== i));

  const activeRules   = rules.filter((r: any) => r.is_active);
  const inactiveRules = rules.filter((r: any) => !r.is_active);

  if (isLoading) return <div className="flex items-center justify-center min-h-[400px]"><p className="text-muted-foreground">กำลังโหลด...</p></div>;

  return (
    <PageShell
      breadcrumbs={[{ label: 'ระบบอัตโนมัติ', isCurrent: true }]}
      title="ระบบอัตโนมัติ"
      description="สร้างกฎอัตโนมัติเพื่อลดงานซ้ำๆ"
      actions={<><Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />สร้างกฎใหม่</Button></>}
    >

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'กฎทั้งหมด',  value: rules.length,         icon: Zap,   color: 'text-muted-foreground' },
          { label: 'กำลังทำงาน', value: activeRules.length,   icon: Play,  color: 'text-green-500' },
          { label: 'ปิดอยู่',    value: inactiveRules.length, icon: Pause, color: 'text-gray-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}><CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></div>
              <Icon className={`w-8 h-8 ${color}`} />
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">กฎอัตโนมัติ</h2>
        {rules.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">ยังไม่มีกฎอัตโนมัติ</p>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />สร้างกฎแรก</Button>
          </CardContent></Card>
        ) : (
          rules.map((rule: any) => {
            const conds: Condition[] = Array.isArray(rule.conditions) ? rule.conditions : [];
            const acts: Action[]    = Array.isArray(rule.actions)    ? rule.actions    : [];
            return (
              <Card key={rule.id} className={rule.is_active ? '' : 'opacity-60'}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'} className="text-xs">{rule.is_active ? 'ทำงาน' : 'หยุด'}</Badge>
                        <Badge variant="outline" className="text-xs">{TRIGGER_LABELS[rule.trigger_event] ?? rule.trigger_event}</Badge>
                      </div>
                      {rule.description && <p className="text-sm text-muted-foreground mb-1">{rule.description}</p>}
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p><span className="font-medium text-foreground">เงื่อนไข:</span> {summariseConditions(conds)}</p>
                        <p><span className="font-medium text-foreground">การกระทำ:</span> {summariseActions(acts)}</p>
                        <p>รันแล้ว: {rule.execution_count ?? rule.trigger_count ?? 0} ครั้ง</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={!!rule.is_active} onCheckedChange={() => toggleMutation.mutate(rule.id)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(rule)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="w-full sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRule ? 'แก้ไขกฎ' : 'สร้างกฎใหม่'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Basic */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>ชื่อกฎ <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ปิดงานอัตโนมัติเมื่อเสร็จ" />
              </div>
              <div className="space-y-1.5">
                <Label>รายละเอียด</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="อธิบายเพิ่มเติม..." />
              </div>
              <div className="space-y-1.5">
                <Label>ตัวกระตุ้น (Trigger)</Label>
                <Select value={form.trigger_event} onValueChange={v => setForm(f => ({ ...f, trigger_event: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="is_active" checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label htmlFor="is_active">เปิดใช้งานทันที</Label>
              </div>
            </div>

            {/* Advanced: Conditions + Actions */}
            <div className="border rounded-lg overflow-hidden">
              <button type="button"
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => setShowAdvanced(v => !v)}>
                <span>เงื่อนไข &amp; การกระทำ</span>
                {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {showAdvanced && (
                <div className="p-4 space-y-4">
                  {/* Conditions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">เงื่อนไข (ถ้าว่างเปล่า = ทุกกรณี)</Label>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={addCondition}>+ เพิ่ม</Button>
                    </div>
                    {conditions.length === 0 && <p className="text-xs text-muted-foreground italic">ทำงานทุกครั้งที่ trigger ถูกเรียก</p>}
                    {conditions.map((c, i) => (
                      <ConditionRow key={i} cond={c} onChange={nc => updateCondition(i, nc)} onRemove={() => removeCondition(i)} />
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">การกระทำ <span className="text-destructive">*</span></Label>
                      <Button type="button" variant="outline" size="sm" className="h-6 text-xs px-2" onClick={addAction}>+ เพิ่ม</Button>
                    </div>
                    {actions.length === 0 && <p className="text-xs text-muted-foreground italic">ยังไม่มีการกระทำ</p>}
                    {actions.map((a, i) => (
                      <ActionRow key={i} action={a} onChange={na => updateAction(i, na)} onRemove={() => removeAction(i)} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>ยกเลิก</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'กำลังบันทึก...' : editingRule ? 'บันทึก' : 'สร้าง'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
