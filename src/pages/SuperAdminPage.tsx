import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { setSATenant, clearSATenant } from '@/lib/superadmin-tenant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Building2, Users, CreditCard, BarChart3, Check, X, Trash2, CalendarPlus, ShieldCheck, Ban, AlertCircle, TrendingUp, Pencil, Settings, Plus, Eye, EyeOff, ExternalLink } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  useSuperAdminOverview, useSuperAdminTenants, useCreateTenant, useUpdateTenant,
  useExtendTrial, useDeleteTenant,
  usePlanLimits, useUpdatePlanLimit, useCreatePlanLimit, useDeletePlanLimit,
  usePayments, useApprovePayment, useRejectPayment, useDeletePayment,
  useSuperAdminUsers, useUpdateUser, useDeleteUser,
  usePaymentMethodsAdmin, useCreatePaymentMethod, useUpdatePaymentMethod, useDeletePaymentMethod,
} from '@/hooks/useSuperAdmin';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';

const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-slate-100 text-slate-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-violet-100 text-violet-700',
  enterprise: 'bg-amber-100 text-amber-700',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  expired: 'bg-orange-100 text-orange-700',
};

function daysRemaining(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  return differenceInDays(parseISO(expiresAt), new Date());
}

export default function SuperAdminPage() {
  const { user } = useAuth();
  if (!user?.is_superadmin) return <Navigate to="/" replace />;

  return (
    <PageShell title="⚡ Super Admin" description="จัดการ Platform ทั้งหมด">
      <div className="max-w-5xl">
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 size={14} /> ภาพรวม</TabsTrigger>
          <TabsTrigger value="tenants" className="gap-1.5"><Building2 size={14} /> บริษัท</TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5"><Check size={14} /> การชำระเงิน</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users size={14} /> ผู้ใช้</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings size={14} /> การตั้งค่า</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="tenants"><TenantsTab /></TabsContent>
        <TabsContent value="payments"><PaymentsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
      </div>
    </PageShell>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

const PLAN_BAR_COLORS: Record<string, string> = {
  trial: '#94a3b8', starter: '#3b82f6', pro: '#7c3aed', enterprise: '#f59e0b',
};

function StatCard({ label, val, icon: Icon, color, sub }: { label: string; val: any; icon: any; color: string; sub?: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Icon size={16} className={color} />
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
        <div className="text-2xl font-bold tabular-nums leading-none">{val ?? '—'}</div>
        <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      </CardContent>
    </Card>
  );
}

function OverviewTab() {
  const { data: ov, isLoading } = useSuperAdminOverview();

  const revenueChange = ov?.revenue_last_month > 0
    ? Math.round(((ov.revenue_this_month - ov.revenue_last_month) / ov.revenue_last_month) * 100)
    : null;

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* KPI Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="บริษัททั้งหมด"   val={ov?.tenants}           icon={Building2}  color="text-blue-600" />
        <StatCard label="Active สมาชิก"    val={ov?.active_subs}        icon={Check}       color="text-green-600" />
        <StatCard label="ทดลองใช้งาน"     val={ov?.trial_count}        icon={AlertCircle} color="text-amber-600" />
        <StatCard label="ผู้ใช้ทั้งหมด"   val={ov?.users}              icon={Users}       color="text-violet-600" />
        <StatCard label="รอชำระเงิน"       val={ov?.pending_payments}   icon={CreditCard}  color="text-red-600" />
        <StatCard
          label="MRR (฿/เดือน)"
          val={`฿${Number(ov?.mrr_thb || 0).toLocaleString()}`}
          icon={TrendingUp}
          color="text-emerald-600"
        />
      </div>

      {/* Revenue + Plan distribution row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Revenue this month */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">รายได้เดือนนี้</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-3xl font-bold tabular-nums">
              ฿{Number(ov?.revenue_this_month || 0).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <span>เดือนที่แล้ว ฿{Number(ov?.revenue_last_month || 0).toLocaleString()}</span>
              {revenueChange !== null && (
                <Badge className={`text-[10px] px-1.5 py-0 ${revenueChange >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {revenueChange >= 0 ? '+' : ''}{revenueChange}%
                </Badge>
              )}
            </div>
            {ov?.expired_count > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 rounded-lg px-2.5 py-1.5">
                <AlertCircle size={12} />
                มี {ov.expired_count} บริษัทหมดอายุแต่ยังไม่อัปเดตสถานะ
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plan distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">สัดส่วนแผน (Active)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {ov?.plan_distribution?.length > 0 ? (
              <div className="space-y-2">
                {ov.plan_distribution.map((p: any) => {
                  const pct = ov.active_subs > 0 ? Math.round((p.count / ov.active_subs) * 100) : 0;
                  return (
                    <div key={p.plan}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="capitalize font-medium">{p.plan}</span>
                        <span className="text-muted-foreground">{p.count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: PLAN_BAR_COLORS[p.plan] || '#94a3b8' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signups chart + Expiring trials row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Signups 6 months */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">บริษัทใหม่ (6 เดือน)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {ov?.signups_6m?.length > 0 ? (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={ov.signups_6m} barSize={24} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={22} />
                  <Tooltip formatter={(v: any) => [v, 'บริษัท']} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {ov.signups_6m.map((_: any, i: number) => (
                      <Cell key={i} fill={i === ov.signups_6m.length - 1 ? '#7c3aed' : '#ddd6fe'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground py-8 text-center">ยังไม่มีข้อมูล</p>
            )}
          </CardContent>
        </Card>

        {/* Expiring trials */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              หมดอายุใน 7 วัน
              {ov?.expiring_trials?.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">{ov.expiring_trials.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {ov?.expiring_trials?.length > 0 ? (
              <div className="space-y-2">
                {ov.expiring_trials.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate flex-1 mr-2">{t.name}</span>
                    <Badge className={`shrink-0 text-[10px] px-1.5 py-0 ${t.days_left <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {t.days_left <= 0 ? 'วันนี้' : `${t.days_left} วัน`}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">ไม่มี trial ที่ใกล้หมดอายุ</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Pending payments + Recent signups */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Pending payments */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              รอยืนยันการชำระ
              {ov?.pending_payments > 0 && (
                <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0">{ov.pending_payments}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {ov?.pending_list?.length > 0 ? (
              <div className="space-y-2">
                {ov.pending_list.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-medium truncate">{p.tenant_name}</p>
                      <p className="text-muted-foreground">{p.method === 'qr' ? 'QR/PromptPay' : 'โอนเงิน'} · {format(parseISO(p.submitted_at), 'dd/MM HH:mm')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold">฿{Number(p.amount).toLocaleString()}</p>
                      <Badge className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0 capitalize">{p.plan}</Badge>
                    </div>
                  </div>
                ))}
                {ov.pending_payments > 5 && (
                  <p className="text-[10px] text-muted-foreground text-center">และอีก {ov.pending_payments - 5} รายการ → ดูใน tab การชำระเงิน</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">ไม่มีรายการรอยืนยัน</p>
            )}
          </CardContent>
        </Card>

        {/* Recent signups */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">บริษัทล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {ov?.recent_tenants?.length > 0 ? (
              <div className="space-y-2">
                {ov.recent_tenants.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-medium truncate">{t.name}</p>
                      <p className="text-muted-foreground">{format(parseISO(t.created_at), 'dd/MM/yyyy')} · {t.user_count} user</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge className={`text-[10px] px-1.5 py-0 ${PLAN_COLORS[t.plan] || ''}`}>{t.plan}</Badge>
                      <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[t.status] || ''}`}>{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">ยังไม่มีข้อมูล</p>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

function TenantsTab() {
  const { data: tenants = [], isLoading } = useSuperAdminTenants();
  const { data: planLimits = [] } = usePlanLimits();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const extendTrial = useExtendTrial();
  const deleteTenant = useDeleteTenant();
  const { toast } = useToast();
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [editTenant, setEditTenant] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTenant, setNewTenant] = useState({ name: '', plan: 'trial', admin_email: '', admin_password: '' });

  const handleManageTenant = (t: any) => {
    setSATenant({ id: t.id, name: t.name });
    // Full reload to clear React Query cache so all data refetches for the new tenant
    window.location.href = '/#/';
    window.location.reload();
  };

  if (isLoading) return <Loader className="py-12" />;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => { setNewTenant({ name: '', plan: 'trial', admin_email: '', admin_password: '' }); setShowCreateDialog(true); }}>
          <Plus size={13} /> สร้างบริษัทใหม่
        </Button>
      </div>

      {tenants.map((t: any) => {
        const days = daysRemaining(t.expires_at);
        const isExpiringSoon = days !== null && days <= 7 && days >= 0;
        const isExpired = days !== null && days < 0;

        return (
          <div key={t.id} className="flex flex-wrap items-center gap-3 p-4 rounded-xl border bg-card shadow-sm">
            <div className="flex-1 min-w-48 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{t.name}</p>
                <Badge className={`text-[10px] px-1.5 py-0 ${PLAN_COLORS[t.plan] || ''}`}>{t.plan}</Badge>
                <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[t.sub_status || t.status] || ''}`}>{t.sub_status || t.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t.slug} · {t.user_count}/{t.max_users ?? '∞'} ผู้ใช้</p>
              {t.expires_at ? (
                <p className={`text-xs font-medium ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {isExpired ? `หมดอายุแล้ว ${Math.abs(days!)} วัน` : days === 0 ? 'หมดอายุวันนี้' : `เหลือ ${days} วัน (${format(parseISO(t.expires_at), 'dd MMM yy')})`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">ไม่มีวันหมดอายุ</p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Manage tenant data */}
              <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => handleManageTenant(t)}>
                <ExternalLink size={12} /> จัดการ
              </Button>

              {/* Edit button */}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditTenant({ ...t })}>
                <Pencil size={12} /> แก้ไข
              </Button>

              {/* Extend trial */}
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setExtendId(t.id); setExtendDays(30); }}>
                <CalendarPlus size={12} /> ต่ออายุ
              </Button>

              {/* Delete — only for trial tenants */}
              {t.plan === 'trial' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 size={13} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ลบ Tenant "{t.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>การลบจะลบข้อมูล tenant, users ทั้งหมด และ subscription ไม่สามารถกู้คืนได้</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => {
                        deleteTenant.mutate(t.id, {
                          onSuccess: () => toast({ title: `ลบ ${t.name} แล้ว` }),
                          onError: (e: any) => toast({ title: 'ลบไม่สำเร็จ', description: e.message, variant: 'destructive' }),
                        });
                      }}>ลบถาวร</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        );
      })}

      {/* Edit Tenant Dialog */}
      {editTenant && (
        <TenantEditDialog
          tenant={editTenant}
          onClose={() => setEditTenant(null)}
          onSave={(fields) => {
            updateTenant.mutate(
              { id: editTenant.id, ...fields },
              {
                onSuccess: () => { toast({ title: 'บันทึกข้อมูลสำเร็จ' }); setEditTenant(null); },
                onError: (e: any) => toast({ title: 'บันทึกไม่สำเร็จ', description: e.message, variant: 'destructive' }),
              }
            );
          }}
          isSaving={updateTenant.isPending}
        />
      )}

      {/* Create Tenant Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(o) => { if (!o) setShowCreateDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>สร้างบริษัทใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>ชื่อบริษัท *</Label>
              <Input value={newTenant.name} onChange={e => setNewTenant(x => ({ ...x, name: e.target.value }))} placeholder="บริษัท ABC จำกัด" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>แผน</Label>
              <Select value={newTenant.plan} onValueChange={v => setNewTenant(x => ({ ...x, plan: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {planLimits.length > 0
                    ? planLimits.map((pl: any) => (
                        <SelectItem key={pl.plan} value={pl.plan} className="capitalize">{pl.plan}</SelectItem>
                      ))
                    : ['trial', 'starter', 'pro', 'enterprise'].map(p => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>อีเมลแอดมิน *</Label>
              <Input type="email" value={newTenant.admin_email} onChange={e => setNewTenant(x => ({ ...x, admin_email: e.target.value }))} placeholder="admin@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label>รหัสผ่านแอดมิน * <span className="text-muted-foreground text-xs">(อย่างน้อย 6 ตัวอักษร)</span></Label>
              <Input type="password" value={newTenant.admin_password} onChange={e => setNewTenant(x => ({ ...x, admin_password: e.target.value }))} placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>ยกเลิก</Button>
            <Button
              disabled={createTenant.isPending || !newTenant.name.trim() || !newTenant.admin_email.trim() || newTenant.admin_password.length < 6}
              onClick={() => {
                createTenant.mutate(newTenant, {
                  onSuccess: () => { toast({ title: 'สร้างบริษัทสำเร็จ' }); setShowCreateDialog(false); },
                  onError: (e: any) => toast({ title: 'สร้างไม่สำเร็จ', description: e.message, variant: 'destructive' }),
                });
              }}>
              {createTenant.isPending ? <Loader2 size={14} className="animate-spin" /> : 'สร้าง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Trial Dialog */}
      <Dialog open={!!extendId} onOpenChange={(o) => !o && setExtendId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>ต่ออายุ Subscription</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <Label>จำนวนวันที่ต้องการต่อ</Label>
            <Input type="number" min={1} max={365} value={extendDays} onChange={e => setExtendDays(+e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendId(null)}>ยกเลิก</Button>
            <Button onClick={() => {
              if (!extendId) return;
              extendTrial.mutate({ id: extendId, days: extendDays }, {
                onSuccess: () => { toast({ title: `ต่ออายุ ${extendDays} วันสำเร็จ` }); setExtendId(null); },
                onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
              });
            }} disabled={extendTrial.isPending}>
              {extendTrial.isPending ? <Loader2 size={14} className="animate-spin" /> : 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tenant Edit Dialog ───────────────────────────────────────────────────────

function TenantEditDialog({
  tenant, onClose, onSave, isSaving,
}: {
  tenant: any;
  onClose: () => void;
  onSave: (fields: { name?: string; slug?: string; plan?: string; status?: string }) => void;
  isSaving: boolean;
}) {
  const [name, setName]     = useState(tenant.name);
  const [slug, setSlug]     = useState(tenant.slug);
  const [plan, setPlan]     = useState(tenant.plan);
  const [status, setStatus] = useState(tenant.status);
  const { data: planLimits = [] } = usePlanLimits();

  const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleSave = () => {
    const fields: Record<string, string> = {};
    if (name.trim() !== tenant.name)   fields.name   = name.trim();
    if (slug.trim() !== tenant.slug)   fields.slug   = slug.trim();
    if (plan !== tenant.plan)          fields.plan   = plan;
    if (status !== tenant.status)      fields.status = status;
    if (Object.keys(fields).length === 0) { onClose(); return; }
    onSave(fields);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แก้ไข Tenant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>ชื่อบริษัท / Tenant</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อบริษัท" />
          </div>
          <div className="space-y-1.5">
            <Label>Slug <span className="text-muted-foreground text-xs">(ตัวระบุ URL ตัวพิมพ์เล็ก)</span></Label>
            <div className="flex gap-2">
              <Input value={slug} onChange={e => setSlug(slugify(e.target.value))} placeholder="my-company" className="font-mono text-sm" />
              <Button variant="outline" size="sm" type="button" className="shrink-0 text-xs"
                onClick={() => setSlug(slugify(name) + '-' + tenant.id.slice(0, 8))}>
                อัตโนมัติ
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>แผน</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {planLimits.length > 0
                    ? planLimits.map((pl: any) => (
                        <SelectItem key={pl.plan} value={pl.plan} className="capitalize">{pl.plan}</SelectItem>
                      ))
                    : ['trial', 'starter', 'pro', 'enterprise'].map(p => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>สถานะ</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">ใช้งาน</SelectItem>
                  <SelectItem value="suspended">ระงับ</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p>ID: <span className="font-mono">{tenant.id}</span></p>
            <p>ผู้ใช้: {tenant.user_count} / {tenant.max_users ?? '∞'}</p>
            {tenant.expires_at && <p>หมดอายุ: {format(parseISO(tenant.expires_at), 'dd MMM yyyy HH:mm')}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim() || !slug.trim()}>
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Plan Limits ──────────────────────────────────────────────────────────────

function PlanLimitsTab() {
  const { data: limits = [], isLoading } = usePlanLimits();
  const updateLimit = useUpdatePlanLimit();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, any>>({});

  if (isLoading) return <Loader className="py-12" />;

  const PLAN_DESC: Record<string, string> = {
    trial: 'ทดลองใช้ฟรี ไม่มีค่าใช้จ่าย',
    starter: 'สำหรับทีมขนาดเล็ก',
    pro: 'สำหรับธุรกิจ SME',
    enterprise: 'ไม่จำกัด users ราคาพิเศษ',
  };

  return (
    <div className="space-y-3 mt-2">
      {limits.map((pl: any) => {
        const ed = editing[pl.plan] ?? {};
        const hasChange = !!editing[pl.plan];
        return (
          <Card key={pl.plan} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-36">
                  <p className="font-semibold capitalize text-sm">{pl.plan}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{PLAN_DESC[pl.plan]}</p>
                </div>
                <div className="flex flex-wrap gap-4 flex-1">
                  <div>
                    <Label className="text-xs text-muted-foreground">จำนวนผู้ใช้สูงสุด (0=ไม่จำกัด)</Label>
                    <Input type="number" min={0} defaultValue={pl.max_users} className="w-28 h-8 text-sm mt-1"
                      onChange={e => setEditing(x => ({ ...x, [pl.plan]: { ...ed, max_users: +e.target.value } }))} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ราคา ฿/เดือน</Label>
                    <Input type="number" min={0} defaultValue={pl.price_thb} className="w-32 h-8 text-sm mt-1"
                      onChange={e => setEditing(x => ({ ...x, [pl.plan]: { ...ed, price_thb: +e.target.value } }))} />
                  </div>
                  {pl.plan === 'trial' && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Trial Days</Label>
                      <Input type="number" min={1} defaultValue={pl.trial_days} className="w-24 h-8 text-sm mt-1"
                        onChange={e => setEditing(x => ({ ...x, [pl.plan]: { ...ed, trial_days: +e.target.value } }))} />
                    </div>
                  )}
                  <div className="flex items-end">
                    <Button size="sm" className="h-8" disabled={!hasChange || updateLimit.isPending}
                      onClick={() => {
                        updateLimit.mutate({ plan: pl.plan, ...editing[pl.plan] }, {
                          onSuccess: () => { toast({ title: `บันทึก ${pl.plan} สำเร็จ` }); setEditing(x => { const n = { ...x }; delete n[pl.plan]; return n; }); },
                          onError: () => toast({ title: 'บันทึกไม่สำเร็จ', variant: 'destructive' }),
                        });
                      }}>
                      {updateLimit.isPending ? <Loader2 size={13} className="animate-spin" /> : 'บันทึก'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────

function PaymentsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const { data: payments = [], isLoading } = usePayments(statusFilter === 'all' ? undefined : statusFilter);
  const approve = useApprovePayment();
  const reject = useRejectPayment();
  const deletePayment = useDeletePayment();
  const { toast } = useToast();
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  return (
    <div className="space-y-3 mt-2">
      <div className="flex gap-2">
        {[
          { val: 'pending', label: 'รอดำเนินการ' },
          { val: 'approved', label: 'อนุมัติแล้ว' },
          { val: 'rejected', label: 'ปฏิเสธแล้ว' },
          { val: 'all', label: 'ทั้งหมด' },
        ].map(({ val, label }) => (
          <Button key={val} size="sm" variant={statusFilter === val ? 'default' : 'outline'} className="h-7 text-xs"
            onClick={() => setStatusFilter(val)}>{label}</Button>
        ))}
      </div>

      {isLoading && <Loader className="py-8" />}

      {!isLoading && payments.length === 0 && (
        <div className="py-12 text-center text-muted-foreground text-sm">ไม่มีรายการ</div>
      )}

      {payments.map((p: any) => (
        <Card key={p.id} className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-48 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{p.tenant_name}</p>
                  <Badge className={`text-[10px] px-1.5 py-0 ${PLAN_COLORS[p.plan] || ''}`}>{p.plan}</Badge>
                  <Badge className={`text-[10px] px-1.5 py-0 ${
                    p.status === 'approved' ? 'bg-green-100 text-green-700' :
                    p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{p.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  ฿{Number(p.amount || 0).toLocaleString()} · {p.method} · {p.submitted_at ? format(parseISO(p.submitted_at), 'dd MMM yy HH:mm') : ''}
                </p>
                {p.note && <p className="text-xs text-muted-foreground italic">{p.note}</p>}
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                {p.slip_url && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSlipUrl(p.slip_url)}>
                    ดูสลิป
                  </Button>
                )}
                {p.status === 'pending' && (
                  <>
                    <Button size="sm" className="h-7 gap-1 text-xs" disabled={approve.isPending}
                      onClick={() => approve.mutate(p.id, { onSuccess: () => toast({ title: 'อนุมัติสำเร็จ' }), onError: (e: any) => toast({ title: e.message, variant: 'destructive' }) })}>
                      <Check size={11} /> อนุมัติ
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs"
                      onClick={() => { setRejectId(p.id); setRejectNote(''); }}>
                      <X size={11} /> ปฏิเสธ
                    </Button>
                  </>
                )}
                {p.status !== 'approved' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 size={13} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>ลบรายการชำระเงิน?</AlertDialogTitle>
                        <AlertDialogDescription>ลบรายการนี้ออกจากระบบ ไม่สามารถกู้คืนได้</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                          onClick={() => deletePayment.mutate(p.id, {
                            onSuccess: () => toast({ title: 'ลบรายการแล้ว' }),
                            onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
                          })}>ลบถาวร</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Slip preview */}
      <Dialog open={!!slipUrl} onOpenChange={o => !o && setSlipUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>ใบโอนเงิน / Slip</DialogTitle></DialogHeader>
          {slipUrl && <img src={slipUrl} alt="slip" className="w-full rounded-lg object-contain max-h-[70vh]" />}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectId} onOpenChange={o => !o && setRejectId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>ปฏิเสธการชำระเงิน</DialogTitle></DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs">เหตุผล (ส่งให้ลูกค้าเห็น)</Label>
            <Input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="เช่น ยอดไม่ถูกต้อง" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectId(null)}>ยกเลิก</Button>
            <Button variant="destructive" disabled={reject.isPending} onClick={() => {
              if (!rejectId) return;
              reject.mutate({ paymentId: rejectId, note: rejectNote || 'ปฏิเสธโดย superadmin' }, {
                onSuccess: () => { toast({ title: 'ปฏิเสธแล้ว' }); setRejectId(null); },
              });
            }}>{reject.isPending ? <Loader2 size={13} className="animate-spin" /> : 'ยืนยันการปฏิเสธ'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────

function UsersTab() {
  const [search, setSearch] = useState('');
  const { data: users = [], isLoading } = useSuperAdminUsers(search);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ display_name: '', email: '', password: '' });

  return (
    <div className="space-y-3 mt-2">
      <Input placeholder="ค้นหา email, ชื่อ, บริษัท..." value={search}
        onChange={e => setSearch(e.target.value)} className="max-w-sm h-8 text-sm" />

      {isLoading && <Loader className="py-8" />}

      <div className="space-y-1.5">
        {users.map((u: any) => (
          <div key={`${u.id}-${u.tenant_id}`} className="flex items-center gap-3 p-3 rounded-xl border bg-card shadow-sm">
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="font-medium text-sm truncate">{u.display_name || u.email}</p>
              <p className="text-xs text-muted-foreground truncate">{u.email} · {u.tenant_name}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <Badge className={`text-[10px] px-1.5 py-0 ${PLAN_COLORS[u.plan] || ''}`}>{u.plan}</Badge>
              {u.is_admin ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">แอดมิน</Badge> : null}
              {u.is_superadmin ? <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700"><ShieldCheck size={10} className="mr-0.5" />ซุปเปอร์</Badge> : null}

              {/* Edit */}
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-0.5"
                onClick={() => { setEditUser(u); setEditForm({ display_name: u.display_name || '', email: u.email, password: '' }); }}>
                <Pencil size={9} className="mr-0.5" />แก้ไข
              </Button>

              {/* Active toggle */}
              <Button size="sm" variant={u.is_active ? 'outline' : 'destructive'} className="h-6 text-[10px] px-2"
                onClick={() => {
                  const next = u.is_active ? 0 : 1;
                  updateUser.mutate({ id: u.id, is_active: next }, {
                    onSuccess: () => toast({ title: `${u.email} ${next ? 'เปิดใช้งาน' : 'ระงับ'}แล้ว` }),
                  });
                }}>
                {u.is_active ? <><Ban size={10} className="mr-0.5" />ระงับ</> : <><Check size={10} className="mr-0.5" />เปิดใช้</>}
              </Button>

              {/* Superadmin toggle */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className={`h-6 text-[10px] px-2 ${u.is_superadmin ? 'text-amber-600' : 'text-muted-foreground'}`}>
                    <ShieldCheck size={11} className="mr-0.5" />{u.is_superadmin ? 'ถอน Super' : 'ให้ Super'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{u.is_superadmin ? 'ถอนสิทธิ์ Superadmin' : 'ให้สิทธิ์ Superadmin'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {u.is_superadmin
                        ? `ถอนสิทธิ์ superadmin ของ ${u.email} จะไม่สามารถเข้าหน้า SuperAdmin ได้อีก`
                        : `ให้สิทธิ์ superadmin กับ ${u.email} จะสามารถจัดการ platform ทั้งหมดได้`}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction onClick={() => {
                      updateUser.mutate({ id: u.id, is_superadmin: u.is_superadmin ? 0 : 1 }, {
                        onSuccess: () => toast({ title: `อัปเดต superadmin สำหรับ ${u.email}` }),
                      });
                    }}>{u.is_superadmin ? 'ถอนสิทธิ์' : 'ให้สิทธิ์'}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Delete user */}
              {u.id !== me?.id && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive">
                      <Trash2 size={11} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ลบผู้ใช้ "{u.display_name || u.email}"?</AlertDialogTitle>
                      <AlertDialogDescription>ลบผู้ใช้ออกจาก platform ทั้งหมด ไม่สามารถกู้คืนได้</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                        onClick={() => deleteUser.mutate(u.id, {
                          onSuccess: () => toast({ title: `ลบ ${u.email} แล้ว` }),
                          onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
                        })}>ลบถาวร</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={o => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>แก้ไขผู้ใช้</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">ชื่อที่แสดง</Label>
              <Input value={editForm.display_name} onChange={e => setEditForm(x => ({ ...x, display_name: e.target.value }))} className="h-8 text-sm" placeholder="ชื่อที่แสดง" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">อีเมล</Label>
              <Input value={editForm.email} onChange={e => setEditForm(x => ({ ...x, email: e.target.value }))} className="h-8 text-sm" placeholder="อีเมล" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">รหัสผ่านใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)</Label>
              <Input type="password" value={editForm.password} onChange={e => setEditForm(x => ({ ...x, password: e.target.value }))} className="h-8 text-sm" placeholder="อย่างน้อย 6 ตัวอักษร" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>ยกเลิก</Button>
            <Button disabled={updateUser.isPending} onClick={() => {
              if (!editUser) return;
              const payload: any = { id: editUser.id, display_name: editForm.display_name, email: editForm.email };
              if (editForm.password) payload.password = editForm.password;
              updateUser.mutate(payload, {
                onSuccess: () => { toast({ title: 'บันทึกสำเร็จ' }); setEditUser(null); },
                onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
              });
            }}>
              {updateUser.isPending ? <Loader2 size={13} className="animate-spin" /> : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

function SettingsTab() {
  return (
    <div className="space-y-6 mt-2">
      <PlanLimitsSection />
      <PaymentMethodsSection />
    </div>
  );
}

function PlanLimitsSection() {
  const { data: limits = [], isLoading } = usePlanLimits();
  const updateLimit = useUpdatePlanLimit();
  const createLimit = useCreatePlanLimit();
  const deleteLimit = useDeletePlanLimit();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newPlan, setNewPlan] = useState({ plan: '', max_users: 5, price_thb: 0, trial_days: 0 });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">ขีดจำกัดแผน & ราคา</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setNewPlan({ plan: '', max_users: 5, price_thb: 0, trial_days: 0 }); setShowAdd(true); }}>
          <Plus size={12} /> เพิ่มแผน
        </Button>
      </div>

      {/* Add plan dialog */}
      <Dialog open={showAdd} onOpenChange={o => !o && setShowAdd(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>เพิ่มแผนใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">ชื่อแผน (a-z, 0-9, _ เท่านั้น)</Label>
              <Input value={newPlan.plan} onChange={e => setNewPlan(x => ({ ...x, plan: e.target.value }))} className="h-8 text-sm" placeholder="เช่น business" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">จำนวนผู้ใช้สูงสุด (0=ไม่จำกัด)</Label>
              <Input type="number" min={0} value={newPlan.max_users} onChange={e => setNewPlan(x => ({ ...x, max_users: +e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ราคา ฿/เดือน</Label>
              <Input type="number" min={0} value={newPlan.price_thb} onChange={e => setNewPlan(x => ({ ...x, price_thb: +e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">จำนวนวันทดลองใช้</Label>
              <Input type="number" min={0} value={newPlan.trial_days} onChange={e => setNewPlan(x => ({ ...x, trial_days: +e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>ยกเลิก</Button>
            <Button disabled={createLimit.isPending || !newPlan.plan.trim()} onClick={() => {
              createLimit.mutate(newPlan, {
                onSuccess: () => { toast({ title: `เพิ่มแผน "${newPlan.plan}" สำเร็จ` }); setShowAdd(false); },
                onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
              });
            }}>
              {createLimit.isPending ? <Loader2 size={13} className="animate-spin" /> : 'เพิ่มแผน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? <Loader className="py-8" /> : (
        <div className="space-y-3">
          {limits.map((pl: any) => {
            const ed = editing[pl.plan] ?? {};
            return (
              <Card key={pl.plan} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="w-36">
                      <p className="font-semibold capitalize text-sm">{pl.plan}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">฿{pl.price_thb}/เดือน</p>
                    </div>
                    <div className="flex flex-wrap gap-4 flex-1">
                      <div>
                        <Label className="text-xs text-muted-foreground">ผู้ใช้สูงสุด (0=ไม่จำกัด)</Label>
                        <Input type="number" min={0} defaultValue={pl.max_users} className="w-28 h-8 text-sm mt-1"
                          onChange={e => setEditing(x => ({ ...x, [pl.plan]: { ...ed, max_users: +e.target.value } }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">ราคา ฿/เดือน</Label>
                        <Input type="number" min={0} defaultValue={pl.price_thb} className="w-32 h-8 text-sm mt-1"
                          onChange={e => setEditing(x => ({ ...x, [pl.plan]: { ...ed, price_thb: +e.target.value } }))} />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">วันทดลองใช้</Label>
                        <Input type="number" min={0} defaultValue={pl.trial_days} className="w-24 h-8 text-sm mt-1"
                          onChange={e => setEditing(x => ({ ...x, [pl.plan]: { ...ed, trial_days: +e.target.value } }))} />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button size="sm" className="h-8" disabled={!editing[pl.plan] || updateLimit.isPending}
                          onClick={() => {
                            updateLimit.mutate({ plan: pl.plan, ...editing[pl.plan] }, {
                              onSuccess: () => {
                                toast({ title: `บันทึก ${pl.plan} สำเร็จ` });
                                setEditing(x => { const n = { ...x }; delete n[pl.plan]; return n; });
                              },
                              onError: () => toast({ title: 'บันทึกไม่สำเร็จ', variant: 'destructive' }),
                            });
                          }}>
                          {updateLimit.isPending ? <Loader2 size={13} className="animate-spin" /> : 'บันทึก'}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 size={13} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>ลบแผน "{pl.plan}"?</AlertDialogTitle>
                              <AlertDialogDescription>ไม่สามารถลบได้หากมีบริษัทใช้งานแผนนี้อยู่</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                                onClick={() => deleteLimit.mutate(pl.plan, {
                                  onSuccess: () => toast({ title: `ลบแผน "${pl.plan}" แล้ว` }),
                                  onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
                                })}>ลบ</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaymentMethodsSection() {
  const { data: methods = [], isLoading } = usePaymentMethodsAdmin();
  const updateMethod = useUpdatePaymentMethod();
  const createMethod = useCreatePaymentMethod();
  const deleteMethod = useDeletePaymentMethod();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Record<number, any>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newMethod, setNewMethod] = useState({ method: 'bank_transfer', label: '', account_name: '', account_number: '', qr_image_url: '' });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">ช่องทางการชำระเงิน</h3>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setNewMethod({ method: 'bank_transfer', label: '', account_name: '', account_number: '', qr_image_url: '' }); setShowAdd(true); }}>
          <Plus size={12} /> เพิ่มช่องทาง
        </Button>
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={o => !o && setShowAdd(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>เพิ่มช่องทางชำระเงิน</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>ประเภท</Label>
              <Select value={newMethod.method} onValueChange={v => setNewMethod(x => ({ ...x, method: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">โอนเงินผ่านธนาคาร</SelectItem>
                  <SelectItem value="qr">QR Code พร้อมเพย์</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ป้ายกำกับ *</Label>
              <Input value={newMethod.label} onChange={e => setNewMethod(x => ({ ...x, label: e.target.value }))} placeholder="เช่น กสิกรไทย" />
            </div>
            {newMethod.method === 'bank_transfer' && (
              <>
                <div className="space-y-1.5">
                  <Label>ชื่อบัญชี</Label>
                  <Input value={newMethod.account_name} onChange={e => setNewMethod(x => ({ ...x, account_name: e.target.value }))} placeholder="บริษัท ABC จำกัด" />
                </div>
                <div className="space-y-1.5">
                  <Label>เลขบัญชี</Label>
                  <Input value={newMethod.account_number} onChange={e => setNewMethod(x => ({ ...x, account_number: e.target.value }))} placeholder="000-0-00000-0" className="font-mono" />
                </div>
              </>
            )}
            {newMethod.method === 'qr' && (
              <div className="space-y-1.5">
                <Label>URL รูป QR Code</Label>
                <Input value={newMethod.qr_image_url} onChange={e => setNewMethod(x => ({ ...x, qr_image_url: e.target.value }))} placeholder="https://..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>ยกเลิก</Button>
            <Button disabled={!newMethod.label.trim() || createMethod.isPending}
              onClick={() => createMethod.mutate(newMethod, {
                onSuccess: () => { toast({ title: 'เพิ่มช่องทางสำเร็จ' }); setShowAdd(false); },
                onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
              })}>
              {createMethod.isPending ? <Loader2 size={13} className="animate-spin" /> : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? <Loader className="py-8" /> : (
        <div className="space-y-3">
          {methods.map((m: any) => {
            const ed = editing[m.id] ?? {};
            return (
              <Card key={m.id} className="border-0 shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm capitalize">{m.method === 'bank_transfer' ? 'โอนเงินธนาคาร' : 'QR Code'}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {m.is_active ? 'เปิดใช้งาน' : 'ปิด'}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => updateMethod.mutate({ id: m.id, is_active: m.is_active ? 0 : 1 }, {
                          onSuccess: () => toast({ title: `${m.is_active ? 'ปิด' : 'เปิด'}ช่องทางแล้ว` }),
                        })}>
                        {m.is_active ? <><EyeOff size={11} className="mr-1" />ปิด</> : <><Eye size={11} className="mr-1" />เปิด</>}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 size={13} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>ลบช่องทาง "{m.label}"?</AlertDialogTitle>
                            <AlertDialogDescription>ลบช่องทางชำระเงินนี้ออกจากระบบถาวร</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                              onClick={() => deleteMethod.mutate(m.id, {
                                onSuccess: () => toast({ title: 'ลบช่องทางแล้ว' }),
                                onError: (e: any) => toast({ title: e.message, variant: 'destructive' }),
                              })}>ลบถาวร</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">ป้ายกำกับ</Label>
                      <Input defaultValue={m.label} className="h-8 text-sm mt-1"
                        onChange={e => setEditing(x => ({ ...x, [m.id]: { ...(x[m.id] ?? {}), label: e.target.value } }))} />
                    </div>
                    {m.method !== 'qr' && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">ชื่อบัญชี</Label>
                          <Input defaultValue={m.account_name ?? ''} className="h-8 text-sm mt-1"
                            onChange={e => setEditing(x => ({ ...x, [m.id]: { ...(x[m.id] ?? {}), account_name: e.target.value } }))} />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">เลขบัญชี</Label>
                          <Input defaultValue={m.account_number ?? ''} className="h-8 text-sm mt-1 font-mono"
                            onChange={e => setEditing(x => ({ ...x, [m.id]: { ...(x[m.id] ?? {}), account_number: e.target.value } }))} />
                        </div>
                      </>
                    )}
                    {m.method === 'qr' && (
                      <div>
                        <Label className="text-xs text-muted-foreground">URL รูป QR Code</Label>
                        <Input defaultValue={m.qr_image_url ?? ''} className="h-8 text-sm mt-1"
                          placeholder="https://..." onChange={e => setEditing(x => ({ ...x, [m.id]: { ...(x[m.id] ?? {}), qr_image_url: e.target.value } }))} />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" className="h-7 text-xs" disabled={!editing[m.id] || updateMethod.isPending}
                      onClick={() => {
                        updateMethod.mutate({ id: m.id, ...editing[m.id] }, {
                          onSuccess: () => {
                            toast({ title: 'บันทึกสำเร็จ' });
                            setEditing(x => { const n = { ...x }; delete n[m.id]; return n; });
                          },
                          onError: () => toast({ title: 'บันทึกไม่สำเร็จ', variant: 'destructive' }),
                        });
                      }}>
                      {updateMethod.isPending ? <Loader2 size={12} className="animate-spin" /> : 'บันทึก'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function Loader({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
