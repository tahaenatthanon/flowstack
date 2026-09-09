import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useContentSkills, useBrandContexts, useContentTriggers } from '@/hooks/useContent';
import { useResearchRun, RESEARCH_STEP_LABELS } from '@/hooks/useResearchRun';
import type { ContentPlan } from '@/components/content/types';
import {
  getTriggerDisplayLabel, PLATFORM_MAP,
  ARTICLE_TONE_OPTIONS, VIDEO_SCRIPT_STYLE_OPTIONS, VIDEO_DURATION_OPTIONS, VIDEO_DURATION_SECONDS,
} from '@/components/content/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Wand2, Zap, Sparkles, CheckCircle2, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

type TopicProgressStatus = 'pending' | 'planning' | 'researching' | 'analyzing' | 'generating' | 'done' | 'partial' | 'failed';

/** Batch สร้างคอนเทนต์ต้องมีอย่างน้อย 3 หัวข้อต่อการรัน */
const MIN_TOPICS = 3;

export function BatchGenerateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const createTopic = () => ({
    topic: '', niche: '', contentType: 'article' as 'article' | 'video',
    platforms: [] as string[], triggerIds: [] as string[], skillIds: [] as string[],
    autoSkillIds: [] as string[], contextIds: [] as string[], language: '', openSettings: false,
    tone: 'friendly' as 'friendly' | 'formal' | 'educational' | 'storytelling',
    scriptStyle: 'hook-story' as 'hook-story' | 'educational' | 'storytelling' | 'vsl',
    duration: '60s' as '15s' | '30s' | '60s' | '3min' | '10min+',
  });
  const [topics, setTopics] = useState(() => Array.from({ length: MIN_TOPICS }, createTopic));
  const [days, setDays] = useState('7');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [step, setStep] = useState<'form' | 'progress' | 'done'>('form');
  const [showConfirm, setShowConfirm] = useState(false);
  const [plan, setPlan] = useState<ContentPlan | null>(null);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(-1);
  const [currentTopicStage, setCurrentTopicStage] = useState<TopicProgressStatus>('pending');
  const [topicStatuses, setTopicStatuses] = useState<TopicProgressStatus[]>([]);
  const [generatedDisplayCount, setGeneratedDisplayCount] = useState(0);

  const { data: skills = [] } = useContentSkills(open);
  const { data: contexts = [] } = useBrandContexts(open);
  const { data: triggers = [] } = useContentTriggers(open);

  const { run: runResearch, step: researchStep } = useResearchRun();

  useEffect(() => {
    if (step !== 'progress' || currentTopicIndex < 0 || currentTopicStage !== 'researching') return;
    const nextStatus: TopicProgressStatus = researchStep === 'analyzing'
      ? 'analyzing'
      : researchStep === 'generating'
        ? 'generating'
        : 'researching';
    setTopicStatuses(statuses => statuses.map((status, index) => index === currentTopicIndex ? nextStatus : status));
  }, [currentTopicIndex, currentTopicStage, researchStep, step]);

  const handleReset = () => {
    setTopics(Array.from({ length: MIN_TOPICS }, createTopic));
    setDays('7');
    setStartDate(new Date().toISOString().split('T')[0]);
    setStep('form');
    setShowConfirm(false);
    setPlan(null);
    setProgress(0);
    setTotal(0);
    setCurrentTopicIndex(-1);
    setCurrentTopicStage('pending');
    setTopicStatuses([]);
    setGeneratedDisplayCount(0);
  };

  const handleClose = (v: boolean) => {
    if (!v && step === 'progress') return;
    if (!v) handleReset();
    onOpenChange(v);
  };

  const handleStart = async () => {
    const filledCount = topics.filter(item => item.topic.trim()).length;
    if (filledCount < MIN_TOPICS) {
      toast({
        title: `ต้องมีหัวข้อคอนเทนต์อย่างน้อย ${MIN_TOPICS} หัวข้อ`,
        description: `ตอนนี้กรอกแล้ว ${filledCount} หัวข้อ — กรุณาเพิ่มหัวข้อให้ครบก่อนเริ่มสร้าง`,
        variant: 'destructive',
      });
      return;
    }

    const validationErrors = topics.flatMap((item, index) => {
      const missing: string[] = [];
      if (!item.topic.trim()) missing.push('ยังไม่ได้กรอกหัวข้อ');
      if (!item.platforms.length) missing.push('ยังไม่เลือกแพลตฟอร์ม');
      return missing.length > 0 ? `หัวข้อที่ ${index + 1}: ${missing.join(', ')}` : [];
    });

    if (validationErrors.length > 0) {
      toast({
        title: 'กรุณากรอกข้อมูลให้ครบก่อนเริ่มสร้าง',
        description: validationErrors.map(error => <div key={error}>{error}</div>),
        variant: 'destructive',
      });
      return;
    }

    setShowConfirm(true);
  };

  const handleConfirmStart = async () => {
    const validTopics = topics.filter(item => item.topic.trim());
    if (validTopics.length < MIN_TOPICS) return;

    setShowConfirm(false);
    setStep('progress');
    setPlan(null);
    setProgress(0);
    setTotal(0);
    setCurrentTopicIndex(0);
    setCurrentTopicStage('planning');
    setTopicStatuses(validTopics.map(() => 'pending'));
    setGeneratedDisplayCount(0);

    let generatedCount = 0;
    const errors: string[] = [];

    for (const [topicIndex, topicConfig] of validTopics.entries()) {
      setCurrentTopicIndex(topicIndex);
      setCurrentTopicStage('planning');
      setTopicStatuses(statuses => statuses.map((status, index) => index === topicIndex ? 'planning' : status));

      let topicHadError = false;

      try {
        // Each Topic is generated independently so its own Niche / Trigger / Skill /
        // Platform / Language / Knowledge Base settings are preserved.
        const result: ContentPlan = await apiFetch('/brand-content.php?action=generate-plan', {
          method: 'POST',
          body: JSON.stringify({
            source_topic: topicConfig.topic.trim(),
            trigger_command: topicConfig.topic.trim(),
            niche: topicConfig.niche.trim(),
            language: topicConfig.language,
            trigger_ids: topicConfig.triggerIds,
            skill_ids: topicConfig.skillIds,
            brand_context_ids: topicConfig.contextIds,
            week_start: startDate,
            platforms: topicConfig.platforms,
            type: topicConfig.contentType,
            days: daysNum,
            ...(topicConfig.contentType === 'article'
              ? { tone: topicConfig.tone }
              : { script_style: topicConfig.scriptStyle, duration: VIDEO_DURATION_SECONDS[topicConfig.duration] }),
          }),
        });

        qc.invalidateQueries({ queryKey: ['content', 'plans'] });
        if (!plan) setPlan(result);

        const items = result.items ?? [];
        setTotal(current => current + items.length);

        for (const item of items) {
          // Research must use the exact user-entered Topic, not an AI-rewritten
          // plan title, because generate-article validates Research against source_topic.
          const researchTopic = topicConfig.topic.trim();
          if (researchTopic) {
            try {
              setCurrentTopicStage('researching');
              setTopicStatuses(statuses => statuses.map((status, index) => index === topicIndex ? 'researching' : status));
              await runResearch({ topic: researchTopic, itemId: item.id });
            } catch {
              topicHadError = true;
              // Research failure is isolated to this item; keep the batch running.
            }
          }
          generatedCount += 1;
          setProgress(generatedCount);
          setGeneratedDisplayCount(generatedCount);
        }

        setCurrentTopicStage(topicHadError ? 'partial' : 'done');
        setTopicStatuses(statuses => statuses.map((status, index) => index === topicIndex ? (topicHadError ? 'partial' : 'done') : status));
      } catch (e: any) {
        errors.push(`หัวข้อ ${topicIndex + 1}: ${e?.message ?? 'สร้างไม่สำเร็จ'}`);
        setCurrentTopicStage('failed');
        setTopicStatuses(statuses => statuses.map((status, index) => index === topicIndex ? 'failed' : status));
      }
    }

    qc.invalidateQueries({ queryKey: ['content', 'items'] });
    qc.invalidateQueries({ queryKey: ['content', 'plans'] });

    if (generatedCount === 0) {
      toast({ title: 'สร้างไม่สำเร็จ', description: errors.join('\n') || 'ไม่สามารถสร้าง Content ได้', variant: 'destructive' });
      setStep('form');
      return;
    }

    setStep('done');
    toast({
      title: `สร้าง content ${generatedCount} ชิ้นสำเร็จ! 🎉`,
      description: errors.length > 0 ? `มี ${errors.length} หัวข้อที่สร้างไม่สำเร็จ` : undefined,
      variant: errors.length > 0 ? 'destructive' : 'default',
    });
  };

  const daysNum = parseInt(days, 10) || 7;
  const validTopicsCount = topics.filter(item => item.topic.trim()).length;
  const activeResearchLabel = RESEARCH_STEP_LABELS[researchStep];
  const currentStageLabel = currentTopicStage === 'planning'
    ? 'กำลังสร้างแผน'
    : currentTopicStage === 'researching'
      ? (activeResearchLabel ? `กำลัง${activeResearchLabel}` : 'กำลัง Research')
      : currentTopicStage === 'partial'
        ? 'สร้างเสร็จบางส่วน'
        : currentTopicStage === 'failed'
          ? 'สร้างไม่สำเร็จ'
          : currentTopicStage === 'done'
            ? 'สร้างเสร็จแล้ว'
            : 'กำลังเตรียมการ';

  const topicStatusLabel: Record<TopicProgressStatus, string> = {
    pending: 'รอคิว',
    planning: 'กำลังสร้างแผน',
    researching: activeResearchLabel ? `กำลัง${activeResearchLabel}` : 'กำลัง Research',
    analyzing: 'กำลังวิเคราะห์',
    generating: 'กำลังสร้าง Content',
    done: 'เสร็จแล้ว',
    partial: 'สำเร็จบางส่วน',
    failed: 'ไม่สำเร็จ',
  };

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
              <h3 className="font-semibold text-base">หัวข้อและการตั้งค่า</h3>

              <div className="space-y-1.5">
                <Label>หัวข้อคอนเทนต์ <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(อย่างน้อย {MIN_TOPICS} หัวข้อ)</span></Label>
                <div className="space-y-2">
                  {topics.map((item, index) => (
                    <div key={index} className="rounded-lg border p-3 space-y-3">
                      <div className="grid grid-cols-[28px_minmax(0,1fr)_100px_36px] gap-2 items-center">
                        <span className="text-sm font-semibold text-foreground text-center">{index + 1}.</span>
                        <Input value={item.topic} onChange={e => setTopics(rows => rows.map((row, i) => i === index ? { ...row, topic: e.target.value } : row))} placeholder="เช่น วิธีเลือกเครื่องมือ AI สำหรับองค์กร" className="text-base" />
                        <Select value={item.contentType} onValueChange={(value: 'article' | 'video') => setTopics(rows => rows.map((row, i) => i === index ? { ...row, contentType: value } : row))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="article">Article</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent>
                        </Select>
                        <Button type="button" variant="ghost" size="icon" disabled={topics.length <= MIN_TOPICS} onClick={() => setTopics(rows => rows.filter((_, i) => i !== index))} aria-label={`ลบหัวข้อ ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-muted/30 px-3 py-2.5 text-xs">
                        <span className={cn('rounded-full border bg-background px-2 py-0.5 font-medium max-w-full truncate', !item.niche.trim() && 'opacity-50')}>Niche: {item.niche.trim() || 'ไม่ระบุ'}</span>
                        {item.contentType === 'article' ? (
                          <span className="rounded-full border bg-background px-2 py-0.5 font-medium">{ARTICLE_TONE_OPTIONS.find(o => o.value === item.tone)?.label ?? item.tone}</span>
                        ) : (
                          <span className="rounded-full border bg-background px-2 py-0.5 font-medium">{VIDEO_SCRIPT_STYLE_OPTIONS.find(o => o.value === item.scriptStyle)?.label ?? item.scriptStyle} · {item.duration}</span>
                        )}
                        <span className={cn('rounded-full border bg-background px-2 py-0.5 font-medium', item.triggerIds.length === 0 && 'opacity-50')}>Trigger: {item.triggerIds.length}</span>
                        <span className={cn('rounded-full border bg-background px-2 py-0.5 font-medium', item.skillIds.length === 0 && 'opacity-50')}>Skill: {item.skillIds.length}</span>
                        <span className={cn('rounded-full border bg-background px-2 py-0.5 font-medium', !item.language && 'opacity-50')}>ภาษา: {item.language === 'thai' ? 'ไทย' : item.language === 'english' ? 'English' : 'ไม่ระบุภาษา'}</span>
                        <span className={cn('rounded-full border bg-background px-2 py-0.5 font-medium', item.contextIds.length === 0 && 'opacity-50')}>KB: {item.contextIds.length}</span>
                      </div>
                      <div className={cn('text-xs', item.platforms.length === 0 && 'opacity-50')}>
                        <span className="font-semibold text-foreground">Platform:</span>{' '}
                        <span className="font-semibold text-foreground">{item.platforms.map(platform => PLATFORM_MAP[platform]?.label ?? platform).join(', ') || 'ไม่ระบุ'}</span>
                      </div>

                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setTopics(rows => rows.map((row, i) => i === index ? { ...row, openSettings: !row.openSettings } : row))}>
                        {item.openSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        ตั้งค่าเพิ่มเติม
                      </Button>

                      {item.openSettings && (
                        <div className="space-y-4 rounded-md bg-muted/30 p-3">
                          <div className="space-y-1.5">
                            <Label>Niche</Label>
                            <Input value={item.niche} onChange={e => setTopics(rows => rows.map((row, i) => i === index ? { ...row, niche: e.target.value } : row))} placeholder="Niche (ถ้ามี)" />
                          </div>

                          <div className="space-y-1.5">
                            <Label>Trigger ({item.triggerIds.length === 0 ? 'ไม่เลือก' : item.triggerIds.length})</Label>
                            <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[38px] max-h-32 overflow-y-auto bg-background items-center">
                              {triggers.map(tr => { const selected = item.triggerIds.includes(tr.id); return <button key={tr.id} type="button" onClick={() => setTopics(rows => rows.map((row, i) => { if (i !== index) return row; const next = selected ? row.triggerIds.filter(x => x !== tr.id) : [...row.triggerIds, tr.id]; const linked = Array.from(new Set(triggers.filter(t => next.includes(t.id) && t.skill_id).map(t => t.skill_id as string))); return { ...row, triggerIds: next, autoSkillIds: linked, skillIds: Array.from(new Set([...row.skillIds.filter(id => !row.autoSkillIds.includes(id)), ...linked])) }; }))} className={cn('text-[11px] px-2 py-1 rounded border font-mono flex items-center gap-1', selected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}><Zap className="h-3 w-3 text-amber-500" />{getTriggerDisplayLabel(tr.command)}</button>; })}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label>Skill ({item.skillIds.length === 0 ? 'ไม่เลือก' : item.skillIds.length})</Label>
                            <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[38px] max-h-32 overflow-y-auto bg-background items-center">
                              {skills.map(sk => { const selected = item.skillIds.includes(sk.id); const locked = item.autoSkillIds.includes(sk.id); return <button key={sk.id} type="button" disabled={locked} onClick={() => setTopics(rows => rows.map((row, i) => i === index ? { ...row, skillIds: selected ? row.skillIds.filter(x => x !== sk.id) : [...row.skillIds, sk.id] } : row))} className={cn('text-[11px] px-2 py-1 rounded border transition-colors', locked ? 'bg-primary text-primary-foreground border-primary cursor-not-allowed' : selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>{sk.name}{locked ? ' 🔒' : ''}</button>; })}
                              {skills.length === 0 && <span className="text-xs text-muted-foreground">ยังไม่มี Skill</span>}
                            </div>
                          </div>

                          {item.contentType === 'article' ? (
                            <div className="space-y-1.5">
                              <Label>สไตล์การเขียน</Label>
                              <div className="grid grid-cols-2 gap-2">
                                {ARTICLE_TONE_OPTIONS.map(opt => (
                                  <button key={opt.value} type="button" onClick={() => setTopics(rows => rows.map((row, i) => i === index ? { ...row, tone: opt.value } : row))}
                                    className={cn('flex flex-col items-start p-2.5 rounded-lg border text-left text-xs transition-all',
                                      item.tone === opt.value
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-border hover:border-muted-foreground hover:bg-muted/30')}>
                                    <span className="font-medium">{opt.label}</span>
                                    <span className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-1.5">
                                <Label>รูปแบบสคริปต์</Label>
                                <div className="grid grid-cols-2 gap-2">
                                  {VIDEO_SCRIPT_STYLE_OPTIONS.map(opt => (
                                    <button key={opt.value} type="button" onClick={() => setTopics(rows => rows.map((row, i) => i === index ? { ...row, scriptStyle: opt.value } : row))}
                                      className={cn('flex flex-col items-start p-2.5 rounded-lg border text-left text-xs transition-all',
                                        item.scriptStyle === opt.value
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
                                  {VIDEO_DURATION_OPTIONS.map(d => (
                                    <button key={d} type="button" onClick={() => setTopics(rows => rows.map((row, i) => i === index ? { ...row, duration: d } : row))}
                                      className={cn('px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                                        item.duration === d
                                          ? 'border-primary bg-primary/10 text-primary'
                                          : 'border-border hover:bg-muted')}>
                                      {d}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          <div className="space-y-1.5">
                            <Label>แพลตฟอร์ม ({item.platforms.length === 0 ? 'ไม่เลือก' : item.platforms.length})</Label>
                            <div className="flex flex-wrap gap-1 p-1.5 border rounded-md min-h-[32px] bg-background">
                              {Object.entries(PLATFORM_MAP).map(([key, val]) => { const selected = item.platforms.includes(key); return <button key={key} type="button" onClick={() => setTopics(rows => rows.map((row, i) => i === index ? { ...row, platforms: selected ? row.platforms.filter(x => x !== key) : [...row.platforms, key] } : row))} className={cn('text-[11px] px-2 py-1 rounded border transition-colors', selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>{val.label}</button>; })}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label>ภาษา</Label>
                            <Select value={item.language} onValueChange={value => setTopics(rows => rows.map((row, i) => i === index ? { ...row, language: value } : row))}>
                              <SelectTrigger><SelectValue placeholder="เลือกภาษา" /></SelectTrigger>
                              <SelectContent><SelectItem value="thai">ไทย</SelectItem><SelectItem value="english">English</SelectItem></SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1.5">
                            <Label>Knowledge Base ({item.contextIds.length === 0 ? 'ไม่เลือก' : `${item.contextIds.length} ไฟล์`})</Label>
                            <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[38px] bg-background items-center">
                              {contexts.map(ctx => { const selected = item.contextIds.includes(ctx.id); return <button key={ctx.id} type="button" onClick={() => setTopics(rows => rows.map((row, i) => i === index ? { ...row, contextIds: selected ? row.contextIds.filter(x => x !== ctx.id) : [...row.contextIds, ctx.id] } : row))} className={cn('text-[11px] px-2 py-1 rounded border transition-colors', selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted')}>{ctx.name}</button>; })}
                              {contexts.length === 0 && <span className="text-xs text-muted-foreground">ยังไม่มี Context</span>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setTopics(rows => [...rows, createTopic()])}>
                    <Plus className="h-4 w-4" />เพิ่มหัวข้อ
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-sm">กำหนดการสร้าง</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>จำนวนวัน</Label><Select value={days} onValueChange={setDays}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[3, 5, 7, 10, 14, 30].map(d => <SelectItem key={d} value={String(d)}>{d} วัน</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1.5"><Label>เริ่มวันที่</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                </div>
              </div>
            </div>

            {(() => {
              const validTopics = topics.filter(item => item.topic.trim());
              const articleCount = validTopics.filter(item => item.contentType === 'article').length;
              const videoCount = validTopics.filter(item => item.contentType === 'video').length;
              const platformNames = Array.from(new Set(validTopics.flatMap(item => item.platforms))).map(platform => PLATFORM_MAP[platform]?.label ?? platform);
              const platformCount = platformNames.length;
              const date = new Date(`${startDate}T00:00:00`);
              const formattedDate = new Intl.DateTimeFormat('th-TH', {
                day: 'numeric', month: 'short', year: 'numeric',
              }).format(date);

              return (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div><span className="text-muted-foreground">หัวข้อ</span><span className="mx-1.5">:</span><span className="font-medium">{validTopics.length} หัวข้อ</span></div>
                      <div><span className="text-muted-foreground">Article</span><span className="mx-1.5">:</span><span className="font-medium">{articleCount} รายการ</span></div>
                      <div><span className="text-muted-foreground">Video</span><span className="mx-1.5">:</span><span className="font-medium">{videoCount} รายการ</span></div>
                      <div><span className="text-muted-foreground">Platforms</span><span className="mx-1.5">:</span><span className="font-medium">{platformCount} แพลตฟอร์ม</span></div>
                      <div><span className="text-muted-foreground">เริ่มวันที่</span><span className="mx-1.5">:</span><span className="font-medium">{formattedDate}</span></div>
                      <div><span className="text-muted-foreground">จำนวนวัน</span><span className="mx-1.5">:</span><span className="font-medium">{daysNum} วัน</span></div>
                      <div className="col-span-2"><span className="text-muted-foreground">Platform ที่เลือก</span><span className="mx-1.5">:</span><span className="font-medium">{platformNames.length > 0 ? platformNames.join(', ') : 'ไม่ระบุ'}</span></div>
                    </div>
                  </div>

                  <Button className="w-full h-12 text-base font-semibold gap-2" disabled={validTopics.length < MIN_TOPICS} onClick={handleStart}>
                    <Sparkles className="h-5 w-5" />เริ่มสร้างคอนเทนต์
                  </Button>
                </div>
              );
            })()}
          </div>
        )}

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>ยืนยันการสร้างคอนเทนต์</AlertDialogTitle>
              <AlertDialogDescription>
                ตรวจสอบหัวข้อและการตั้งค่าก่อนเริ่มสร้างคอนเทนต์
              </AlertDialogDescription>
            </AlertDialogHeader>

            {(() => {
              const validTopics = topics.filter(item => item.topic.trim());
              const articleCount = validTopics.filter(item => item.contentType === 'article').length;
              const videoCount = validTopics.filter(item => item.contentType === 'video').length;
              const platformCount = new Set(validTopics.flatMap(item => item.platforms)).size;
              const date = new Date(`${startDate}T00:00:00`);
              const formattedDate = new Intl.DateTimeFormat('th-TH', {
                day: 'numeric', month: 'short', year: 'numeric',
              }).format(date);

              return (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      <div><span className="text-muted-foreground">หัวข้อ</span><span className="mx-1.5">:</span><span className="font-medium">{validTopics.length} หัวข้อ</span></div>
                      <div><span className="text-muted-foreground">Article</span><span className="mx-1.5">:</span><span className="font-medium">{articleCount} รายการ</span></div>
                      <div><span className="text-muted-foreground">Video</span><span className="mx-1.5">:</span><span className="font-medium">{videoCount} รายการ</span></div>
                      <div><span className="text-muted-foreground">Platforms</span><span className="mx-1.5">:</span><span className="font-medium">{platformCount} แพลตฟอร์ม</span></div>
                      <div><span className="text-muted-foreground">เริ่มวันที่</span><span className="mx-1.5">:</span><span className="font-medium">{formattedDate}</span></div>
                      <div><span className="text-muted-foreground">จำนวนวัน</span><span className="mx-1.5">:</span><span className="font-medium">{daysNum} วัน</span></div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {validTopics.map((item, index) => (
                      <div key={`${item.topic}-${index}`} className="rounded-lg border p-3 space-y-2">
                        <div className="font-semibold text-sm">หัวข้อที่ {index + 1}: {item.topic.trim()}</div>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className="rounded-full border bg-background px-2 py-0.5 font-medium">Niche: {item.niche.trim() || 'ไม่ระบุ'}</span>
                          {item.contentType === 'article' ? (
                            <span className="rounded-full border bg-background px-2 py-0.5 font-medium">{ARTICLE_TONE_OPTIONS.find(o => o.value === item.tone)?.label ?? item.tone}</span>
                          ) : (
                            <span className="rounded-full border bg-background px-2 py-0.5 font-medium">{VIDEO_SCRIPT_STYLE_OPTIONS.find(o => o.value === item.scriptStyle)?.label ?? item.scriptStyle} · {item.duration}</span>
                          )}
                          <span className="rounded-full border bg-background px-2 py-0.5 font-medium">Trigger: {item.triggerIds.length}</span>
                          <span className="rounded-full border bg-background px-2 py-0.5 font-medium">Skill: {item.skillIds.length}</span>
                          <span className="rounded-full border bg-background px-2 py-0.5 font-medium">ภาษา: {item.language === 'thai' ? 'ไทย' : item.language === 'english' ? 'English' : 'ไม่ระบุภาษา'}</span>
                          <span className="rounded-full border bg-background px-2 py-0.5 font-medium">KB: {item.contextIds.length}</span>
                        </div>
                        <div className="text-xs">
                          <span className="font-semibold text-foreground">Platform:</span>{' '}
                          <span className="font-semibold text-foreground">{item.platforms.map(platform => PLATFORM_MAP[platform]?.label ?? platform).join(', ') || 'ไม่ระบุ'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmStart}>ยืนยันและเริ่มสร้าง</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {(step === 'progress' || step === 'done') && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <p className="font-semibold text-lg">{step === 'done' ? '✅ สร้างเสร็จแล้ว' : 'กำลังสร้างคอนเทนต์'}</p>
              {step === 'progress' && currentTopicIndex >= 0 && (
                <>
                  <p className="text-sm font-medium">หัวข้อ {currentTopicIndex + 1} จาก {validTopicsCount}</p>
                  <p className="text-sm text-muted-foreground truncate">{topics.filter(item => item.topic.trim())[currentTopicIndex]?.topic.trim()}</p>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {currentStageLabel}
                  </div>
                </>
              )}
              {step === 'done' && <p className="text-sm text-muted-foreground">สร้างสำเร็จ {generatedDisplayCount} ชิ้น จาก {total} ชิ้น</p>}
            </div>

            {(total > 0 || step === 'done') && (
              <div className="space-y-1.5">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress} / {total} รายการ</span>
                  <span>{total > 0 ? Math.round((progress / total) * 100) : 0}%</span>
                </div>
              </div>
            )}

            {topicStatuses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold">สถานะแต่ละหัวข้อ</p>
                <div className="space-y-1.5">
                  {topicStatuses.map((status, index) => (
                    <div key={index} className={cn(
                      'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm',
                      index === currentTopicIndex && step === 'progress' && 'border-primary bg-primary/5',
                    )}>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className="shrink-0 font-semibold">{index + 1}.</span>
                        <span className="truncate">{topics.filter(item => item.topic.trim())[index]?.topic.trim()}</span>
                      </div>
                      <span className={cn(
                        'shrink-0 text-xs font-medium',
                        status === 'done' && 'text-green-600 dark:text-green-400',
                        status === 'failed' && 'text-destructive',
                        status === 'partial' && 'text-amber-600 dark:text-amber-400',
                        status === 'pending' && 'text-muted-foreground',
                      )}>
                        {status === 'done' ? '✓ ' : status === 'pending' ? '○ ' : status === 'failed' ? '✕ ' : status === 'partial' ? '△ ' : '● '}
                        {topicStatusLabel[status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 'done' && <Button className="w-full h-11 font-semibold gap-2" onClick={() => { handleClose(false); navigate('/content'); }}><CheckCircle2 className="h-4 w-4" />ดูผลงานทั้งหมด</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
