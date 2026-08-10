import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface CustomField {
  id: string;
  name: string;
  field_type: string;
  field_options: string | null;
  is_required: number;
  is_global: number;
  project_id: string | null;
  default_value: string | null;
  sort_order: number;
  usage_count?: number;
}

const TYPE_LABELS: Record<string, string> = {
  text: 'ข้อความ', number: 'ตัวเลข', date: 'วันที่', select: 'เลือกตัวเดียว',
  multiselect: 'เลือกหลายตัว', currency: 'สกุลเงิน', boolean: 'ใช่/ไม่ใช่',
  url: 'ลิงก์', email: 'อีเมล',
};

const emptyForm = {
  name: '', field_type: 'text', field_options: '', is_required: 0,
  is_global: 1, project_id: '', default_value: '', sort_order: 0,
};

export function CustomFieldsPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['custom-fields'],
    queryFn: () => apiFetch<CustomField[]>('/custom-fields.php'),
  });

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch('/custom-fields.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-fields'] }); toast({ title: 'สร้างฟิลด์สำเร็จ' }); closeDialog(); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      apiFetch(`/custom-fields.php?id=${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-fields'] }); toast({ title: 'อัปเดตสำเร็จ' }); closeDialog(); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/custom-fields.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['custom-fields'] }); toast({ title: 'ลบสำเร็จ' }); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  function closeDialog() { setDialogOpen(false); setEditId(null); setForm(emptyForm); }

  function openEdit(f: CustomField) {
    let opts = '';
    if (f.field_options) {
      try {
        const arr = JSON.parse(f.field_options);
        opts = Array.isArray(arr) ? arr.join(', ') : f.field_options;
      } catch { opts = f.field_options; }
    }
    setEditId(f.id);
    setForm({
      name: f.name, field_type: f.field_type, field_options: opts,
      is_required: f.is_required, is_global: f.is_global,
      project_id: f.project_id ?? '', default_value: f.default_value ?? '',
      sort_order: f.sort_order,
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name) { toast({ title: 'กรุณาระบุชื่อฟิลด์', variant: 'destructive' }); return; }
    const payload: Record<string, unknown> = {
      name: form.name, field_type: form.field_type, is_required: form.is_required,
      is_global: form.is_global, default_value: form.default_value, sort_order: form.sort_order,
    };
    if (['select', 'multiselect'].includes(form.field_type) && form.field_options) {
      payload.field_options = JSON.stringify(form.field_options.split(',').map((s) => s.trim()).filter(Boolean));
    }
    if (!form.is_global && form.project_id) payload.project_id = form.project_id;
    if (editId) updateMut.mutate({ id: editId, updates: payload });
    else createMut.mutate(payload);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">ฟิลด์ที่กำหนดเอง</h3>
          <p className="text-sm text-muted-foreground">จัดการฟิลด์เพิ่มเติมสำหรับงาน</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setEditId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> เพิ่มฟิลด์
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : fields.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">ยังไม่มีฟิลด์ที่กำหนดเอง</CardContent></Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อฟิลด์</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>ขอบเขต</TableHead>
              <TableHead>จำเป็น</TableHead>
              <TableHead>ใช้งาน</TableHead>
              <TableHead className="w-24">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell><Badge variant="outline">{TYPE_LABELS[f.field_type] ?? f.field_type}</Badge></TableCell>
                <TableCell>{f.is_global ? 'ทั้งระบบ' : 'โปรเจกต์'}</TableCell>
                <TableCell>{f.is_required ? <Badge variant="destructive">จำเป็น</Badge> : '-'}</TableCell>
                <TableCell>{f.usage_count ?? 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={async () => { if (await confirm({ title: 'ลบฟิลด์', description: 'ยืนยันลบ?', variant: 'destructive' })) deleteMut.mutate(f.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'แก้ไขฟิลด์' : 'เพิ่มฟิลด์'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>ชื่อฟิลด์ *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>ประเภท</Label>
                <Select value={form.field_type} onValueChange={(v) => setForm((f) => ({ ...f, field_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>ลำดับ</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: +e.target.value }))} />
              </div>
            </div>
            {['select', 'multiselect'].includes(form.field_type) && (
              <div className="grid gap-2">
                <Label>ตัวเลือก (คั่นด้วยคอมม่า)</Label>
                <Textarea value={form.field_options} onChange={(e) => setForm((f) => ({ ...f, field_options: e.target.value }))}
                  placeholder="ตัวเลือก 1, ตัวเลือก 2, ตัวเลือก 3" />
              </div>
            )}
            <div className="grid gap-2">
              <Label>ค่าเริ่มต้น</Label>
              <Input value={form.default_value} onChange={(e) => setForm((f) => ({ ...f, default_value: e.target.value }))} />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.is_required}
                  onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked ? 1 : 0 }))} />
                จำเป็นต้องกรอก
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!form.is_global}
                  onChange={(e) => setForm((f) => ({ ...f, is_global: e.target.checked ? 1 : 0 }))} />
                ใช้ทั้งระบบ
              </label>
            </div>
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

export default CustomFieldsPanel;
