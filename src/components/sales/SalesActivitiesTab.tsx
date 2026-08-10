import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, X, Activity, Pencil, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import OpportunityCombobox from '@/components/OpportunityCombobox';

interface SalesActivity {
  id: string;
  opportunity_id: string;
  activity_type: string;
  subject: string;
  description: string | null;
  activity_date: string;
  created_by: string;
  created_by_name: string | null;
}

const ACT_TYPES: { value: string; label: string }[] = [
  { value: 'call', label: 'โทรศัพท์' },
  { value: 'email', label: 'อีเมล' },
  { value: 'meeting', label: 'ประชุม' },
  { value: 'note', label: 'บันทึก' },
  { value: 'proposal_sent', label: 'ส่งข้อเสนอ' },
  { value: 'quotation_sent', label: 'ส่งใบเสนอราคา' },
  { value: 'follow_up', label: 'ติดตาม' },
  { value: 'other', label: 'อื่นๆ' },
];

export function SalesActivitiesTab({
  opportunities,
  companies,
  users,
}: {
  opportunities: any[];
  companies: any[];
  users: any[];
}) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [filterOppId, setFilterOppId] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formType, setFormType] = useState('call');
  const [formSubject, setFormSubject] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [formOppId, setFormOppId] = useState('');
  const [dialogVersion, setDialogVersion] = useState(0);

  // Fetch activities for selected opportunity
  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ['sales-activities', filterOppId],
    queryFn: () => apiFetch<SalesActivity[]>(`/sales-activities.php?opportunity_id=${filterOppId}`),
    enabled: !!filterOppId,
  });

  // Fetch ALL activities across all opportunities
  const { data: allActivities = [], isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['sales-activities-all'],
    queryFn: () => apiFetch<SalesActivity[]>('/sales-activities.php'),
    enabled: !filterOppId,
  });

  const displayActivities = filterOppId ? activities : allActivities;

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch('/sales-activities.php', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      if (filterOppId) refetch(); else refetchAll();
      toast({ title: 'เพิ่มกิจกรรมสำเร็จ' });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      apiFetch(`/sales-activities.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      if (filterOppId) refetch(); else refetchAll();
      toast({ title: 'แก้ไขกิจกรรมสำเร็จ' });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiFetch(`/sales-activities.php?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      if (filterOppId) refetch(); else refetchAll();
      toast({ title: 'ลบกิจกรรมสำเร็จ' });
    },
    onError: (err: Error) => toast({ title: 'ผิดพลาด', description: err.message, variant: 'destructive' }),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditId(null);
    setFormType('call');
    setFormSubject('');
    setFormDesc('');
    setFormDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setFormOppId('');
  }

  function openCreate() {
    setEditId(null);
    setFormType('call');
    setFormSubject('');
    setFormDesc('');
    setFormDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setFormOppId(filterOppId);
    setDialogVersion(v => v + 1);
    setDialogOpen(true);
  }

  function toDatetimeLocal(dbDate: string | null): string {
    if (!dbDate) return '';
    const d = new Date(dbDate.replace(' ', 'T'));
    return isNaN(d.getTime()) ? '' : format(d, "yyyy-MM-dd'T'HH:mm");
  }

  function openEdit(act: SalesActivity) {
    setEditId(act.id);
    setFormType(act.activity_type);
    setFormSubject(act.subject);
    setFormDesc(act.description ?? '');
    setFormDate(toDatetimeLocal(act.activity_date));
    setFormOppId(act.opportunity_id);
    setDialogVersion(v => v + 1);
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formSubject || !formOppId) {
      toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' });
      return;
    }
    const payload = {
      opportunity_id: formOppId,
      activity_type: formType,
      subject: formSubject,
      description: formDesc,
      activity_date: formDate ? formDate.replace('T', ' ') + ':00' : format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    };
    if (editId) updateMut.mutate({ id: editId, data: payload });
    else createMut.mutate(payload);
  }

  function getOppName(oppId: string) {
    const opp = opportunities.find((o) => o.opportunity_id === oppId);
    return opp?.opportunity_name ?? '-';
  }

  function getTypeLabel(type: string) {
    return ACT_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  function getTypeBadgeColor(type: string) {
    const colors: Record<string, string> = {
      call: 'bg-blue-100 text-blue-700',
      email: 'bg-purple-100 text-purple-700',
      meeting: 'bg-green-100 text-green-700',
      note: 'bg-gray-100 text-gray-700',
      proposal_sent: 'bg-yellow-100 text-yellow-700',
      quotation_sent: 'bg-amber-100 text-amber-700',
      follow_up: 'bg-orange-100 text-orange-700',
      other: 'bg-slate-100 text-slate-700',
    };
    return colors[type] ?? 'bg-gray-100 text-gray-700';
  }

  const [filterType, setFilterType] = useState('__none__');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const filteredActivities = useMemo(() => {
    let list = displayActivities;
    if (filterType !== '__none__') list = list.filter((a) => a.activity_type === filterType);
    if (filterDateFrom) list = list.filter((a) => a.activity_date >= filterDateFrom);
    if (filterDateTo) {
      const toEnd = filterDateTo + 'T23:59:59';
      list = list.filter((a) => a.activity_date <= toEnd);
    }
    return [...list].sort((a, b) =>
      new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime()
    );
  }, [displayActivities, filterType, filterDateFrom, filterDateTo]);

  const hasFilter = filterType !== '__none__' || filterDateFrom || filterDateTo;

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
        {/* โอกาสการขาย */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">โอกาสการขาย</span>
          <OpportunityCombobox
            value={filterOppId || ''}
            onChange={(id) => setFilterOppId(id)}
            placeholder="ทั้งหมด"
            allowNone={true}
          />
        </div>

        {/* ประเภทกิจกรรม */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">ประเภทกิจกรรม</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="ทั้งหมด" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">ทั้งหมด</SelectItem>
              {ACT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* วันที่เริ่มต้น */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">ตั้งแต่วันที่</span>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="h-9 text-sm w-36"
          />
        </div>

        {/* วันที่สิ้นสุด */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">ถึงวันที่</span>
          <Input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="h-9 text-sm w-36"
          />
        </div>

        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 self-end text-muted-foreground"
            onClick={() => { setFilterType('__none__'); setFilterDateFrom(''); setFilterDateTo(''); setFilterOppId(''); }}
          >
            <X className="h-4 w-4 mr-1" /> ล้างตัวกรอง
          </Button>
        )}

        <div className="sm:ml-auto self-end">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> เพิ่มกิจกรรม
          </Button>
        </div>
      </div>

      {/* Result count */}
      <p className="text-sm text-muted-foreground">
        แสดง {filteredActivities.length} รายการ
        {displayActivities.length !== filteredActivities.length && ` (จากทั้งหมด ${displayActivities.length})`}
      </p>

      {/* Activities List */}
      {(filterOppId ? isLoading : allLoading) ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">ไม่พบกิจกรรม</p>
            <p className="text-sm text-muted-foreground mt-1">ลองเปลี่ยนตัวกรองหรือกด "เพิ่มกิจกรรม"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredActivities.map((act) => (
            <Card key={act.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Badge className={`shrink-0 mt-0.5 ${getTypeBadgeColor(act.activity_type)}`}>
                    {getTypeLabel(act.activity_type)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{act.subject}</span>
                      {!filterOppId && (
                        <Badge variant="outline" className="text-xs">
                          {getOppName(act.opportunity_id)}
                        </Badge>
                      )}
                    </div>
                    {act.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{act.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>
                        {act.activity_date
                          ? new Date(act.activity_date).toLocaleDateString('th-TH', {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })
                          : '-'}
                      </span>
                      {act.created_by_name && <span>โดย {act.created_by_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(act)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={async () => { if (await confirm({ title: 'ลบกิจกรรม', description: 'ยืนยันลบกิจกรรม?', variant: 'destructive' })) deleteMut.mutate(act.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Activity Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรม'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>โอกาสการขาย *</Label>
              <OpportunityCombobox
                value={formOppId}
                onChange={setFormOppId}
                placeholder="เลือกโอกาสการขาย"
                allowNone={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>ประเภท</Label>
                <Select key={`type-${dialogVersion}`} value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>วันที่</Label>
                <Input type="datetime-local" value={formDate}
                  onChange={(e) => setFormDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>หัวข้อ *</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)}
                placeholder="เช่น โทรติดตามลูกค้า" />
            </div>
            <div className="grid gap-2">
              <Label>รายละเอียด</Label>
              <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)}
                rows={3} placeholder="รายละเอียดเพิ่มเติม..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>ยกเลิก</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending || !formSubject || !formOppId}>
              {(createMut.isPending || updateMut.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editId ? 'บันทึก' : 'เพิ่มกิจกรรม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}