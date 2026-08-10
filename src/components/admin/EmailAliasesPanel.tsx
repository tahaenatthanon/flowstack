import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Plus, Trash2, Mail, Loader2 } from 'lucide-react';

interface Alias {
  id: string;
  user_id: string;
  alias_email: string;
  label: string;
  created_at: string;
}

export function EmailAliasesPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [aliasEmail, setAliasEmail] = useState('');
  const [aliasLabel, setAliasLabel] = useState('');

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => apiFetch<{ id: string; email: string; display_name: string }[]>('/users.php'),
  });

  const { data: aliases = [], isLoading } = useQuery({
    queryKey: ['email-aliases', selectedUser],
    queryFn: () => apiFetch<Alias[]>(`/email-aliases.php?user_id=${selectedUser}`),
    enabled: !!selectedUser,
  });

  const createMut = useMutation({
    mutationFn: (data: { user_id: string; alias_email: string; label: string }) =>
      apiFetch('/email-aliases.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-aliases', selectedUser] });
      toast({ title: 'เพิ่ม Alias สำเร็จ' });
      setAliasEmail('');
      setAliasLabel('');
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/email-aliases.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-aliases', selectedUser] });
      toast({ title: 'ลบ Alias สำเร็จ' });
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const selectedUserObj = users.find((u) => u.id === selectedUser);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">จัดการ Email Alias</h3>
        <p className="text-sm text-muted-foreground">เพิ่มอีเมลสำรองให้ผู้ใช้สำหรับรับอีเมลแคมเปญ</p>
      </div>

      <div className="flex items-end gap-4">
        <div className="grid gap-2 flex-1">
          <Label>เลือกผู้ใช้</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger><SelectValue placeholder="เลือกผู้ใช้..." /></SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedUser && (
        <>
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                อีเมลหลัก: <span className="font-medium text-foreground">{selectedUserObj?.email}</span>
              </div>
              <div className="flex items-end gap-3">
                <div className="grid gap-1 flex-1">
                  <Label className="text-xs">Alias Email</Label>
                  <Input type="email" placeholder="alias@example.com" value={aliasEmail}
                    onChange={(e) => setAliasEmail(e.target.value)} />
                </div>
                <div className="grid gap-1 w-48">
                  <Label className="text-xs">ป้ายกำกับ</Label>
                  <Input placeholder="อีเมลส่วนตัว" value={aliasLabel}
                    onChange={(e) => setAliasLabel(e.target.value)} />
                </div>
                <Button onClick={() => createMut.mutate({ user_id: selectedUser, alias_email: aliasEmail, label: aliasLabel })}
                  disabled={!aliasEmail || createMut.isPending}>
                  {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  เพิ่ม
                </Button>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : aliases.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มี Email Alias</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias Email</TableHead>
                  <TableHead>ป้ายกำกับ</TableHead>
                  <TableHead>วันที่เพิ่ม</TableHead>
                  <TableHead className="w-20">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliases.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.alias_email}</TableCell>
                    <TableCell><Badge variant="outline">{a.label || '-'}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString('th-TH') : '-'}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={async () => { if (await confirm({ title: 'ลบ Alias', description: 'ยืนยันลบ?', variant: 'destructive' })) deleteMut.mutate(a.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

export default EmailAliasesPanel;
