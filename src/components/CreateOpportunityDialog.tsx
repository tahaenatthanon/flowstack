import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateOpportunity, useCustomers, useUsers, useAddOpportunityMember } from '@/hooks/useProjectData';
import { useEmailCampaigns } from '@/hooks/useMarketing';
import CompanyCombobox from '@/components/CompanyCombobox';
import LeadSourceCombobox from '@/components/LeadSourceCombobox';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { STAGE_LABELS, ROLE_LABELS } from '@/lib/labels';
import { Plus, Loader2, Users, User, X, ChevronDown, UserCheck } from 'lucide-react';
import { format, addDays } from 'date-fns';

const opportunitySchema = z.object({
  company_id: z.string().min(1, 'กรุณาเลือกบริษัท'),
  name: z.string().min(1, 'กรุณาระบุชื่อโอกาสการขาย'),
  description: z.string().optional(),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']),
  value: z.number().min(0),
  probability: z.number().min(0).max(100),
  expected_close_date: z.string().optional(),
  assigned_to: z.string().min(1, 'กรุณาเลือกผู้รับผิดชอบ'),
  lead_source: z.string().optional(),
  notes: z.string().optional(),
});

type OpportunityFormData = z.infer<typeof opportunitySchema>;

export function CreateOpportunityDialog() {
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [selectedMembers, setSelectedMembers] = useState<{ userId: string; role: string; display_name: string }[]>([]);

  const createOpportunity = useCreateOpportunity();
  const addOpportunityMember = useAddOpportunityMember();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { user } = useAuth();
  const { toast } = useToast();

  const [customerId, setCustomerId] = useState('none');
  const [campaignId, setCampaignId] = useState('__none__');
  const { data: campaigns = [] } = useEmailCampaigns();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } =
    useForm<OpportunityFormData>({
      resolver: zodResolver(opportunitySchema),
      defaultValues: {
        stage: 'lead', value: 0, probability: 0, description: '', lead_source: '', notes: '',
        expected_close_date: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
      },
    });

  const { data: customers = [] } = useCustomers(watch('company_id') || undefined, true);
  const selectedStage = watch('stage');

  const selectedMemberIds = selectedMembers.map(m => m.userId);
  const availableUsers = users.filter((u: any) => !selectedMemberIds.includes(u.id) && u.id !== watch('assigned_to'));

  const handleAddMember = () => {
    if (!newMemberId) return;
    const u = users.find((u: any) => u.id === newMemberId);
    if (u) {
      setSelectedMembers([...selectedMembers, { userId: newMemberId, role: newMemberRole, display_name: u.display_name }]);
      setNewMemberId(''); setNewMemberRole('member');
    }
  };

  const onSubmit = async (data: OpportunityFormData) => {
    try {
      const result = await createOpportunity.mutateAsync({
        ...data,
        customer_id: customerId !== 'none' ? customerId : undefined,
        campaign_id: campaignId !== '__none__' ? campaignId : undefined,
      });
      const opportunityId = result?.id;
      if (opportunityId) {
        for (const m of selectedMembers) {
          try { await addOpportunityMember.mutateAsync({ opportunityId, userId: m.userId, role: m.role }); } catch { /* ok */ }
        }
      }
      toast({ title: 'สร้างโอกาสการขายสำเร็จ' });
      setOpen(false); resetForm();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    reset(); setSelectedMembers([]); setNewMemberId(''); setNewMemberRole('member');
    setCampaignId('__none__'); setCustomerId('none'); setAdvancedOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" />เพิ่มโอกาสการขาย</Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">สร้างโอกาสการขายใหม่</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          {/* ชื่อ */}
          <div>
            <Label>ชื่อโอกาสการขาย *</Label>
            <Input placeholder="เช่น ระบบ CRM สำหรับทีมขาย" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name.message}</p>}
          </div>

          {/* บริษัท | ผู้ติดต่อ | ผู้รับผิดชอบ PM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>บริษัท *</Label>
              <CompanyCombobox
                value={watch('company_id') || ''}
                onChange={(id) => { setValue('company_id', id); setCustomerId('none'); }}
                placeholder="เลือกบริษัท"
              />
              {errors.company_id && <p className="text-xs text-red-500 mt-0.5">{errors.company_id.message}</p>}
            </div>
            <div>
              <Label>ผู้ติดต่อ</Label>
              <Select value={customerId} onValueChange={setCustomerId} disabled={!watch('company_id')}>
                <SelectTrigger>
                  <SelectValue placeholder={watch('company_id') ? 'เลือกผู้ติดต่อ' : 'เลือกบริษัทก่อน'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}{Number(c.is_primary_contact) === 1 ? ' ★' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ผู้รับผิดชอบ (PM) *</Label>
              {usersLoading ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />กำลังโหลด...
                </div>
              ) : (
                <Select value={watch('assigned_to') || ''} onValueChange={(v) => setValue('assigned_to', v)}>
                  <SelectTrigger><SelectValue placeholder="เลือก PM" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.assigned_to && <p className="text-xs text-red-500 mt-0.5">{errors.assigned_to.message}</p>}
            </div>
          </div>

          {/* ขั้นตอน | มูลค่า | วันที่คาดปิดดีล */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>ขั้นตอน</Label>
              <Select value={selectedStage} onValueChange={(v) => setValue('stage', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STAGE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>มูลค่า (บาท)</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00"
                {...register('value', { valueAsNumber: true })} />
            </div>
            <div>
              <Label>คาดปิดดีล</Label>
              <Input type="date" {...register('expected_close_date')} />
            </div>
          </div>

          {/* แหล่งที่มา | ผู้หา Lead */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>แหล่งที่มา</Label>
              <LeadSourceCombobox value={watch('lead_source') ?? ''} onChange={(v) => setValue('lead_source', v)} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><UserCheck className="h-3.5 w-3.5 text-blue-500" />ผู้หา Lead (BD)</Label>
              <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 h-9 mt-1">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">{user?.display_name || user?.email || '—'}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">อัตโนมัติ</span>
              </div>
            </div>
          </div>

          {/* รายละเอียด */}
          <div>
            <Label>รายละเอียด</Label>
            <Textarea placeholder="รายละเอียดของโอกาสการขาย" rows={2} {...register('description')} />
          </div>

          {/* ลูกทีม */}
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" /><Label className="text-sm font-medium">ลูกทีม</Label>
            </div>
            {selectedMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground">ยังไม่มีสมาชิกทีม</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedMembers.map((m) => (
                  <div key={m.userId} className="inline-flex items-center gap-1 bg-muted/40 rounded-full px-2 py-1 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{m.display_name}</span>
                    {m.role === 'lead' && <span className="text-muted-foreground text-[10px]">(หัวหน้า)</span>}
                    <Button type="button" variant="ghost" size="icon" className="h-4 w-4 text-destructive hover:bg-destructive/10"
                      onClick={() => setSelectedMembers(selectedMembers.filter(x => x.userId !== m.userId))}>
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Select value={newMemberId} onValueChange={setNewMemberId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="เลือกผู้ใช้" /></SelectTrigger>
                <SelectContent>
                  {availableUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.display_name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={handleAddMember} disabled={!newMemberId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ส่วนหุบ: ความน่าจะเป็น, Campaign, บันทึก */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center justify-between rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-muted/40 transition-colors">
                <span>ข้อมูลเพิ่มเติม (ความน่าจะเป็น, Campaign, บันทึก)</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>โอกาสความสำเร็จ (%)</Label>
                  <Input type="number" min="0" max="100" placeholder="0"
                    {...register('probability', { valueAsNumber: true })} />
                </div>
                <div>
                  <Label>Campaign</Label>
                  <Select value={campaignId} onValueChange={setCampaignId}>
                    <SelectTrigger><SelectValue placeholder="— ไม่ระบุ —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                      {(campaigns as any[]).filter(c => c.status === 'sent').map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>บันทึกเพิ่มเติม</Label>
                <Textarea placeholder="หมายเหตุหรือข้อมูลเพิ่มเติม" rows={2} {...register('notes')} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" className="px-8" disabled={createOpportunity.isPending}>
              {createOpportunity.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              สร้างโอกาสการขาย
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
