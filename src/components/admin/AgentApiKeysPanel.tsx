import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Plus, Trash2, Key, Copy, Check, Power, PowerOff, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  permissions: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  user_display_name?: string;
  user_email?: string;
}

function fmt(d?: string | null) {
  if (!d) return '-';
  try { return format(new Date(d), 'd MMM yyyy HH:mm', { locale: th }); } catch { return d; }
}

export function AgentApiKeysPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['agent-api-keys'],
    queryFn: () => apiFetch<ApiKey[]>('/agent-keys.php'),
  });

  const qInv = () => qc.invalidateQueries({ queryKey: ['agent-api-keys'] });

  const createMut = useMutation({
    mutationFn: (data: { name: string; expires_at?: string }) =>
      apiFetch<{ key: string; id: string }>('/agent-keys.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (data) => {
      setPlainKey(data.key);
      qInv();
      toast({ title: 'สร้าง API key สำเร็จ' });
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: number }) =>
      apiFetch(`/agent-keys.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ is_active }) }),
    onSuccess: () => { qInv(); toast({ title: 'อัปเดตสถานะ key สำเร็จ' }); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/agent-keys.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qInv(); toast({ title: 'ลบ key สำเร็จ' }); },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) { toast({ title: 'กรุณาระบุชื่อ key', variant: 'destructive' }); return; }
    createMut.mutate({ name: newKeyName.trim(), expires_at: newKeyExpiry || undefined });
  };

  const handleCopy = async () => {
    if (!plainKey) return;
    await navigator.clipboard.writeText(plainKey);
    setCopied(true);
    toast({ title: 'คัดลอก API key แล้ว' });
    setTimeout(() => setCopied(false), 3000);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setNewKeyName('');
    setNewKeyExpiry('');
    setPlainKey(null);
    setCopied(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">จัดการ Agent API Keys</h3>
          <p className="text-sm text-muted-foreground">
            สำหรับ AI Agent (n8n, Make, Claude, สคริปต์) ใช้ยืนยันตัวตนและเรียก API
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={createMut.isPending}>
          <Plus className="h-4 w-4 mr-1" />สร้าง API Key
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              ยังไม่มี API Key — สร้าง key แรกเพื่อเริ่มใช้งาน
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>Key Prefix</TableHead>
                  <TableHead>ผู้ใช้</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>ใช้งานล่าสุด</TableHead>
                  <TableHead>หมดอายุ</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{k.key_prefix}...</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {k.user_display_name || k.user_email || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={k.is_active ? 'default' : 'secondary'} className={k.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {k.is_active ? 'ใช้งาน' : 'ระงับ'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(k.last_used_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {k.expires_at ? (
                        new Date(k.expires_at) < new Date()
                          ? <Badge variant="destructive" className="text-xs">หมดอายุ {fmt(k.expires_at)}</Badge>
                          : fmt(k.expires_at)
                      ) : 'ไม่หมดอายุ'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => toggleMut.mutate({ id: k.id, is_active: k.is_active ? 0 : 1 })}
                          title={k.is_active ? 'ระงับ' : 'เปิดใช้งาน'}
                        >
                          {k.is_active ? <PowerOff className="h-3.5 w-3.5 text-yellow-600" /> : <Power className="h-3.5 w-3.5 text-green-600" />}
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                          onClick={async () => {
                            if (!await confirm({ title: 'ลบ API Key', description: `ต้องการลบ "${k.name}" หรือไม่? การทำงานนี้ไม่สามารถย้อนกลับได้`, variant: 'destructive' })) return;
                            deleteMut.mutate(k.id);
                          }}
                          title="ลบ"
                        >
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

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{plainKey ? 'สร้าง API Key สำเร็จ' : 'สร้าง API Key'}</DialogTitle>
          </DialogHeader>

          {plainKey ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-sm text-green-800 font-semibold mb-2">คัดลอก key นี้ — จะแสดงเพียงครั้งเดียว</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border rounded px-3 py-2 text-xs font-mono break-all select-all">{plainKey}</code>
                  <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={closeCreate}>ปิด</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>ชื่อ Key</Label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="เช่น n8n-production, claude-script"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>วันหมดอายุ (ไม่บังคับ)</Label>
                <Input
                  type="datetime-local"
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                  className="mt-1"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeCreate}>ยกเลิก</Button>
                <Button onClick={handleCreate} disabled={createMut.isPending}>
                  {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Key className="h-4 w-4 mr-1" />}
                  สร้าง
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
