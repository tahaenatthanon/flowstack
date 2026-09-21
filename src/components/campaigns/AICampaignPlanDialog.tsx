import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { marketingKeys } from '@/hooks/useMarketing';
import { emailTemplates } from '@/data/emailTemplates';
import ProductPicker from './ProductPicker';

interface PlannedCampaign {
  id: string;
  subject: string;
  scheduled_at: string;
  sequence: number;
}

interface AICampaignPlanDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function AICampaignPlanDialog({ open, onOpenChange }: AICampaignPlanDialogProps) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const qc = useQueryClient();

  const [productIds, setProductIds] = useState<string[]>([]);
  const [topicIdea, setTopicIdea] = useState('');
  const [useBrandContext, setUseBrandContext] = useState(false);
  const [count, setCount] = useState(3);
  const [intervalDays, setIntervalDays] = useState(3);
  const [startDate, setStartDate] = useState(todayLocalISO());
  const [tone, setTone] = useState<'auto' | 'friendly' | 'formal' | 'educational' | 'storytelling'>('auto');
  const [step, setStep] = useState<'form' | 'progress' | 'done'>('form');
  const [createdCampaigns, setCreatedCampaigns] = useState<PlannedCampaign[]>([]);

  const reset = () => {
    setProductIds([]); setTopicIdea(''); setUseBrandContext(false);
    setCount(3); setIntervalDays(3); setStartDate(todayLocalISO());
    setTone('auto'); setStep('form'); setCreatedCampaigns([]);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleGenerate = async () => {
    const ok = await confirm({
      title: 'ยืนยันวางแผนแคมเปญ',
      description: `AI จะสร้างแคมเปญ ${count} ฉบับ ห่างกัน ${intervalDays} วัน เริ่มจาก ${startDate} — ทุกฉบับจะถูกบันทึกเป็น "ฉบับร่าง" เท่านั้น จะไม่ถูกส่งจนกว่าคุณจะอนุมัติ/ตั้งเวลาส่งเองทีละฉบับ`,
      confirmLabel: 'ยืนยันและสร้าง',
    });
    if (!ok) return;

    setStep('progress');
    try {
      const result: any = await apiFetch('/email-campaigns.php?action=ai-plan', {
        method: 'POST',
        body: JSON.stringify({
          product_id: productIds[0],
          topic_idea: topicIdea.trim(),
          use_brand_context: useBrandContext,
          count,
          interval_days: intervalDays,
          start_date: startDate,
          tone,
          // ส่ง template เต็มก้อน — batch generate compose HTML (chrome + เนื้อหา + CTA)
          // ฝั่ง PHP ล้วน ไม่มี frontend คั่นกลาง จึงต้องใช้ html/hasCta/heading_color/
          // body_color/text_align ของ template ด้วย ไม่ใช่แค่ id/nameTH เหมือนก่อนหน้า
          templates: emailTemplates,
        }),
      });
      setCreatedCampaigns(result?.campaigns ?? []);
      qc.invalidateQueries({ queryKey: marketingKeys.campaigns() });
      setStep('done');
      if (result?.brand_context_found === false) {
        toast({ title: 'ยังไม่มีข้อมูลแบรนด์ในระบบ', description: 'ข้ามการใช้บริบทนี้ — อัปโหลด brand.md ได้ที่หน้าตั้งค่าแบรนด์' });
      }
    } catch (e: any) {
      toast({ title: 'วางแผนแคมเปญไม่สำเร็จ', description: e.message, variant: 'destructive' });
      setStep('form');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />AI วางแผนแคมเปญ
          </DialogTitle>
          <DialogDescription>
            AI จะเขียนแคมเปญหลายฉบับให้ล่วงหน้า ทุกฉบับเป็นฉบับร่างที่ต้องอนุมัติเองก่อนส่ง
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">แนวคิด/ธีมของชุดแคมเปญ (ไม่บังคับ)</Label>
              <Textarea rows={2} value={topicIdea} onChange={e => setTopicIdea(e.target.value)}
                placeholder="เช่น ชุดอีเมลเกี่ยวกับโปรโมชั่นสงกรานต์ หรือประกาศเปิดสาขาใหม่" />
            </div>
            <div className="grid gap-1.5">
              <Label>เลือกสินค้า (ไม่บังคับ)</Label>
              <ProductPicker value={productIds} onChange={setProductIds} max={1} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="batch-use-brand-context" checked={useBrandContext}
                onCheckedChange={(v) => setUseBrandContext(v === true)} />
              <Label htmlFor="batch-use-brand-context" className="text-xs font-normal cursor-pointer">
                ใช้ข้อมูลแบรนด์ (brand.md) เป็นบริบทให้ AI
              </Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ต้องมีอย่างน้อยหนึ่งอย่าง: แนวคิด/ธีม, สินค้า, หรือใช้ข้อมูลแบรนด์ — ถ้ามีทั้งแนวคิดและสินค้า AI จะยึดแนวคิดเป็นทิศทางหลัก
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">จำนวนฉบับ</Label>
                <Input type="number" min={1} max={10} value={count} onChange={e => setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">ห่างกัน (วัน)</Label>
                <Input type="number" min={0} value={intervalDays} onChange={e => setIntervalDays(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">วันเริ่มต้น</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">โทนการเขียน</Label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'auto', label: '✨ ให้ AI เลือกเอง' },
                  { value: 'friendly', label: 'เป็นกันเอง' },
                  { value: 'formal', label: 'เป็นทางการ' },
                  { value: 'educational', label: 'ให้ความรู้' },
                  { value: 'storytelling', label: 'เล่าเรื่อง' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setTone(opt.value)}
                    className={cn('text-[11px] px-2 py-1 rounded border transition-colors',
                      tone === opt.value ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>ยกเลิก</Button>
              <Button disabled={productIds.length === 0 && !topicIdea.trim() && !useBrandContext} onClick={handleGenerate} className="gap-2">
                <Sparkles className="h-4 w-4" />สร้างแผน
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'progress' && (
          <div className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">AI กำลังเขียนแคมเปญ {count} ฉบับ... (อาจใช้เวลาสักครู่)</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-6 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">สร้างแผนสำเร็จ! 🎉</p>
              <p className="text-sm text-muted-foreground mt-1">สร้างแคมเปญร่างไว้ {createdCampaigns.length} ฉบับ — ตรวจสอบและอนุมัติทีละฉบับได้จากรายการแคมเปญ</p>
            </div>
            {createdCampaigns.length > 0 && (
              <div className="w-full space-y-1.5">
                {createdCampaigns.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded-md border bg-muted/30">
                    <span className="truncate flex-1">✓ ฉบับ {c.sequence} — {c.subject}</span>
                    <span className="text-muted-foreground shrink-0">{new Date(c.scheduled_at).toLocaleString('th-TH')}</span>
                  </div>
                ))}
              </div>
            )}
            <Button onClick={() => handleClose(false)}>ปิด</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
