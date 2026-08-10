import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { ArrowLeft, Building2, User, Calendar, DollarSign, TrendingUp, FileText, Edit, Trash2, Loader2, ArrowRight, CheckCircle, Clock, AlertCircle, Activity, Plus, Mail, Phone, Users, MessageSquare, Send } from 'lucide-react';
import { WorkflowInstanceCard } from '@/components/workflow/WorkflowInstanceCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import LeadSourceCombobox from '@/components/LeadSourceCombobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useCompanies, useUsers, useSalesActivities, useCreateSalesActivity, useUpdateSalesActivity, useDeleteSalesActivity, useCustomers } from '@/hooks/useProjectData';
import { useEmailCampaigns } from '@/hooks/useMarketing';
import ProgressBar from '@/components/ProgressBar';

interface SalesOpportunity {
  opportunity_id: string;
  opportunity_name: string;
  company_id: string;
  company_name: string;
  company_email?: string;
  company_phone?: string;
  contact_id?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_position?: string;
  stage: string;
  value: number;
  probability: number;
  expected_close_date?: string;
  lead_source?: string;
  description?: string;
  competitor_info?: string;
  notes?: string;
  assigned_user_id: string;
  assigned_user_name?: string;
  assigned_user_email?: string;
  created_at: string;
  updated_at: string;
}

interface SalesActivity {
  id: string;
  // Database fields
  opportunity_id?: string;
  activity_type?: 'email' | 'call' | 'meeting' | 'note' | 'quotation_sent' | 'other';
  subject?: string;
  description?: string;
  activity_date?: string;
  created_by?: string;
  created_by_name?: string;
  created_at?: string;
  // UI generated fields
  type?: 'created' | 'updated' | 'stage_changed' | 'quotation_created' | 'value_changed';
  description_text?: string;
  date?: string;
  icon?: 'plus' | 'edit' | 'arrow-right' | 'file-text' | 'dollar' | 'mail' | 'phone' | 'users' | 'message-square' | 'send';
  color?: string;
}

const activityTypeLabels: Record<string, string> = {
  email: 'อีเมล',
  call: 'โทร',
  meeting: 'ทำนัด',
  note: 'บันทึก',
  quotation_sent: 'ส่งราคา',
  other: 'อื่นๆ',
};

const activityTypeColors: Record<string, string> = {
  email: 'text-blue-600 bg-blue-100',
  call: 'text-green-600 bg-green-100',
  meeting: 'text-purple-600 bg-purple-100',
  note: 'text-yellow-600 bg-yellow-100',
  quotation_sent: 'text-orange-600 bg-orange-100',
  other: 'text-gray-600 bg-gray-100',
};

const activityTypeIcons: Record<string, string> = {
  email: 'mail',
  call: 'phone',
  meeting: 'users',
  note: 'message-square',
  quotation_sent: 'send',
  other: 'activity',
};

const stageLabels: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const stageColors: Record<string, string> = {
  lead: 'bg-gray-100 text-gray-800',
  qualified: 'bg-blue-100 text-blue-800',
  proposal: 'bg-yellow-100 text-yellow-800',
  negotiation: 'bg-orange-100 text-orange-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

import { safeFmt } from '@/lib/dateUtils';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(amount);
}

function getActivityIcon(iconType: string | undefined, colorClass: string) {
  const iconProps = { className: `h-4 w-4 ${colorClass}` };
  switch (iconType) {
    case 'plus':
      return <Plus {...iconProps} />;
    case 'edit':
      return <Edit {...iconProps} />;
    case 'arrow-right':
      return <ArrowRight {...iconProps} />;
    case 'file-text':
      return <FileText {...iconProps} />;
    case 'dollar':
      return <DollarSign {...iconProps} />;
    case 'mail':
      return <Mail {...iconProps} />;
    case 'phone':
      return <Phone {...iconProps} />;
    case 'users':
      return <Users {...iconProps} />;
    case 'message-square':
      return <MessageSquare {...iconProps} />;
    case 'send':
      return <Send {...iconProps} />;
    default:
      return <Activity {...iconProps} />;
  }
}

function generateActivities(opp: SalesOpportunity): SalesActivity[] {
  const activities: SalesActivity[] = [];
  
  // Opportunity created
  activities.push({
    id: 'created',
    type: 'created',
    description_text: `สร้างโอกาสการขาย "${opp.opportunity_name}"`,
    date: opp.created_at,
    icon: 'plus',
    color: 'text-green-600 bg-green-100',
  });
  
  // Stage info
  activities.push({
    id: 'stage',
    type: 'stage_changed',
    description_text: `เปลี่ยนสถานะเป็น ${stageLabels[opp.stage] || opp.stage}`,
    date: opp.updated_at,
    icon: 'arrow-right',
    color: 'text-blue-600 bg-blue-100',
  });
  
  // Value info
  if (opp.value > 0) {
    activities.push({
      id: 'value',
      type: 'value_changed',
      description_text: `ตั้งมูลค่า ${formatCurrency(opp.value)} (โอกาส ${opp.probability}%)`,
      date: opp.created_at,
      icon: 'dollar',
      color: 'text-yellow-600 bg-yellow-100',
    });
  }
  
  // Sort by date descending
  return activities.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
}

export default function SalesDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    stage: 'lead',
    value: 0,
    probability: 0,
    expected_close_date: '',
    actual_close_date: '',
    lead_source: '',
    assigned_to: '',
    company_id: '',
    contact_id: '',
    campaign_id: '',
    notes: '',
  });

  const isAdmin = Number(user?.is_admin) === 1;

  const { data: companies = [] } = useCompanies(true);
  const { data: users = [] } = useUsers();
  const { data: campaigns = [] } = useEmailCampaigns();

  const { data: opportunity, isLoading, error } = useQuery<SalesOpportunity>({
    queryKey: ['opportunity', id],
    queryFn: () => apiFetch(`/opportunities.php?id=${id}`),
    enabled: !!id,
  });

  // useCustomers depends on opportunity.company_id, so must be after opportunity query
  // When editing, use editForm.company_id to allow changing company and seeing its contacts
  const { data: customers = [] } = useCustomers(isEditing ? editForm.company_id : opportunity?.company_id, false);

  // Sales Activities
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [isEditingActivity, setIsEditingActivity] = useState(false);
  const [editingActivity, setEditingActivity] = useState<SalesActivity | null>(null);
  const [activityForm, setActivityForm] = useState({
    activity_type: 'call' as string,
    subject: '',
    description: '',
    activity_date: new Date().toISOString().slice(0, 16),
  });
  const { data: dbActivities = [], isLoading: isLoadingActivities } = useSalesActivities(id);
  const createActivityMutation = useCreateSalesActivity();
  const updateActivityMutation = useUpdateSalesActivity();
  const deleteActivityMutation = useDeleteSalesActivity();

  const handleCreateActivity = async () => {
    if (!activityForm.subject.trim()) {
      toast({ title: 'กรุณากรหัสเรื่อง', variant: 'destructive' });
      return;
    }
    try {
      await createActivityMutation.mutateAsync({
        opportunity_id: id!,
        activity_type: activityForm.activity_type,
        subject: activityForm.subject,
        description: activityForm.description,
        activity_date: activityForm.activity_date,
      });
      toast({ title: 'เพิ่มกิจกรรมสำเร็จ' });
      setIsCreatingActivity(false);
      setActivityForm({
        activity_type: 'call',
        subject: '',
        description: '',
        activity_date: new Date().toISOString().slice(0, 16),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      toast({ title: 'เกิดข้อผิดพลาด', description: message, variant: 'destructive' });
    }
  };

  const handleEditActivity = (activity: SalesActivity) => {
    setEditingActivity(activity);
    setActivityForm({
      activity_type: activity.activity_type || 'call',
      subject: activity.subject || '',
      description: activity.description || '',
      activity_date: activity.activity_date ? activity.activity_date.slice(0, 16) : new Date().toISOString().slice(0, 16),
    });
    setIsEditingActivity(true);
  };

  const handleUpdateActivity = async () => {
    if (!activityForm.subject.trim()) {
      toast({ title: 'กรุณากรหัสเรื่อง', variant: 'destructive' });
      return;
    }
    if (!editingActivity?.id || !editingActivity?.opportunity_id) {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
      return;
    }
    try {
      await updateActivityMutation.mutateAsync({
        id: editingActivity.id,
        opportunity_id: editingActivity.opportunity_id,
        activity_type: activityForm.activity_type,
        subject: activityForm.subject,
        description: activityForm.description,
        activity_date: activityForm.activity_date,
      });
      toast({ title: 'แก้ไขกิจกรรมสำเร็จ' });
      setIsEditingActivity(false);
      setEditingActivity(null);
      setActivityForm({
        activity_type: 'call',
        subject: '',
        description: '',
        activity_date: new Date().toISOString().slice(0, 16),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      toast({ title: 'เกิดข้อผิดพลาด', description: message, variant: 'destructive' });
    }
  };

  const handleDeleteActivity = async (activity: SalesActivity) => {
    if (!activity.id || !activity.opportunity_id) {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
      return;
    }
    const ok = await confirm({ title: 'ลบกิจกรรม', description: 'ต้องการลบกิจกรรมนี้ใช่หรือไม่?', variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteActivityMutation.mutateAsync({
        id: activity.id,
        opportunityId: activity.opportunity_id,
      });
      toast({ title: 'ลบกิจกรรมสำเร็จ' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      toast({ title: 'เกิดข้อผิดพลาด', description: message, variant: 'destructive' });
    }
  };

  const updateMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      stage: string;
      value: number;
      probability: number;
      expected_close_date?: string;
      lead_source?: string;
      assigned_to: string;
      company_id: string | null;
      contact_id: string | null;
    }) => {
      return apiFetch(`/opportunities.php?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast({ title: 'แก้ไขโอกาสการขายสำเร็จ' });
      setIsEditing(false);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      toast({ title: 'เกิดข้อผิดพลาด', description: message, variant: 'destructive' });
    },
  });

  const handleDelete = async () => {
    const ok2 = await confirm({ title: 'ลบโอกาสการขาย', description: `ต้องการลบโอกาสการขาย "${opportunity?.opportunity_name}" ใช่หรือไม่?`, variant: 'destructive' });
    if (!ok2) return;
    
    setIsDeleting(true);
    try {
      await apiFetch(`/opportunities.php?id=${id}`, { method: 'DELETE' });
      toast({ title: 'ลบโอกาสการขายสำเร็จ' });
      navigate('/sales');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      toast({ title: 'เกิดข้อผิดพลาด', description: message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const openEdit = () => {
    if (opportunity) {
      setEditForm({
        name: opportunity.opportunity_name || '',
        description: opportunity.description || '',
        stage: opportunity.stage || 'lead',
        value: opportunity.value || 0,
        probability: opportunity.probability || 0,
        expected_close_date: opportunity.expected_close_date || '',
        lead_source: opportunity.lead_source || '',
        assigned_to: opportunity.assigned_user_id || '',
        company_id: opportunity.company_id || '',
        contact_id: opportunity.contact_id || '',
        actual_close_date: opportunity.actual_close_date || '',
        campaign_id: (opportunity as any).campaign_id || '',
        notes: (opportunity as any).notes || '',
      });
      setIsEditing(true);
    }
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      ...editForm,
      company_id: editForm.company_id || null,
      contact_id: editForm.contact_id || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/sales')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          กลับไปหน้าขาย
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            ไม่พบโอกาสการขาย
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <Button variant="ghost" size="icon" onClick={() => navigate('/sales')} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold font-heading truncate">{opportunity.opportunity_name}</h1>
              <span className={`status-badge shrink-0 ${stageColors[opportunity.stage] || 'bg-gray-100'}`}>
                {stageLabels[opportunity.stage] || opportunity.stage}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {opportunity.company_name || '-'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-3 sm:mt-0">
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  แก้ไข
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsCreatingActivity(true)}>
              <Activity className="h-4 w-4 mr-2" />
              เพิ่มกิจกรรม
            </Button>
            {isAdmin && (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                ลบ
              </Button>
            )}
          </div>
        </div>
        
        {/* Info row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="w-4 h-4 shrink-0" />
            {opportunity.assigned_user_name || 'ไม่มีผู้รับผิดชอบ'}
          </span>
          {opportunity.expected_close_date && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 shrink-0" />
              คาดปิด: {safeFmt(opportunity.expected_close_date)}
            </span>
          )}
          {opportunity.lead_source && (
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 shrink-0" />
              {opportunity.lead_source}
            </span>
          )}
          {(opportunity as any).created_by_name && (
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 shrink-0" />
              หา lead โดย: <strong className="text-foreground">{(opportunity as any).created_by_name}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="stat-card card-hover p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading">{formatCurrency(opportunity.value)}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">มูลค่า (โอกาส {opportunity.probability}%)</p>
        </div>
        
        <div className="stat-card card-hover p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-accent/10">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading">{formatCurrency(opportunity.value * opportunity.probability / 100)}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">มูลค่าถ่วงน้ำหนัก</p>
        </div>
        
        <div className="stat-card card-hover p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-info/10">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-info" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading">{safeFmt(opportunity.expected_close_date)}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            {opportunity.expected_close_date ? (
              (() => {
                const diff = Math.ceil((new Date(opportunity.expected_close_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return diff > 0 ? `เหลือ ${diff} วัน` : diff < 0 ? `เกินมา ${Math.abs(diff)} วัน` : 'วันนี้';
              })()
            ) : 'ไม่กำหนด'}
          </p>
        </div>
        
        <div className="stat-card card-hover p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-success/10">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading">{dbActivities.length}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">กิจกรรมทั้งหมด</p>
        </div>
        
      </div>

      {/* Description */}
      {opportunity.description && (
        <div className="bg-card rounded-xl border p-3 sm:p-5">
          <h3 className="text-lg font-semibold font-heading mb-4">รายละเอียด</h3>
          <p className="whitespace-pre-wrap text-sm">{opportunity.description}</p>
        </div>
      )}

      {/* Company Info */}
      <div className="bg-card rounded-xl border p-3 sm:p-5">
        <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          ข้อมูลบริษัท
        </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">ชื่อบริษัท</p>
              <p className="font-medium">{opportunity.company_name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">อีเมล</p>
              <p className="font-medium">{opportunity.company_email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">โทรศัพท์</p>
              <p className="font-medium">{opportunity.company_phone || '-'}</p>
            </div>
          </div>
          
          {opportunity.contact_name && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" />
                  ผู้ติดต่อ
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">ชื่อ</p>
                    <p className="font-medium">
                      {opportunity.contact_name}
                      {opportunity.contact_position && <span className="text-muted-foreground"> ({opportunity.contact_position})</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">อีเมล</p>
                    <p className="font-medium">{opportunity.contact_email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">โทรศัพท์</p>
                    <p className="font-medium">{opportunity.contact_phone || '-'}</p>
                  </div>
                </div>
              </div>
            </>
          )}
          
          <Separator className="my-4" />
          <Button variant="outline" onClick={() => navigate(`/companies?id=${opportunity.company_id}`)}>
            ดูรายละเอียดบริษัท
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

      {/* Workflow */}
      <WorkflowInstanceCard entityType="opportunity" entityId={opportunity.opportunity_id} />

      {/* Sales Activities */}
      <div className="bg-card rounded-xl border p-3 sm:p-5">
        <h3 className="text-lg font-semibold font-heading mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          กิจกรรมการขาย
        </h3>
        <p className="text-sm text-muted-foreground mb-4">ประวัติกิจกรรมและการเปลี่ยนแปลงของโอกาสการขาย</p>
          {isLoadingActivities ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {(() => {
                // Convert database activities to SalesActivity format
                const dbActivityItems: SalesActivity[] = (dbActivities as SalesActivity[]).map((a) => ({
                  id: a.id,
                  opportunity_id: a.opportunity_id,
                  activity_type: a.activity_type,
                  subject: a.subject,
                  description: a.description,
                  activity_date: a.activity_date,
                  created_by_name: a.created_by_name,
                  date: a.activity_date,
                  icon: (activityTypeIcons[a.activity_type || 'other'] || 'activity') as 'plus' | 'edit' | 'arrow-right' | 'file-text' | 'dollar' | 'mail' | 'phone' | 'users' | 'message-square' | 'send',
                  color: activityTypeColors[a.activity_type || 'other'] || 'text-gray-600 bg-gray-100',
                  description_text: a.subject,
                }));
                
                const generatedItems = generateActivities(opportunity);
                
                // Merge and sort by date
                const allActivities = [...dbActivityItems, ...generatedItems].sort(
                  (a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
                );
                
                if (allActivities.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>ยังไม่มีกิจกรรม</p>
                    </div>
                  );
                }
                return (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />
                    <div className="space-y-4">
                      {allActivities.map((activity, index) => {
                        const isDbActivity = dbActivityItems.some(db => db.id === activity.id);
                        return (
                          <div key={activity.id} className="relative flex gap-4 group">
                            {/* Icon on timeline */}
                            <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activity.color}`}>
                              {getActivityIcon(activity.icon, '')}
                            </div>
                            {/* Content */}
                            <div className="flex-1 pt-1 pb-2">
                              <p className="text-sm font-medium">{activity.description_text || activity.subject}</p>
                              {activity.description && (
                                <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                              )}
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                {safeFmt(activity.date || activity.activity_date)}
                                {activity.created_by_name && (
                                  <span className="text-primary">โดย {activity.created_by_name}</span>
                                )}
                                {activity.activity_type && (
                                  <Badge variant="outline" className="text-xs ml-2">
                                    {activityTypeLabels[activity.activity_type]}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {/* Edit/Delete buttons - only for DB activities */}
                            {isDbActivity && isAdmin && (
                              <div className="flex items-start gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditActivity(activity)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-500 hover:text-red-600"
                                  onClick={() => handleDeleteActivity(activity)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>

      {/* Create Activity Dialog */}
      <Dialog open={isCreatingActivity} onOpenChange={(v) => { setIsCreatingActivity(v); if (!v) setActivityForm({ activity_type: 'call', subject: '', description: '', activity_date: new Date().toISOString().slice(0, 16) }); }}>
        <DialogContent className="w-full sm:max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>เพิ่มกิจกรรมการขาย</DialogTitle>
            <DialogDescription>
              บันทึกกิจกรรมที่คุณทำกับลูกค้า
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Activity Type */}
            <div className="space-y-2">
              <Label>ประเภทกิจกรรม</Label>
              <Select
                value={activityForm.activity_type}
                onValueChange={(value) => setActivityForm({ ...activityForm, activity_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      อีเมล
                    </div>
                  </SelectItem>
                  <SelectItem value="call">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      โทร
                    </div>
                  </SelectItem>
                  <SelectItem value="meeting">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      ทำนัด
                    </div>
                  </SelectItem>
                  <SelectItem value="note">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      บันทึก
                    </div>
                  </SelectItem>
                  <SelectItem value="quotation_sent">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      ส่งราคา
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      อื่นๆ
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="activity-subject">หัวข้อ *</Label>
              <Input
                id="activity-subject"
                value={activityForm.subject}
                onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
                placeholder="ระบุหัวข้อกิจกรรม"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="activity-description">รายละเอียด</Label>
              <Textarea
                id="activity-description"
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                placeholder="ระบุรายละเอียดเพิ่มเติม"
                rows={3}
              />
            </div>

            {/* Activity Date */}
            <div className="space-y-2">
              <Label htmlFor="activity-date">วันที่</Label>
              <Input
                id="activity-date"
                type="datetime-local"
                value={activityForm.activity_date}
                onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingActivity(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleCreateActivity} disabled={createActivityMutation.isPending}>
              {createActivityMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Activity Dialog */}
      <Dialog open={isEditingActivity} onOpenChange={(open) => { setIsEditingActivity(open); if (!open) setEditingActivity(null); }}>
        <DialogContent className="w-full sm:max-w-sm sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขกิจกรรมการขาย</DialogTitle>
            <DialogDescription>
              แก้ไขข้อมูลกิจกรรม
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Activity Type */}
            <div className="space-y-2">
              <Label>ประเภทกิจกรรม</Label>
              <Select
                value={activityForm.activity_type}
                onValueChange={(value) => setActivityForm({ ...activityForm, activity_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      อีเมล
                    </div>
                  </SelectItem>
                  <SelectItem value="call">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      โทร
                    </div>
                  </SelectItem>
                  <SelectItem value="meeting">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      ทำนัด
                    </div>
                  </SelectItem>
                  <SelectItem value="note">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      บันทึก
                    </div>
                  </SelectItem>
                  <SelectItem value="quotation_sent">
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4" />
                      ส่งราคา
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      อื่นๆ
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="edit-activity-subject">หัวข้อ *</Label>
              <Input
                id="edit-activity-subject"
                value={activityForm.subject}
                onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
                placeholder="ระบุหัวข้อกิจกรรม"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-activity-description">รายละเอียด</Label>
              <Textarea
                id="edit-activity-description"
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                placeholder="ระบุรายละเอียดเพิ่มเติม"
                rows={3}
              />
            </div>

            {/* Activity Date */}
            <div className="space-y-2">
              <Label htmlFor="edit-activity-date">วันที่</Label>
              <Input
                id="edit-activity-date"
                type="datetime-local"
                value={activityForm.activity_date}
                onChange={(e) => setActivityForm({ ...activityForm, activity_date: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditingActivity(false); setEditingActivity(null); }}>
              ยกเลิก
            </Button>
            <Button onClick={handleUpdateActivity} disabled={updateActivityMutation.isPending}>
              {updateActivityMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="w-full sm:max-w-sm sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขโอกาสการขาย</DialogTitle>
            <DialogDescription>
              อัปเดตข้อมูลโอกาสการขาย
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-name">ชื่อโอกาสการขาย</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">รายละเอียด</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label htmlFor="edit-company">บริษัท</Label>
              <Select
                value={editForm.company_id || ''}
                onValueChange={(value) => setEditForm({ ...editForm, company_id: value, contact_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c: { id: string; name: string }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <Label htmlFor="edit-contact">ผู้ติดต่อ</Label>
              <Select
                value={editForm.contact_id || ''}
                onValueChange={(value) => setEditForm({ ...editForm, contact_id: value === '__none__' ? '' : value })}
                disabled={!editForm.company_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={editForm.company_id ? "เลือกผู้ติดต่อ" : "เลือกบริษัทก่อน"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ไม่เลือกผู้ติดต่อ</SelectItem>
                  {customers.map((c: { id: string; first_name: string; last_name: string; position?: string; is_primary_contact: number }) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.position && ` (${c.position})`}
                      {Number(c.is_primary_contact) === 1 && ' - ผู้ติดต่อหลัก'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stage */}
              <div className="space-y-2">
                <Label htmlFor="edit-stage">ขั้นตอน</Label>
                <Select
                  value={editForm.stage}
                  onValueChange={(value) => setEditForm({ ...editForm, stage: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="proposal">Proposal</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To */}
              <div className="space-y-2">
                <Label htmlFor="edit-assigned_to">ผู้รับผิดชอบ</Label>
                <Select
                  value={editForm.assigned_to}
                  onValueChange={(value) => setEditForm({ ...editForm, assigned_to: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกผู้รับผิดชอบ" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u: { id: string; display_name: string }) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Value */}
              <div className="space-y-2">
                <Label htmlFor="edit-value">มูลค่า (บาท)</Label>
                <Input
                  id="edit-value"
                  type="number"
                  value={editForm.value}
                  onChange={(e) => setEditForm({ ...editForm, value: Number(e.target.value) })}
                />
              </div>

              {/* Probability */}
              <div className="space-y-2">
                <Label htmlFor="edit-probability">โอกาส (%)</Label>
                <Input
                  id="edit-probability"
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.probability}
                  onChange={(e) => setEditForm({ ...editForm, probability: Number(e.target.value) })}
                />
              </div>

              {/* Expected Close Date */}
              <div className="space-y-2">
                <Label htmlFor="edit-expected_close_date">วันที่คาดว่าจะปิด</Label>
                <Input
                  id="edit-expected_close_date"
                  type="date"
                  value={editForm.expected_close_date}
                  onChange={(e) => setEditForm({ ...editForm, expected_close_date: e.target.value })}
                />
              </div>

              {/* Lead Source */}
              <div className="space-y-2">
                <Label>แหล่งที่มา</Label>
                <LeadSourceCombobox
                  value={editForm.lead_source}
                  onChange={(v) => setEditForm({ ...editForm, lead_source: v })}
                />
              </div>

              {/* Actual Close Date (won/lost only) */}
              {['won', 'lost'].includes(editForm.stage) && (
                <div className="space-y-2">
                  <Label>วันที่ปิดดีลจริง</Label>
                  <Input
                    type="date"
                    value={editForm.actual_close_date}
                    onChange={(e) => setEditForm({ ...editForm, actual_close_date: e.target.value })}
                  />
                </div>
              )}

              {/* Campaign */}
              <div className="space-y-2">
                <Label>Campaign ที่นำมา (ถ้ามี)</Label>
                <Select
                  value={editForm.campaign_id || '__none__'}
                  onValueChange={(v) => setEditForm({ ...editForm, campaign_id: v === '__none__' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="— ไม่ระบุ —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                    {campaigns.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>บันทึกเพิ่มเติม</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="หมายเหตุหรือข้อมูลเพิ่มเติม"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
