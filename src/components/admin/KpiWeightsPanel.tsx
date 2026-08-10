import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Plus, Pencil, Trash2, Loader2, Target } from 'lucide-react';

interface KpiWeight {
  id: string;
  department: string;
  p_weight: string;
  q_weight: string;
  a_weight: string;
  s_weight: string;
  b_weight: string;
  is_active: number;
}

const AXIS_LABELS: Record<string, string> = {
  p_weight: 'Production (P) — ปริมาณงาน',
  q_weight: 'Quality (Q) — ความตรงต่อเวลา',
  a_weight: 'Accuracy (A) — ความถูกต้อง',
  s_weight: 'Solution (S) — การแก้ปัญหา',
  b_weight: 'BD (B) — การหา Lead',
};

export function KpiWeightsPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<KpiWeight | null>(null);

  // Form state
  const [dept, setDept] = useState('');
  const [p, setP] = useState('25');
  const [q, setQ] = useState('25');
  const [a, setA] = useState('25');
  const [s, setS] = useState('25');
  const [b, setB] = useState('0');

  const { data: weights = [], isLoading } = useQuery({
    queryKey: ['kpi-weights'],
    queryFn: () => apiFetch<KpiWeight[]>('/kpi-weights.php'),
  });

  const qInv = () => qc.invalidateQueries({ queryKey: ['kpi-weights'] });

  const sum = parseFloat(p) + parseFloat(q) + parseFloat(a) + parseFloat(s) + parseFloat(b);

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editing
        ? apiFetch(`/kpi-weights.php?id=${editing.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : apiFetch('/kpi-weights.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (res: any) => {
      qInv();
      toast({ title: editing ? 'อัปเดตสำเร็จ' : 'เพิ่มสำเร็จ', description: res?.warning });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const seedMut = useMutation({
    mutationFn: () => apiFetch('/kpi-weights.php?action=seed', { method: 'POST' }),
    onSuccess: (res: any) => { qInv(); toast({ title: res?.message || 'เพิ่มค่าเริ่มต้นสำเร็จ' }); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/kpi-weights.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qInv(); toast({ title: 'ลบสำเร็จ' }); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    setDept('');
    setP('25'); setQ('25'); setA('25'); setS('25'); setB('0');
    setDialogOpen(true);
  };

  const openEdit = (w: KpiWeight) => {
    setEditing(w);
    setDept(w.department);
    setP(parseFloat(w.p_weight).toString());
    setQ(parseFloat(w.q_weight).toString());
    setA(parseFloat(w.a_weight).toString());
    setS(parseFloat(w.s_weight).toString());
    setB(parseFloat(w.b_weight ?? '0').toString());
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const handleSave = () => {
    if (!dept.trim()) { toast({ title: 'กรุณากรอกชื่อแผนก', variant: 'destructive' }); return; }
    saveMut.mutate({ department: dept.trim(), p_weight: parseFloat(p), q_weight: parseFloat(q), a_weight: parseFloat(a), s_weight: parseFloat(s), b_weight: parseFloat(b) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">ตั้งค่า KPI Weight รายแผนก</h3>
          <p className="text-sm text-muted-foreground">
            กำหนดน้ำหนัก 5 แกน (P, Q, A, S, B) สำหรับคำนวณ KPI แต่ละแผนก • ผลรวมต้องเท่ากับ 100 • แกน B (BD) ใช้สำหรับตำแหน่งที่หา Lead ด้วย
          </p>
        </div>
        <div className="flex gap-2">
          {weights.length === 0 && (
            <Button size="sm" variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              <Target className="h-4 w-4 mr-1" />เพิ่มค่าเริ่มต้น
            </Button>
          )}
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />เพิ่มแผนก
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : weights.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Target className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">ยังไม่ได้ตั้งค่า KPI Weight</p>
              <Button size="sm" variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                <Target className="h-4 w-4 mr-1" />เพิ่มค่าตั้งต้นตาม Doc (Dev/Sales/Support/Admin)
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>แผนก</TableHead>
                    <TableHead className="text-right">P (Production)</TableHead>
                    <TableHead className="text-right">Q (Quality)</TableHead>
                    <TableHead className="text-right">A (Accuracy)</TableHead>
                    <TableHead className="text-right">S (Solution)</TableHead>
                    <TableHead className="text-right">B (BD)</TableHead>
                    <TableHead className="text-center">ผลรวม</TableHead>
                    <TableHead className="text-center">สถานะ</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weights.map((w) => {
                    const total = parseFloat(w.p_weight) + parseFloat(w.q_weight) + parseFloat(w.a_weight) + parseFloat(w.s_weight) + parseFloat(w.b_weight ?? '0');
                    const balanced = total >= 99.5 && total <= 100.5;
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.department}</TableCell>
                        <TableCell className="text-right">{w.p_weight}%</TableCell>
                        <TableCell className="text-right">{w.q_weight}%</TableCell>
                        <TableCell className="text-right">{w.a_weight}%</TableCell>
                        <TableCell className="text-right">{w.s_weight}%</TableCell>
                        <TableCell className="text-right text-blue-600">{w.b_weight ?? '0.00'}%</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={balanced ? 'default' : 'destructive'} className={balanced ? 'bg-green-100 text-green-700' : ''}>
                            {total.toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(w.is_active) ? (
                            <Badge variant="default" className="bg-green-100 text-green-700 text-xs">ใช้อยู่</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">ไม่ใช้</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(w)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                              onClick={async () => {
                                if (!await confirm({ title: 'ลบการตั้งค่า', description: `ต้องการลบ "${w.department}"?`, variant: 'destructive' })) return;
                                deleteMut.mutate(w.id);
                              }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไข KPI Weight' : 'เพิ่ม KPI Weight'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>แผนก</Label>
              <Input value={dept} onChange={(e) => setDept(e.target.value)} placeholder="เช่น Development, Sales" className="mt-1" disabled={!!editing} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>P — Production (%)</Label>
                <Input type="number" min={0} max={100} step={0.5} value={p} onChange={(e) => setP(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Q — Quality (%)</Label>
                <Input type="number" min={0} max={100} step={0.5} value={q} onChange={(e) => setQ(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>A — Accuracy (%)</Label>
                <Input type="number" min={0} max={100} step={0.5} value={a} onChange={(e) => setA(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>S — Solution (%)</Label>
                <Input type="number" min={0} max={100} step={0.5} value={s} onChange={(e) => setS(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>B — Business Dev (%)</Label>
                <Input type="number" min={0} max={100} step={0.5} value={b} onChange={(e) => setB(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-4 py-3">
              <span className="text-sm font-medium">ผลรวม</span>
              <Badge variant={Math.abs(sum - 100) <= 0.5 ? 'default' : 'destructive'} className={Math.abs(sum - 100) <= 0.5 ? 'bg-green-100 text-green-700' : ''}>
                {sum.toFixed(1)}%
              </Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? 'บันทึก' : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
