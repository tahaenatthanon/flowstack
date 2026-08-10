import { Send, Plus, Search, Users, BarChart3, Calendar, CheckCircle2, Clock, AlertCircle, Loader2, Trash2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { safeFmt } from '@/lib/dateUtils';
import PullFromContentDialog from '@/components/content/dialogs/PullFromContentDialog';
import type { ContentItem } from '@/components/content/types';
import PageShell from '@/components/PageShell';

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  sending:   { label: 'กำลังส่ง',     color: 'bg-blue-100 text-blue-700',    icon: Send },
  sent:      { label: 'ส่งแล้ว',      color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  draft:     { label: 'ร่าง',         color: 'bg-gray-100 text-gray-600',    icon: Clock },
  scheduled: { label: 'ตั้งเวลาไว้',  color: 'bg-violet-100 text-violet-700', icon: Calendar },
  cancelled: { label: 'ยกเลิก',       color: 'bg-red-100 text-red-600',      icon: AlertCircle },
};

export default function CampaignsPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pullContentOpen, setPullContentOpen] = useState(false);

  const { data: campaigns = [], isLoading } = useQuery<any[]>({
    queryKey: ['campaigns'],
    queryFn: () => apiFetch('/email-campaigns.php'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/email-campaigns.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast({ title: 'ลบแคมเปญแล้ว' }); },
    onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  const filtered = useMemo(() =>
    campaigns.filter((c: any) => c.name?.toLowerCase().includes(search.toLowerCase())),
    [campaigns, search]
  );

  const totalSent   = campaigns.reduce((s: number, c: any) => s + (c.total_sent   ?? 0), 0);
  const totalOpens  = campaigns.reduce((s: number, c: any) => s + (c.total_opens  ?? 0), 0);
  const totalClicks = campaigns.reduce((s: number, c: any) => s + (c.total_clicks ?? 0), 0);

  return (
    <PageShell
      breadcrumbs={[{ label: 'การตลาด', href: '/marketing' }, { label: 'แคมเปญ', isCurrent: true }]}
      title="แคมเปญ"
      description="จัดการและติดตามแคมเปญอีเมล"
      actions={
        <>
          <Button variant="outline" className="gap-2" onClick={() => setPullContentOpen(true)}>
            <FileText className="h-4 w-4" />ดึงจาก Content
          </Button>
          <Button className="gap-2" onClick={() => navigate('/marketing')}>
            <Plus className="h-4 w-4" />สร้างแคมเปญ
          </Button>
        </>
      }
    >

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">แคมเปญทั้งหมด</p><p className="text-3xl font-bold text-primary">{campaigns.length}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">ส่งทั้งหมด</p><p className="text-3xl font-bold text-blue-500">{totalSent.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">อ่านแล้ว</p><p className="text-3xl font-bold text-green-500">{totalOpens.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-xs text-muted-foreground mb-1">คลิก</p><p className="text-3xl font-bold text-amber-500">{totalClicks.toLocaleString()}</p></CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาแคมเปญ..." className="pl-8" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-lg border divide-y">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>{search ? 'ไม่พบแคมเปญที่ค้นหา' : 'ยังไม่มีแคมเปญ'}</p>
            </div>
          )}
          {filtered.map((c: any) => {
            const s = STATUS_MAP[c.status] ?? STATUS_MAP.draft;
            const SIcon = s.icon;
            const openRate = (c.total_sent ?? 0) > 0 ? Math.round((c.total_opens ?? 0) / c.total_sent * 100) : 0;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-4 hover:bg-muted/30 transition-colors group">
                <Send className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate('/marketing')}>
                  <p className="font-medium text-sm">{c.name}</p>
                  <div className="flex flex-wrap gap-4 mt-1 text-xs text-muted-foreground">
                    {(c.total_sent ?? 0) > 0 && <>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{(c.total_sent).toLocaleString()} ส่ง</span>
                      <span className="flex items-center gap-1"><BarChart3 className="h-3 w-3" />Open {openRate}%</span>
                      <span>{c.total_clicks ?? 0} คลิก</span>
                    </>}
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{safeFmt(c.sent_at ?? c.created_at)}</span>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${s.color}`}>
                  <SIcon className="h-3 w-3" />{s.label}
                </span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={async () => { if (await confirm({ title: 'ลบแคมเปญ', description: 'ลบแคมเปญนี้?', variant: 'destructive' })) deleteMutation.mutate(c.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <PullFromContentDialog
        open={pullContentOpen}
        onOpenChange={setPullContentOpen}
        onSelect={(content: ContentItem) => {
          navigate('/marketing', { state: { fromContent: content } });
        }}
      />
    </PageShell>
  );
}
