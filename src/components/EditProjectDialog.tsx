import { useEffect, useMemo, useState } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCompanies, useCustomers, useUpdateProject, useUsers, useProjectMembers, useAddProjectMember, useRemoveProjectMember } from '@/hooks/useProjectData';
import CompanyCombobox from '@/components/CompanyCombobox';
import { PROJECT_STATUS_LABELS, ROLE_LABELS } from '@/lib/labels';
import { useToast } from '@/hooks/use-toast';
import { X, Plus, User, Users } from 'lucide-react';

interface EditProjectDialogProps {
  project: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


const EditProjectDialog = ({ project, open, onOpenChange }: EditProjectDialogProps) => {
  const { toast } = useToast();
  const updateProject = useUpdateProject();
  const { data: companies = [] } = useCompanies(false);
  const { data: users = [] } = useUsers(true);
  const { data: members = [], refetch: refetchMembers } = useProjectMembers(project?.id || '');
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('on-track');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState<string>('none');
  const [companyId, setCompanyId] = useState<string>('none');
  const [ownerId, setOwnerId] = useState<string>('');
  const [managerId, setManagerId] = useState<string>('none');
  const [newMemberId, setNewMemberId] = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<string>('member');
  const [budgetHours, setBudgetHours] = useState<string>('');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  
  const { data: customers = [] } = useCustomers(companyId !== 'none' ? companyId : undefined, false);

  useEffect(() => {
    if (!project) return;
    setName(project.name || '');
    setDescription(project.project_description || project.description || '');
    setStatus(project.status || 'on-track');
    setStartDate(project.start_date || '');
    setEndDate(project.end_date || '');
    setCompanyId(project.company_id ?? 'none');
    setCustomerId(project.customer_id ?? 'none');
    setOwnerId(project.user_id || '');
    setManagerId(project.manager_id || 'none');
    setBudgetHours(project.budget_hours || '');
    setHourlyRate(project.hourly_rate || '');
  }, [project]);

  useEffect(() => {
    if (open && project?.id) {
      refetchMembers();
    }
  }, [open, project?.id, refetchMembers]);

  const companyNameMap = useMemo(() => {
    return new Map(companies.map((company) => [company.id, company.name]));
  }, [companies]);

  const userMap = useMemo(() => {
    return new Map(users.map((u) => [u.id, { name: u.display_name, email: u.email }]));
  }, [users]);

  const memberUserIds = useMemo(() => {
    return new Set(members.map((m) => m.user_id));
  }, [members]);

  const availableUsersForMember = useMemo(() => {
    return users.filter((u) => !memberUserIds.has(u.id) && u.id !== ownerId);
  }, [users, memberUserIds, ownerId]);

  const handleCompanyChange = (value: string) => {
    setCompanyId(value);
    setCustomerId('none');
  };

  const handleOwnerChange = async (value: string) => {
    if (!project || !value) return;
    setOwnerId(value);
    try {
      await updateProject.mutateAsync({
        id: project.id,
        user_id: value,
      });
      toast({ title: 'อัปเดตเจ้าของโครงการสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddMember = async () => {
    if (!project || !newMemberId) return;
    try {
      await addMember.mutateAsync({
        projectId: project.id,
        userId: newMemberId,
        role: newMemberRole,
      });
      setNewMemberId('');
      setNewMemberRole('member');
      toast({ title: 'เพิ่มสมาชิกทีมสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!project) return;
    try {
      await removeMember.mutateAsync({ id: memberId, projectId: project.id });
      toast({ title: 'ลบสมาชิกทีมสำเร็จ' });
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project) return;

    if (endDate && startDate && endDate < startDate) {
      toast({ title: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น', variant: 'destructive' });
      return;
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        name,
        description,
        status,
        start_date: startDate,
        end_date: endDate,
        company_id: companyId !== 'none' ? companyId : null,
        customer_id: customerId !== 'none' ? customerId : null,
        manager_id: managerId !== 'none' ? managerId : null,
        budget_hours: budgetHours ? parseFloat(budgetHours) : null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
      });
      toast({ title: 'บันทึกการแก้ไขโครงการสำเร็จ' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: error.message, variant: 'destructive' });
    }
  };

  const selectedCompanyName = companyId !== 'none' ? companyNameMap.get(companyId) : null;
  const ownerName = ownerId ? userMap.get(ownerId)?.name || '-' : '-';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && (updateProject.isPending || addMember.isPending || removeMember.isPending)) return; onOpenChange(v); }}>
      <DialogContent className="w-full sm:max-w-3xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">แก้ไขโครงการ</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-sm">ชื่อโครงการ <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} required className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">รายละเอียด</Label>
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="text-sm" rows={2} />
          </div>

          {/* ── บริษัท + ผู้ติดต่อ ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">บริษัทลูกค้า</Label>
              <CompanyCombobox
                value={companyId}
                onChange={(id) => handleCompanyChange(id)}
                placeholder="เลือกบริษัท"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">ผู้ติดต่อ</Label>
              <Select value={customerId} onValueChange={setCustomerId} disabled={companyId === 'none'}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={companyId !== 'none' ? 'เลือกผู้ติดต่อ' : 'เลือกบริษัทก่อน'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {customers.map((customer: any) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.first_name} {customer.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── ผู้รับผิดชอบ + ผู้สร้าง ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">ผู้รับผิดชอบ</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="เลือกผู้รับผิดชอบ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ไม่ระบุ</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">เจ้าของ (ผู้สร้าง)</Label>
              <Select value={ownerId} onValueChange={handleOwnerChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── สถานะ + วันที่ ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">สถานะ</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="เลือกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">วันเริ่มต้น <span className="text-destructive">*</span></Label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">วันสิ้นสุด <span className="text-destructive">*</span></Label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required className="h-9 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Budget (ชั่วโมง)</Label>
              <Input
                type="number" step="0.5" min="0" placeholder="เช่น 40"
                value={budgetHours} className="h-9 text-sm"
                onChange={(event) => setBudgetHours(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Rate (บาท/ชม.)</Label>
              <Input
                type="number" step="50" min="0" placeholder="เช่น 1000"
                value={hourlyRate} className="h-9 text-sm"
                onChange={(event) => setHourlyRate(event.target.value)}
              />
            </div>
          </div>

          {/* สมาชิกทีม */}
          <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">สมาชิกในทีม</Label>
            </div>
            
            {/* รายชื่อสมาชิกทีม */}
            {members.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-1">
                {members.map((member) => (
                  <div 
                    key={member.id} 
                    className="inline-flex items-center gap-1.5 bg-background border rounded-full px-3 py-1 text-xs shadow-sm"
                  >
                    <User className="h-3 w-3 text-primary" />
                    <span className="font-medium">{member.display_name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{member.role === 'lead' ? 'หัวหน้า' : 'สมาชิก'}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* เพิ่มสมาชิกทีม */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={newMemberId} onValueChange={setNewMemberId}>
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="เลือกผู้ใช้งาน..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsersForMember.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                <SelectTrigger className="w-32 h-9 text-sm bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button" variant="secondary" size="icon" className="h-9 w-9 shrink-0"
                onClick={handleAddMember}
                disabled={!newMemberId || addMember.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" className="px-8" disabled={updateProject.isPending}>
              {updateProject.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialog;
