import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useContentSkills, useBrandContexts, useContentTriggers } from '@/hooks/useContent';
import { useResearchRun, RESEARCH_STEP_LABELS } from '@/hooks/useResearchRun';
import type { ContentPlan } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Plus, Wand2, Sparkles, FileText, Play, Loader2, ArrowRight, RefreshCw, Send, ImagePlus, PenTool, Zap, CheckCircle2, ChevronRight } from 'lucide-react';

export default function QuickCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [contentType, setContentType] = useState<'article' | 'video' | null>(null);
  const [topic, setTopic]             = useState('');
  const [selPlatforms, setSelPlatforms] = useState<string[]>([]);
  const [tone, setTone]               = useState<'friendly' | 'professional' | 'educational' | 'storytelling'>('friendly');
  const [scriptStyle, setScriptStyle] = useState<'hook-story' | 'educational' | 'storytelling' | 'vsl'>('hook-story');
  const [duration, setDuration]       = useState<'15s' | '30s' | '60s' | '3min' | '10min+'>('60s');
  const [selSkillId, setSelSkillId]   = useState('__none__');
  const [selContextIds, setSelContextIds] = useState<string[]>([]);
  const [step, setStep]               = useState<'type' | 'form' | 'progress' | 'done'>('type');
  const [doneTitle, setDoneTitle]     = useState('');
  const [researchEnabled, setResearchEnabled] = useState(false);

  const { run: runResearch, step: researchStep } = useResearchRun();

  const { data: skills   = [] } = useContentSkills(open);
  const { data: contexts = [] } = useBrandContexts(open);
  const { data: triggers = [] } = useContentTriggers(open);

  const handleReset = () => {
    setContentType(null); setTopic(''); setSelPlatforms([]); setTone('friendly');
    setScriptStyle('hook-story'); setDuration('60s');
    setSelSkillId('__none__'); setSelContextIds([]); setStep('type'); setDoneTitle('');
    setResearchEnabled(false);
  };

  const handleClose = (v: boolean) => {
    if (!v && step === 'progress') return;
    if (!v) handleReset();
    onOpenChange(v);
  };

  const handleSelectType = (type: 'article' | 'video') => {
    setContentType(type);
    setSelPlatforms(type === 'video' ? ['tiktok'] : ['facebook']);
    setStep('form');
  };

  const handleCreate = async () => {
    if (!topic.trim() || !contentType) return;
    setStep('progress');
    const toneLabels  = { friendly: 'กันเอง', professional: 'ทางการ', educational: 'ให้ความรู้', storytelling: 'เล่าเรื่อง' };
    const styleLabels = { 'hook-story': 'Hook-Story-CTA', educational: 'Educational', storytelling: 'Storytelling', vsl: 'VSL' };
    const platList = selPlatforms.length > 0 ? selPlatforms : (contentType === 'video' ? ['tiktok'] : ['facebook']);
    const cmd = contentType === 'video'
      ? `${topic.trim()} [VIDEO] [script:${styleLabels[scriptStyle]}] [duration:${duration}]`
      : `${topic.trim()} [tone:${toneLabels[tone]}]`;
    try {
      const result: ContentPlan = await apiFetch('/brand-content.php?action=generate-plan', {
        method: 'POST',
        body: JSON.stringify({
          trigger_command: cmd,
          skill_id: selSkillId === '__none__' ? null : selSkillId,
          brand_context_ids: selContextIds,
          week_start: new Date().toISOString().split('T')[0],
          platforms: platList,
          days: 1,
        }),
      });
      qc.invalidateQueries({ queryKey: ['content', 'plans'] });
      const item = result.items?.[0];
      if (item) {
        if (researchEnabled) {
          await runResearch({ topic: topic.trim(), itemId: item.id });
          setDoneTitle(item.topic);
        } else {
          const art = await apiFetch('/brand-content.php?action=generate-article', {
            method: 'POST',
            body: JSON.stringify({ item_id: item.id }),
          });
          setDoneTitle(art?.article?.title ?? item.topic);
        }
      }
      qc.invalidateQueries({ queryKey: ['content', 'items'] });
      setStep('done');
      toast({ title: `สร้าง${contentType === 'video' ? 'วีดีโอสคริปต์' : 'บทความ'}สำเร็จ! 🎉` });
    } catch (e: any) {
      toast({ title: 'สร้างไม่สำเร็จ', description: e.message, variant: 'destructive' });
      setStep('form');
    }
  };

  const ARTICLE_PLATFORMS = ['facebook', 'linkedin', 'twitter', 'instagram', 'lineoa', 'wordpress', 'wix', 'custom'];
  const VIDEO_PLATFORMS   = ['tiktok', 'youtube', 'instagram', 'custom'];
  const platformOptions = contentType === 'video' ? VIDEO_PLATFORMS : ARTICLE_PLATFORMS;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />สร้างคอนเทนต์
          </DialogTitle>
          <DialogDescription>
            {step === 'type'
              ? 'เลือกประเภทคอนเทนต์ที่ต้องการสร้าง'
              : contentType === 'video' ? 'วีดีโอสคริปต์ · TikTok · YouTube · Instagram Reels'
              : 'บทความ · โพสต์โซเชียล · จดหมายข่าว'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Type selection ── */}
        {step === 'type' && (
          <div className="grid grid-cols-2 gap-3 py-2">
            <button type="button" onClick={() => handleSelectType('article')}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-center">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-950 group-hover:bg-blue-200 dark:group-hover:bg-blue-900 transition-colors">
                <FileText className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">บทความ & โซเชียล</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">บล็อก · Facebook<br/>LinkedIn · จดหมายข่าว</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium">
                พาดหัว · สคริปต์ · แฮชแท็ก
              </span>
            </button>
            <button type="button" onClick={() => handleSelectType('video')}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-border hover:border-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all text-center">
              <div className="p-3 rounded-xl bg-red-100 dark:bg-red-950 group-hover:bg-red-200 dark:group-hover:bg-red-900 transition-colors">
                <Play className="h-7 w-7 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">วีดีโอสคริปต์</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">TikTok · YouTube<br/>Instagram Reels</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-medium">
                ฮุก · สคริปต์ · ภาพประกอบ
              </span>
            </button>
          </div>
        )}

        {/* ── Step 2: Form ── */}
        {step === 'form' && (
          <div className="space-y-4">
            {/* Back to type selection */}
            <button type="button" onClick={() => setStep('type')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors -mt-1">
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              {contentType === 'video' ? '🎬 วีดีโอสคริปต์' : '📝 บทความ & โซเชียล'}
              <span className="text-muted-foreground/50">· เปลี่ยนประเภท</span>
            </button>
            {/* Topic */}
            <div className="space-y-1.5">
              <Label>หัวข้อ <span className="text-destructive">*</span></Label>
              <Input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder={contentType === 'video'
                  ? 'เช่น "5 วิธีใช้ AI สร้างรายได้ปี 2026"'
                  : 'เช่น "5 เหตุผลที่ธุรกิจต้องใช้ AI ปี 2026"'} />
            </div>
            {/* Trigger shortcuts */}
            {triggers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">เลือก Trigger</Label>
                <div className="flex flex-wrap gap-1.5">
                  {triggers.map(tr => (
                    <button key={tr.id} type="button"
                      onClick={() => { setTopic(tr.command); if (tr.skill_id) setSelSkillId(tr.skill_id); }}
                      className="text-[11px] px-2 py-1 rounded border hover:bg-muted font-mono flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-500" />"{tr.command}"
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Platform multi-select */}
            <div className="space-y-1.5">
              <Label>
                แพลตฟอร์ม ({selPlatforms.length === 0 ? 'ทั้งหมด' : selPlatforms.length})
              </Label>
              <div className="flex flex-wrap gap-1 p-1.5 border rounded-md min-h-[32px] bg-background">
                {platformOptions.map(key => {
                  const val = PLATFORM_MAP[key];
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
                      {val?.label || key}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Article: Tone selector */}
            {contentType === 'article' && (
              <div className="space-y-1.5">
                <Label>โทนเสียง</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'friendly',     label: '😊 กันเอง',     desc: 'อบอุ่น เป็นกันเอง' },
                    { value: 'professional', label: '💼 ทางการ',     desc: 'มืออาชีพ น่าเชื่อถือ' },
                    { value: 'educational',  label: '🎓 ให้ความรู้', desc: 'สาระ เข้าใจง่าย' },
                    { value: 'storytelling', label: '📖 เล่าเรื่อง', desc: 'น่าสนใจ ดึงดูด' },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button" onClick={() => setTone(opt.value)}
                      className={cn('flex flex-col items-start p-2.5 rounded-lg border text-left text-xs transition-all',
                        tone === opt.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-muted-foreground hover:bg-muted/30')}>
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Video: Script Style + Duration */}
            {contentType === 'video' && (
              <>
                <div className="space-y-1.5">
                  <Label>รูปแบบสคริปต์</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: 'hook-story',   label: '🔥 ฮุก-เรื่อง-CTA',  desc: 'ไวรัล · เน้น engagement' },
                      { value: 'educational',  label: '🎓 ให้ความรู้',      desc: 'สอน · เข้าใจง่าย' },
                      { value: 'storytelling', label: '📖 เล่าเรื่อง',      desc: 'เล่าเรื่อง · อารมณ์' },
                      { value: 'vsl',          label: '💰 VSL (ขายตรง)',    desc: 'ขาย · เพิ่มยอดแปลง' },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button" onClick={() => setScriptStyle(opt.value)}
                        className={cn('flex flex-col items-start p-2.5 rounded-lg border text-left text-xs transition-all',
                          scriptStyle === opt.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-muted-foreground hover:bg-muted/30')}>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>ความยาววีดีโอ</Label>
                  <div className="flex gap-2 flex-wrap">
                    {(['15s', '30s', '60s', '3min', '10min+'] as const).map(d => (
                      <button key={d} type="button" onClick={() => setDuration(d)}
                        className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                          duration === d
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:bg-muted')}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
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
            {/* AI Research toggle */}
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">ใช้ AI Research</Label>
                <p className="text-[11px] text-muted-foreground">ค้นข้อมูลเว็บจริง → วิเคราะห์ → เขียนบทความ (ใช้เวลามากขึ้น)</p>
              </div>
              <Switch checked={researchEnabled} onCheckedChange={setResearchEnabled} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>ยกเลิก</Button>
              <Button disabled={!topic.trim()} onClick={handleCreate} className="gap-2">
                <Sparkles className="h-4 w-4" />สร้าง{contentType === 'video' ? 'วีดีโอสคริปต์' : 'บทความ'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'progress' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">AI กำลังสร้าง{contentType === 'video' ? 'วีดีโอสคริปต์' : 'บทความ'}...</p>
            {researchEnabled ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {(['fetching', 'analyzing', 'generating'] as const).map((s, i) => (
                  <span key={s} className={cn('flex items-center gap-1', i > 0 && 'ml-1')}>
                    {researchStep === s
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : researchStep === 'done' || (['fetching','analyzing','generating'].indexOf(researchStep) > i)
                        ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                        : <span className="h-3 w-3 rounded-full border" />}
                    {RESEARCH_STEP_LABELS[s]}
                    {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">ขั้นตอน: สร้างแผน → สร้างเนื้อหา</p>
            )}
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <div className="text-center">
              <p className="font-semibold text-lg">สร้างสำเร็จ! 🎉</p>
              {doneTitle && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doneTitle}</p>}
            </div>
            <Button onClick={() => { handleClose(false); navigate('/content'); }} className="gap-2">
              <PenTool className="h-4 w-4" />ดูผลงานทั้งหมด
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
