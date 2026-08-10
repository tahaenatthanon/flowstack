import { BookOpen, Search, Plus, FileText, Star, Clock, Loader2, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';

const CATEGORIES = ['ทั้งหมด', 'บัญชีผู้ใช้', 'การตั้งค่าระบบ', 'การใช้งาน', 'ทั่วไป'];

const EMPTY_FORM = { title: '', content: '', category: 'ทั่วไป', is_starred: false };

export default function KnowledgeBaseContent() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ทั้งหมด');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: articles = [], isLoading } = useQuery<any[]>({
    queryKey: ['knowledge-base'],
    queryFn: () => apiFetch('/knowledge-base.php'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof EMPTY_FORM) => apiFetch('/knowledge-base.php', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base'] }); toast({ title: 'เพิ่มบทความแล้ว' }); setDialogOpen(false); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: any) => apiFetch(`/knowledge-base.php?id=${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base'] }); toast({ title: 'บันทึกแล้ว' }); setDialogOpen(false); setEditing(null); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/knowledge-base.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['knowledge-base'] }); toast({ title: 'ลบบทความแล้ว' }); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const starMutation = useMutation({
    mutationFn: ({ id, is_starred }: { id: string; is_starred: boolean }) =>
      apiFetch(`/knowledge-base.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ is_starred }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge-base'] }),
  });

  const filtered = useMemo(() => articles.filter((a: any) => {
    const matchSearch = a.title?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = category === 'ทั้งหมด' || a.category === category;
    return matchSearch && matchCat;
  }), [articles, search, category]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit   = (a: any) => { setEditing(a); setForm({ title: a.title, content: a.content ?? '', category: a.category, is_starred: !!a.is_starred }); setDialogOpen(true); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, ...form });
    else createMutation.mutate(form);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">ฐานความรู้</h2>
          <p className="text-sm text-muted-foreground">บทความและคู่มือการใช้งาน</p>
        </div>
        <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" />เพิ่มบทความ</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">บทความทั้งหมด</p><p className="text-3xl font-bold text-primary">{articles.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">ยอดเข้าชมรวม</p><p className="text-3xl font-bold text-blue-500">{articles.reduce((s: number, a: any) => s + (a.views ?? 0), 0).toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">บทความแนะนำ</p><p className="text-3xl font-bold text-amber-500">{articles.filter((a: any) => a.is_starred).length}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาบทความ..." className="pl-8" />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${category === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border divide-y">
          {filtered.map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors group">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{a.title}</p>
                <p className="text-xs text-muted-foreground">{a.category}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => starMutation.mutate({ id: a.id, is_starred: !a.is_starred })}>
                  <Star className={`h-3.5 w-3.5 transition-colors ${a.is_starred ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40 hover:text-amber-400'}`} />
                </button>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{(a.views ?? 0).toLocaleString()} ครั้ง</span>
                <Badge variant="outline" className="text-xs">{a.category}</Badge>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={async () => { if (await confirm({ title: 'ลบบทความ', description: 'ลบบทความนี้?', variant: 'destructive' })) deleteMutation.mutate(a.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>ไม่พบบทความ</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขบทความ' : 'เพิ่มบทความใหม่'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>ชื่อบทความ <span className="text-destructive">*</span></Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="ชื่อบทความ..." />
            </div>
            <div className="space-y-1.5">
              <Label>หมวดหมู่</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter(c => c !== 'ทั้งหมด').map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>เนื้อหา</Label>
              <Textarea value={form.content} onChange={(e) => setForm(f => ({ ...f, content: e.target.value }))} rows={5} placeholder="เนื้อหาบทความ..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
              <Button type="submit" disabled={isPending}>{isPending ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
