import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateProject, useCustomers, useUsers, useAddProjectMember } from '@/hooks/useProjectData';
import CompanyCombobox from '@/components/CompanyCombobox';
import OpportunityCombobox from '@/components/OpportunityCombobox';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, User, Users, X, AlertCircle } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'on-track', label: '🟢 ตามแผน' },
  { value: 'at-risk',  label: '🟡 มีความเสี่ยง' },
  { value: 'delayed',  label: '🔴 ล่าช้า' },
  { value: 'completed',label: '✅ เสร็จแล้ว' },
];

const ROLE_OPTIONS = [
  { value: 'member', label: 'สมาชิก' },
  { value: 'lead',   label: 'หัวหน้าทีม' },
];

function Required() {
  return <span className="text-destructive ml-0.5">*</span>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

const CreateProjectDialog = () => {
  const [open, setOpen] = useState(false);

  // ฟิลด์หลัก
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [status,      setStatus]      = useState('on-track');
  const [startDate,   setStartDate]   = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate,     setEndDate]     = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));

  // ฟิลด์ขั้นสูง
  const [companyId,     setCompanyId]     = useState<string>('none');
  const [customerId,    setCustomerId]    = useState<string>('none');
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  const [ownerId,       setOwnerId]       = useState<string>('');
  const [managerId,     setManagerId]     = useState<string>('none');
  const [budgetHours,   setBudgetHours]   = useState<string>('');
  const [hourlyRate,    setHourlyRate]    = useState<string>('');

  // สมาชิกทีม
  const [newMemberId,   setNewMemberId]   = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<string>('member');
  const [selectedMembers, setSelectedMembers] = useState<{ userId: string; role: string; display_name: string }[]>([]);

  // errors
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const createProject = useCreateProject();
  const addMember     = useAddProjectMember();
  const { toast }     = useToast();
  const { user }      = useAuth();

  const { data: customers = [] } = useCustomers(companyId !== 'none' ? companyId : undefined, true);
  const { data: users = [] }     = useUsers(true);

  const selectedMemberUserIds = useMemo(
    () => new Set(selectedMembers.map((m) => m.userId)),
    [selectedMembers]
  );

  const availableUsersForMember = useMemo(() => {
    const currentOwnerId = ownerId || user?.id;
    return users.filter((u: any) => !selectedMemberUserIds.has(u.id) && u.id !== currentOwnerId);
  }, [users, selectedMemberUserIds, ownerId, user]);

  const handleAddMember = () => {
    if (!newMemberId) return;
    const found = users.find((u: any) => u.id === newMemberId);
    if (found) {
      setSelectedMembers([...selectedMembers, { userId: newMemberId, role: newMemberRole, display_name: found.display_name }]);
      setNewMemberId('');
      setNewMemberRole('member');
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'กรุณาระบุชื่อโครงการ';
    if (!startDate) errs.startDate = 'กรุณาระบุวันเริ่มต้น';
    if (!endDate) errs.endDate = 'กรุณาระบุวันสิ้นสุด';
    if (endDate && startDate && endDate < startDate) errs.endDate = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const resetForm = () => {
    setName(''); setDescription(''); setStatus('on-track');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
    setCompanyId('none'); setCustomerId('none'); setOpportunityId(null);
    setOwnerId(''); setManagerId('none'); setNewMemberId(''); setNewMemberRole('member');
    setSelectedMembers([]); setBudgetHours(''); setHourlyRate('');
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      const result = await createProject.mutateAsync({
        name: name.trim(),
        description,
        status,
        start_date: startDate,
        end_date: endDate,
        company_id: companyId !== 'none' ? companyId : null,
        customer_id: customerId !== 'none' ? customerId : null,
        opportunity_id: opportunityId ?? null,
        user_id: ownerId || user?.id,
        manager_id: managerId !== 'none' ? managerId : null,
        budget_hours: budgetHours ? parseFloat(budgetHours) : null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
      });

      const projectId = result?.id;
      const failedMembers: string[] = [];
      if (projectId) {
        for (const member of selectedMembers) {
          try {
            await addMember.mutateAsync({ projectId, userId: member.userId, role: member.role });
          } catch {
            failedMembers.push(member.display_name);
          }
        }
      }

      if (failedMembers.length > 0) {
        toast({ title: 'สร้างโครงการสำเร็จ', description: `เพิ่มสมาชิกไม่สำเร็จ: ${failedMembers.join(', ')}`, variant: 'destructive' });
      } else {
        toast({ title: 'สร้างโครงการสำเร็จ' });
      }
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          สร้างโครงการใหม่
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">สร้างโครงการใหม่</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">

          {/* ── ชื่อโครงการ ── */}
          <div className="space-y-1.5">
            <Label className="text-sm">ชื่อโครงการ<Required /></Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((err) => ({ ...err, name: undefined })); }}
              onBlur={() => { if (!name.trim()) setErrors((e) => ({ ...e, name: 'กรุณาระบุชื่อโครงการ' })); }}
              placeholder="เช่น โปรเจกต์พัฒนาเว็บไซต์"
              className={cn(errors.name && 'border-destructive')}
              autoFocus
            />
            <FieldError message={errors.name} />
          </div>

          {/* ── รายละเอียด ── */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              รายละเอียด
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">(ไม่จำเป็น)</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="อธิบายวัตถุประสงค์และขอบเขตของโครงการ"
              rows={2}
              className="text-sm"
            />
          </div>

          {/* ── บริษัท + ผู้ติดต่อ ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">บริษัทลูกค้า</Label>
              <CompanyCombobox
                value={companyId}
                onChange={(id) => { setCompanyId(id); setCustomerId('none'); }}
                placeholder="เลือกบริษัท"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">ผู้ติดต่อ</Label>
              <Select value={customerId} onValueChange={setCustomerId} disabled={companyId === 'none'}>
                <SelectTrigger className="h-9 text-sm bg-background">
                  <SelectValue placeholder={companyId !== 'none' ? 'เลือกผู้ติดต่อ' : 'กรุณาเลือกบริษัท'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {Number(c.is_primary_contact) === 1 && ' (หลัก)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Deal ── */}
          <div className="space-y-1.5">
            <Label className="text-[13px]">Deal / Opportunity (ถ้ามี)</Label>
            <OpportunityCombobox
              value={opportunityId ?? ''}
              onChange={(id) => setOpportunityId(id || null)}
              placeholder="เลือก Deal ที่เชื่อมโยง"
            />
          </div>

          {/* ── ผู้รับผิดชอบ + ผู้สร้าง ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">ผู้รับผิดชอบโครงการ</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger className="h-9 text-sm bg-background"><SelectValue placeholder="เลือกผู้รับผิดชอบ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name}{u.position ? ` (${u.position})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {Number(user?.is_admin) === 1 && (
              <div className="space-y-1.5">
                <Label className="text-[13px]">เจ้าของ (ผู้สร้าง)</Label>
                <Select value={ownerId || user?.id} onValueChange={setOwnerId}>
                  <SelectTrigger className="h-9 text-sm bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* ── สถานะ + วันที่ ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">สถานะเริ่มต้น<Required /></Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">วันเริ่มต้น<Required /></Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                  setErrors((err) => ({ ...err, startDate: undefined }));
                }}
                className={cn("h-9 text-sm", errors.startDate && 'border-destructive')}
                required
              />
              <FieldError message={errors.startDate} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">วันสิ้นสุด<Required /></Label>
              <Input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => { setEndDate(e.target.value); setErrors((err) => ({ ...err, endDate: undefined })); }}
                className={cn("h-9 text-sm", errors.endDate && 'border-destructive')}
                required
              />
              <FieldError message={errors.endDate} />
            </div>
          </div>

          {/* ── สมาชิกทีม ── */}
          <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">สมาชิกในทีม</Label>
            </div>

            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-1">
                {selectedMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs shadow-sm"
                  >
                    <User className="h-3 w-3 text-primary" />
                    <span className="font-medium">{member.display_name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{member.role === 'lead' ? 'หัวหน้า' : 'สมาชิก'}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedMembers(selectedMembers.filter((m) => m.userId !== member.userId))}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={newMemberId} onValueChange={setNewMemberId}>
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="เลือกผู้ใช้งาน..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsersForMember.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">ไม่มีผู้ใช้เพิ่มเติม</div>
                    ) : (
                      availableUsersForMember.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.display_name} ({u.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="w-32 h-9 text-sm bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" size="icon" className="h-9 w-9 shrink-0" onClick={handleAddMember} disabled={!newMemberId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── งบประมาณ ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[13px]">งบประมาณ (ชั่วโมง)</Label>
              <Input
                type="number" step="0.5" min="0" placeholder="เช่น 40"
                value={budgetHours} className="h-9 text-sm"
                onChange={(e) => setBudgetHours(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px]">อัตราค่าจ้าง (บาท/ชม.)</Label>
              <Input
                type="number" step="50" min="0" placeholder="เช่น 1,000"
                value={hourlyRate} className="h-9 text-sm"
                onChange={(e) => setHourlyRate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" className="px-8" disabled={createProject.isPending}>
              {createProject.isPending ? 'กำลังบันทึก...' : 'สร้างโครงการ'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
