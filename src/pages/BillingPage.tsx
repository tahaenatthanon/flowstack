import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Loader2, CreditCard, Clock, AlertCircle, CheckCircle2, Users, Calendar } from 'lucide-react';
import PageShell from '@/components/PageShell';
import { useToast } from '@/hooks/use-toast';
import {
  useBillingStatus, useInvoices, usePaymentMethods, usePlanLimits,
  useCreateInvoice, useSubmitPayment, useUploadSlip,
} from '@/hooks/useBilling';
import { format, parseISO, differenceInDays } from 'date-fns';

const PLAN_LABELS: Record<string, string> = {
  trial: 'ทดลองใช้',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};
const PLAN_COLORS: Record<string, string> = {
  trial: 'bg-slate-100 text-slate-700',
  starter: 'bg-blue-100 text-blue-700',
  pro: 'bg-violet-100 text-violet-700',
  enterprise: 'bg-amber-100 text-amber-700',
};

export default function BillingPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isExpiredRedirect = searchParams.get('expired') === '1';

  const { data: status, isLoading: statusLoading } = useBillingStatus();
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices();
  const { data: methods = [] } = usePaymentMethods();
  const { data: planLimits = [] } = usePlanLimits();

  const createInvoice = useCreateInvoice();
  const submitPayment = useSubmitPayment();
  const uploadSlip    = useUploadSlip();

  const [payDialog, setPayDialog]   = useState<{ invoiceId: string; amount: number } | null>(null);
  const [payMethod, setPayMethod]   = useState<string>('qr');
  const [slipFile, setSlipFile]     = useState<File | null>(null);
  const [note, setNote]             = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const handlePay = async () => {
    if (!payDialog) return;
    try {
      let slipUrl: string | undefined;
      if (slipFile) {
        const res = await uploadSlip.mutateAsync(slipFile);
        slipUrl = res.url;
      }
      await submitPayment.mutateAsync({
        invoice_id: payDialog.invoiceId,
        method: payMethod as 'qr' | 'bank_transfer',
        slip_url: slipUrl,
        note,
      });
      toast({ title: 'ส่งหลักฐานการชำระเงินแล้ว รอ superadmin ยืนยัน' });
      setPayDialog(null);
      setSlipFile(null);
      setNote('');
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const daysLeft = status?.expires_at ? differenceInDays(parseISO(status.expires_at), new Date()) : null;
  const upgradablePlans = planLimits.filter(
    p => p.plan !== 'trial' && p.plan !== status?.plan && Number(p.price_thb) > 0
  );
  const activeMethods = methods.filter(m => m.is_active);
  const defaultMethod = activeMethods[0]?.method ?? 'qr';

  return (
    <PageShell title="การสมัครสมาชิก" description="จัดการแผนและการชำระเงิน">
      {/* Expired banner */}
      {(status?.status === 'expired' || isExpiredRedirect) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">แผนของคุณหมดอายุแล้ว</p>
            <p className="text-sm text-red-600 mt-0.5">กรุณาชำระเงินหรืออัปเกรดแผนเพื่อใช้งานต่อ</p>
            <Button size="sm" className="mt-2" onClick={() => setUpgradeOpen(true)}>อัปเกรดแผนทันที</Button>
          </div>
        </div>
      )}

      {/* Trial expiry warning */}
      {status?.status === 'active' && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-700">
              {daysLeft === 0 ? 'แผนหมดอายุวันนี้' : `เหลืออีก ${daysLeft} วัน`}
            </p>
            <p className="text-sm text-amber-600 mt-0.5">กรุณาชำระเงินก่อนหมดอายุเพื่อใช้งานต่อเนื่อง</p>
          </div>
        </div>
      )}

      {/* Current plan card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4" /> แผนปัจจุบัน
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">แผน</p>
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{PLAN_LABELS[status?.plan ?? 'trial']}</p>
                <Badge className={`text-[10px] ${PLAN_COLORS[status?.plan ?? 'trial']}`}>
                  {status?.status === 'expired' ? 'หมดอายุ' : 'Active'}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Users size={11} /> Users</p>
              <p className="font-medium">{status?.current_users ?? 0} / {status?.max_users === 0 ? '∞' : status?.max_users ?? 1}</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden w-24">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: status?.max_users ? `${Math.min(100, ((status.current_users ?? 0) / status.max_users) * 100)}%` : '0%' }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar size={11} /> หมดอายุ</p>
              <p className="font-medium text-sm">
                {status?.expires_at ? format(parseISO(status.expires_at), 'dd MMM yyyy') : 'ไม่มีกำหนด'}
              </p>
              {daysLeft !== null && (
                <p className={`text-xs ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {daysLeft < 0 ? `เกินกำหนด ${Math.abs(daysLeft)} วัน` : `เหลือ ${daysLeft} วัน`}
                </p>
              )}
            </div>
            <div className="flex items-center">
              {status?.plan !== 'enterprise' && (
                <Button size="sm" onClick={() => setUpgradeOpen(true)}>อัปเกรดแผน</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ประวัติ Invoice</CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesLoading
            ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            : invoices.length === 0
              ? <p className="text-center text-muted-foreground py-8 text-sm">ยังไม่มี invoice</p>
              : (
                <div className="space-y-2">
                  {invoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm">Invoice #{inv.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">
                          {PLAN_LABELS[inv.plan] ?? inv.plan} · ครบกำหนด {format(parseISO(inv.due_date), 'dd MMM yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold tabular-nums">฿{Number(inv.amount).toLocaleString()}</span>
                        {inv.status === 'paid' && (
                          <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                            <CheckCircle2 size={10} /> ชำระแล้ว
                          </Badge>
                        )}
                        {inv.status === 'pending' && inv.last_payment_status === 'pending' && (
                          <Badge className="bg-amber-100 text-amber-700 text-xs gap-1">
                            <Clock size={10} /> รอยืนยัน
                          </Badge>
                        )}
                        {inv.status === 'pending' && inv.last_payment_status !== 'pending' && (
                          <Button size="sm" className="h-7 text-xs"
                            onClick={() => { setPayDialog({ invoiceId: inv.id, amount: inv.amount }); setPayMethod(defaultMethod); }}>
                            ชำระเงิน
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
          }
        </CardContent>
      </Card>

      {/* Payment dialog */}
      <Dialog open={!!payDialog} onOpenChange={(o) => { if (!o) { setPayDialog(null); setSlipFile(null); setNote(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ชำระเงิน ฿{payDialog?.amount?.toLocaleString()}</DialogTitle>
          </DialogHeader>

          {activeMethods.length > 0 ? (
            <Tabs value={payMethod} onValueChange={setPayMethod}>
              <TabsList className="w-full">
                {activeMethods.map(m => (
                  <TabsTrigger key={m.method} value={m.method} className="flex-1">{m.label}</TabsTrigger>
                ))}
              </TabsList>

              {activeMethods.map(m => (
                <TabsContent key={m.method} value={m.method} className="pt-3">
                  {m.method === 'qr' ? (
                    <div className="rounded-lg bg-slate-50 p-6 text-center space-y-3">
                      {m.qr_image_url ? (
                        <img src={m.qr_image_url} alt="QR" className="w-40 h-40 mx-auto object-contain" />
                      ) : (
                        <div className="w-40 h-40 bg-slate-200 rounded-lg mx-auto flex items-center justify-center text-xs text-slate-400">
                          QR Code
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">{m.label}</p>
                      <p className="text-xl font-bold">฿{payDialog?.amount?.toLocaleString()}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ธนาคาร</span>
                        <span className="font-medium">{m.label}</span>
                      </div>
                      {m.account_name && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ชื่อบัญชี</span>
                          <span className="font-medium">{m.account_name}</span>
                        </div>
                      )}
                      {m.account_number && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">เลขบัญชี</span>
                          <span className="font-mono font-bold">{m.account_number}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ยอดโอน</span>
                        <span className="font-bold text-primary text-base">฿{payDialog?.amount?.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">ไม่มีช่องทางการชำระเงิน กรุณาติดต่อผู้ดูแล</p>
          )}

          <div className="space-y-3 pt-1">
            <div>
              <Label>แนบสลิป / หลักฐานการโอน <span className="text-red-500">*</span></Label>
              <Input
                type="file"
                accept="image/*,application/pdf"
                className="mt-1.5"
                onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
              />
              {slipFile && <p className="text-xs text-green-600 mt-1">✓ {slipFile.name}</p>}
            </div>
            <div>
              <Label>หมายเหตุ (ถ้ามี)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" placeholder="เช่น โอนวันที่..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayDialog(null); setSlipFile(null); setNote(''); }}>ยกเลิก</Button>
            <Button
              disabled={!slipFile || submitPayment.isPending || uploadSlip.isPending}
              onClick={handlePay}
            >
              {(submitPayment.isPending || uploadSlip.isPending)
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : null}
              ส่งหลักฐาน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade dialog */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>อัปเกรดแผน</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            {upgradablePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">ไม่มีแผนที่สามารถอัปเกรดได้</p>
            ) : (
              upgradablePlans.map((p) => (
                <div key={p.plan} className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="space-y-0.5">
                    <p className="font-semibold">{PLAN_LABELS[p.plan] ?? p.plan}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.max_users === 0 ? 'Unlimited' : `${p.max_users} users`} · ฿{Number(p.price_thb).toLocaleString()}/เดือน
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={createInvoice.isPending}
                    onClick={async () => {
                      await createInvoice.mutateAsync(p.plan);
                      toast({ title: `สร้าง invoice แผน ${PLAN_LABELS[p.plan]} สำเร็จ`, description: 'กรุณาชำระเงินในหน้า Invoice' });
                      setUpgradeOpen(false);
                    }}
                  >
                    {createInvoice.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'เลือก'}
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
