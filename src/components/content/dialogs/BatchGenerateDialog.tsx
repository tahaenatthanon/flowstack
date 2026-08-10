import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useContentSkills, useBrandContexts, useContentTriggers } from '@/hooks/useContent';
import type { ContentPlan } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Wand2, Zap, Sparkles, CheckCircle2, ListTodo, Loader2, ChevronRight, RefreshCw, Plus } from 'lucide-react';

export function BatchGenerateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [topic, setTopic]           = useState('');
  const [niche, setNiche]           = useState('');
  const [selPlatforms, setSelPlatforms] = useState<string[]>([]);
  const [language, setLanguage]     = useState('thai');
  const [days, setDays]             = useState('7');
  const [startDate, setStartDate]   = useState(() => new Date().toISOString().split('T')[0]);
  const [step, setStep]             = useState<'form' | 'progress' | 'done'>('form');
  const [plan, setPlan]             = useState<ContentPlan | null>(null);
  const [progress, setProgress]     = useState(0);
  const [total, setTotal]           = useState(0);
  const [selSkillId, setSelSkillId] = useState('__none__');
  const [selContextIds, setSelContextIds] = useState<string[]>([]);

  const { data: skills   = [] } = useContentSkills(open);
  const { data: contexts = [] } = useBrandContexts(open);
  const { data: triggers = [] } = useContentTriggers(open);

  const handleReset = () => {
    setTopic(''); setNiche(''); setSelPlatforms([]); setLanguage('thai');
    setDays('7'); setStartDate(new Date().toISOString().split('T')[0]);
    setStep('form'); setPlan(null); setProgress(0); setTotal(0);
    setSelSkillId('__none__'); setSelContextIds([]);
  };

  const handleClose = (v: boolean) => {
    if (!v && step === 'progress') return;
    if (!v) handleReset();
    onOpenChange(v);
  };

  const handleStart = async () => {
    if (!topic.trim()) return;
    setStep('progress');
    try {
      const result: ContentPlan = await apiFetch('/brand-content.php?action=generate-plan', {
        method: 'POST',
        body: JSON.stringify({
          trigger_command: `${topic.trim()}${niche ? ` (${niche})` : ''}${language === 'english' ? ' [English]' : ''}`,
          skill_id: selSkillId === '__none__' ? null : selSkillId,
          brand_context_ids: selContextIds,
          week_start: startDate,
          platforms: selPlatforms.length > 0 ? selPlatforms : ['facebook'],
          days: parseInt(days, 10) || 7,
        }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      setPlan(result);

      // Now batch generate articles
      const items = result.items ?? [];
      setTotal(items.length);
      setProgress(0);
      for (let i = 0; i < items.length; i++) {
        try {
          await apiFetch('/brand-content.php?action=generate-article', {
            method: 'POST',
            body: JSON.stringify({ item_id: items[i].id }),
          });
        } catch { /* continue on individual failure */ }
        setProgress(i + 1);
      }
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      setStep('done');
      toast({ title: `สร้าง content ${items.length} ชิ้นสำเร็จ! 🎉` });
    } catch (e: any) {
      toast({ title: 'สร้างไม่สำเร็จ', description: e.message, variant: 'destructive' });
      setStep('form');
    }
  };

  const daysNum = parseInt(days, 10) || 7;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Wand2 className="h-5 w-5 text-violet-600" />Batch สร้างคอนเทนต์
          </DialogTitle>
          <DialogDescription>
            กรอกหัวข้อครั้งเดียว — AI สร้างแผน + บทความ + Script ทุก platform ให้อัตโนมัติ โดยใช้ Knowledge Base และ Skills ที่ตั้งไว้
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-5">
            <div className="rounded-xl border p-5 space-y-4">
              <h3 className="font-semibold text-base">ตั้งค่า</h3>
              <div className="space-y-1.5">
                <Label>หัวข้อ/ธีมหลัก <span className="text-destructive">*</span></Label>
                <Input value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="เช่น AI สร้างรายได้ปี 2026"
                  className="text-base" />
              </div>
              {triggers.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">หรือเลือก Trigger</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {triggers.map(tr => (
                      <button key={tr.id} type="button"
                        onClick={() => { setTopic(tr.command); if (tr.skill_id) setSelSkillId(tr.skill_id); }}
                        className="text-[11px] px-2 py-1 rounded border hover:bg-muted font-mono gap-1 flex items-center">
                        <Zap className="h-3 w-3 text-amber-500" />"{tr.command}"
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Niche (ถ้ามี)</Label>
                  <Input value={niche} onChange={e => setNiche(e.target.value)}
                    placeholder="เช่น ร้านค้าออนไลน์, อาหารเสริม" />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    แพลตฟอร์ม ({selPlatforms.length === 0 ? 'ทั้งหมด' : selPlatforms.length})
                  </Label>
                  <div className="flex flex-wrap gap-1 p-1.5 border rounded-md min-h-[32px] bg-background">
                    {Object.entries(PLATFORM_MAP).map(([key, val]) => {
                      const sel = selPlatforms.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelPlatforms(ids =>
                            sel ? ids.filter(x => x !== key) : [...ids, key]
                          )}
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                            sel ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                          )}
                        >
                          {val.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>ภาษา</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="thai">ไทย</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>จำนวนวัน</Label>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[3,5,7,10,14,30].map(d => <SelectItem key={d} value={String(d)}>{d} วัน</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>เริ่มวันที่</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
              </div>
              {/* Skill */}
              <div className="space-y-1.5">
                <Label>Skill</Label>
                <Select value={selSkillId} onValueChange={setSelSkillId}>
                  <SelectTrigger><SelectValue placeholder="ไม่เลือก Skill" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">ไม่เลือก Skill</SelectItem>
                    {skills.map(sk => <SelectItem key={sk.id} value={sk.id}>{sk.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {/* Knowledge Base */}
              <div className="space-y-1.5">
                <Label>Knowledge Base ({selContextIds.length === 0 ? 'ทั้งหมด' : `${selContextIds.length} ไฟล์`})</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[38px] bg-background items-center">
                  {contexts.map(ctx => {
                    const sel = selContextIds.includes(ctx.id);
                    return (
                      <button key={ctx.id} type="button"
                        onClick={() => setSelContextIds(ids => sel ? ids.filter(x => x !== ctx.id) : [...ids, ctx.id])}
                        className={cn('text-[11px] px-2 py-0.5 rounded-full border transition-colors', sel ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>
                        {ctx.name}
                      </button>
                    );
                  })}
                  {contexts.length === 0 && <span className="text-xs text-muted-foreground">ยังไม่มี Context (ดึงทั้งหมดอัตโนมัติ)</span>}
                </div>
              </div>
            </div>
            <Button className="w-full h-12 text-base font-semibold gap-2" disabled={!topic.trim()} onClick={handleStart}>
              <Sparkles className="h-5 w-5" />เริ่มสร้าง {daysNum} ชิ้น
            </Button>
          </div>
        )}

        {(step === 'progress' || step === 'done') && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              {step === 'progress' && total === 0 && (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>กำลังสร้างแผน...</span>
                </div>
              )}
              {(total > 0 || step === 'done') && (
                <>
                  <p className="font-semibold text-lg">{step === 'done' ? '✅ เสร็จแล้ว!' : `กำลังสร้าง... ${progress}/${total}`}</p>
                  {plan && <p className="text-sm text-muted-foreground">{plan.title}</p>}
                </>
              )}
            </div>
            {total > 0 && (
              <>
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-500 rounded-full"
                      style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground text-right">{Math.round(total > 0 ? (progress / total) * 100 : 0)}%</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: total }).map((_, i) => (
                    <div key={i} className={cn('rounded-lg border p-3 text-center text-sm font-medium transition-all',
                      i < progress ? 'bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300'
                        : i === progress && step === 'progress' ? 'bg-primary/10 border-primary text-primary animate-pulse'
                        : 'bg-muted/30 text-muted-foreground')}>
                      <div className="text-xs text-muted-foreground mb-1">Day {i + 1}</div>
                      {i < progress ? '✓' : i === progress && step === 'progress' ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : '○'}
                    </div>
                  ))}
                </div>
              </>
            )}
            {step === 'done' && (
              <Button className="w-full h-11 font-semibold gap-2" onClick={() => { handleClose(false); navigate('/content'); }}>
                <CheckCircle2 className="h-4 w-4" />ดูผลงานทั้งหมด
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
