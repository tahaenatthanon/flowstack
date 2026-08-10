import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, X, Activity, Mail } from 'lucide-react';

interface CustomerActivity {
  id: string;
  customer_id: string | null;
  activity_type: string;
  reference_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
}

const CA_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'email_sent',       label: 'ส่งอีเมล',        color: 'bg-blue-100 text-blue-700' },
  { value: 'email_opened',     label: 'เปิดอีเมล',        color: 'bg-green-100 text-green-700' },
  { value: 'email_clicked',    label: 'คลิกลิงก์',        color: 'bg-purple-100 text-purple-700' },
  { value: 'email_replied',    label: 'ตอบกลับ',          color: 'bg-teal-100 text-teal-700' },
  { value: 'email_bounced',    label: 'อีเมลตีกลับ',      color: 'bg-red-100 text-red-700' },
  { value: 'campaign_created', label: 'สร้างแคมเปญ',      color: 'bg-yellow-100 text-yellow-700' },
  { value: 'group_added',      label: 'เพิ่มเข้ากลุ่ม',  color: 'bg-slate-100 text-slate-700' },
];

export function AllActivitiesTab({ companies }: { companies: any[] }) {
  const [filterType, setFilterType]         = useState('__none__');
  const [filterCompany, setFilterCompany]   = useState('__none__');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo]     = useState('');

  // Email preview dialog
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [emailPreviewSubject, setEmailPreviewSubject] = useState('');
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);

  const params = new URLSearchParams();
  if (filterType !== '__none__')    params.set('type', filterType);
  if (filterDateFrom)               params.set('date_from', filterDateFrom);
  if (filterDateTo)                 params.set('date_to', filterDateTo);
  params.set('limit', '200');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-activities-all', filterType, filterDateFrom, filterDateTo],
    queryFn: () => apiFetch<{ activities: CustomerActivity[]; total: number }>(`/customer-activities.php?${params}`),
  });

  const allActivities: CustomerActivity[] = data?.activities ?? [];

  // filter by company via company_name since API returns it; sort by created_at desc
  const filteredFinal = useMemo(() => {
    let list = allActivities;
    if (filterCompany !== '__none__') {
      const co = companies.find((c) => c.id === filterCompany);
      if (co) list = list.filter((a) => a.company_name === co.name);
    }
    return [...list].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [allActivities, filterCompany, companies]);

  const hasFilter = filterType !== '__none__' || filterCompany !== '__none__' || filterDateFrom || filterDateTo;

  function getBadge(type: string) {
    return CA_TYPES.find((t) => t.value === type) ?? { label: type, color: 'bg-gray-100 text-gray-700' };
  }

  function getDetails(act: CustomerActivity): string {
    if (!act.details) return '';
    const d = act.details;
    if (d.campaign_name) return `แคมเปญ: ${d.campaign_name}`;
    if (d.group_id) return `กลุ่ม: ${d.group_id}`;
    return JSON.stringify(d);
  }

  const openEmailPreview = async (act: CustomerActivity) => {
    if (!act.details?.campaign_id) return;
    setEmailPreviewSubject(String(act.details.campaign_name ?? ''));
    setEmailPreviewHtml('');
    setEmailPreviewLoading(true);
    setEmailPreviewOpen(true);
    try {
      const data = await apiFetch<{ campaign: any }>(`/email-campaigns.php?action=recipients&id=${act.details.campaign_id}`);
      setEmailPreviewHtml(data?.campaign?.body_html ?? '');
    } catch {
      setEmailPreviewHtml('<p style="color:red">โหลดอีเมลไม่สำเร็จ</p>');
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">ประเภทกิจกรรม</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">ทั้งหมด</SelectItem>
              {CA_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">บริษัท</span>
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-48 h-9 text-sm"><SelectValue placeholder="ทั้งหมด" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">ทั้งหมด</SelectItem>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">ตั้งแต่วันที่</span>
          <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-9 text-sm w-36" />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">ถึงวันที่</span>
          <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-9 text-sm w-36" />
        </div>

        {hasFilter && (
          <Button variant="ghost" size="sm" className="h-9 self-end text-muted-foreground"
            onClick={() => { setFilterType('__none__'); setFilterCompany('__none__'); setFilterDateFrom(''); setFilterDateTo(''); }}>
            <X className="h-4 w-4 mr-1" /> ล้างตัวกรอง
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        แสดง {filteredFinal.length} รายการ
        {data && filteredFinal.length !== data.total && ` (จากทั้งหมด ${data.total})`}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredFinal.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">ไม่พบกิจกรรม</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredFinal.map((act) => {
            const badge = getBadge(act.activity_type);
            const name = [act.first_name, act.last_name].filter(Boolean).join(' ') || act.email || '-';
            const detail = getDetails(act);
            return (
              <Card key={act.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Badge className={`shrink-0 mt-0.5 ${badge.color}`}>{badge.label}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{name}</span>
                        {act.company_name && (
                          <Badge variant="outline" className="text-xs">{act.company_name}</Badge>
                        )}
                        {act.email && act.email !== name && (
                          <span className="text-xs text-muted-foreground">{act.email}</span>
                        )}
                      </div>
                      {detail && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{detail}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {new Date(act.created_at).toLocaleDateString('th-TH', {
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                        {['email_sent', 'email_opened', 'email_clicked'].includes(act.activity_type) && act.details?.campaign_id && (
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
                            onClick={() => openEmailPreview(act)}>
                            <Mail className="w-3 h-3 mr-1" />ดูอีเมล
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Email Preview Dialog */}
      <Dialog open={emailPreviewOpen} onOpenChange={setEmailPreviewOpen}>
        <DialogContent className="w-full sm:max-w-3xl w-full sm:max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              ดูตัวอย่างอีเมล — {emailPreviewSubject}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md min-h-[400px]">
            {emailPreviewLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : emailPreviewHtml ? (
              <iframe
                srcDoc={emailPreviewHtml}
                className="w-full h-full min-h-[400px]"
                sandbox="allow-same-origin"
                title="Email preview"
              />
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">ไม่มีเนื้อหาอีเมล</div>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEmailPreviewOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}