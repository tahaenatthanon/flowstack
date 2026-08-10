import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Plus, Pencil, Trash2, Loader2, Bot, Star } from 'lucide-react';

interface Persona {
  id: string;
  name: string;
  avatar_emoji: string;
  description: string;
  personality: string;
  data_scope: string;
  is_default: number;
  created_at: string;
}

const SCOPE_LABELS: Record<string, string> = {
  personal: 'ส่วนตัว',
  team: 'ทีม',
  admin: 'ผู้ดูแล',
};

export function PersonasPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Persona | null>(null);

  // Form
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [desc, setDesc] = useState('');
  const [personality, setPersonality] = useState('');
  const [scope, setScope] = useState('personal');

  const { data: personas = [], isLoading } = useQuery({
    queryKey: ['ai-personas'],
    queryFn: () => apiFetch<Persona[]>('/personas.php'),
  });

  const qInv = () => qc.invalidateQueries({ queryKey: ['ai-personas'] });

  const saveMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      editing
        ? apiFetch(`/personas.php?id=${editing.id}`, { method: 'PUT', body: JSON.stringify(data) })
        : apiFetch('/personas.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qInv(); toast({ title: editing ? 'อัปเดต Persona สำเร็จ' : 'สร้าง Persona สำเร็จ' }); closeDialog(); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/personas.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qInv(); toast({ title: 'ลบ Persona สำเร็จ' }); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditing(null);
    setName(''); setEmoji('🤖'); setDesc(''); setPersonality(''); setScope('personal');
    setDialogOpen(true);
  };

  const openEdit = (p: Persona) => {
    setEditing(p);
    setName(p.name); setEmoji(p.avatar_emoji); setDesc(p.description || ''); setPersonality(p.personality); setScope(p.data_scope);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const handleSave = () => {
    if (!name.trim()) { toast({ title: 'กรุณากรอกชื่อ Persona', variant: 'destructive' }); return; }
    if (!personality.trim()) { toast({ title: 'กรุณากรอกลักษณะนิสัย', variant: 'destructive' }); return; }
    saveMut.mutate({
      name: name.trim(), avatar_emoji: emoji, description: desc.trim(),
      personality: personality.trim(), data_scope: scope,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">จัดการ AI Persona</h3>
          <p className="text-sm text-muted-foreground">
            กำหนดบุคลิกและขอบเขตข้อมูลของ AI Secretary ที่ใช้ในระบบ
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />สร้าง Persona
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : personas.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Bot className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">ยังไม่มี AI Persona</p>
              <p className="text-xs text-muted-foreground">สร้าง Persona แรกเพื่อกำหนดบุคลิก AI ของระบบ</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>บุคลิกภาพ</TableHead>
                  <TableHead className="w-24">ขอบเขต</TableHead>
                  <TableHead className="w-20">ค่าเริ่มต้น</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {personas.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xl">{p.avatar_emoji}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.personality}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{SCOPE_LABELS[p.data_scope] || p.data_scope}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.is_default === 1 ? <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                          onClick={async () => {
                            if (!await confirm({ title: 'ลบ Persona', description: `ต้องการลบ "${p.name}"?`, variant: 'destructive' })) return;
                            deleteMut.mutate(p.id);
                          }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไข Persona' : 'สร้าง Persona'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="shrink-0">
                <Label>Emoji</Label>
                <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="mt-1 w-20 text-center text-2xl" maxLength={10} />
              </div>
              <div className="flex-1">
                <Label>ชื่อ Persona *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น นักวิเคราะห์, ผู้ช่วยส่วนตัว" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>คำอธิบายสั้น</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="เช่น ผู้ช่วยวิเคราะห์ข้อมูลเชิงลึก" className="mt-1" />
            </div>
            <div>
              <Label>ลักษณะนิสัย (Personality Prompt) *</Label>
              <Textarea value={personality} onChange={(e) => setPersonality(e.target.value)} rows={4}
                placeholder="อธิบายบุคลิก AI เช่น: คุณเป็นนักวิเคราะห์ที่พูดจาตรงไปตรงมา ชอบใช้ข้อมูลและตัวเลข..." className="mt-1" />
            </div>
            <div>
              <Label>ขอบเขตข้อมูล</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">ส่วนตัว — ข้อมูลของผู้ใช้เท่านั้น</SelectItem>
                  <SelectItem value="team">ทีม — ข้อมูลของทีมและสมาชิก</SelectItem>
                  <SelectItem value="admin">ผู้ดูแล — ข้อมูลทั้งหมดของ tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
