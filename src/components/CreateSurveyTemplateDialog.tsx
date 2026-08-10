// src/components/CreateSurveyTemplateDialog.tsx
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, GripVertical, Sparkles, Loader2 } from 'lucide-react';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCreateSurveyTemplate, useUpdateSurveyTemplate, useSurveyTemplate } from '@/hooks/useSurveys';
import type { SurveyTemplate, SurveyQuestion, SurveyOption } from '@/hooks/useSurveys';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editTemplate?: SurveyTemplate | null;
}

type DraftQuestion = Partial<SurveyQuestion> & { _key: number; optionItems?: SurveyOption[] };

const INDUSTRIES = [
  { value: 'general', label: 'ทั่วไป' },
  { value: 'it_service', label: 'IT Service' },
  { value: 'food_pharma', label: 'อาหาร/ยา' },
  { value: 'tapioca_factory', label: 'โรงงานแป้งมัน' },
];

const THEMES = [
  { value: 'general', label: 'ทั่วไป' },
  { value: 'it_bottleneck', label: 'IT Bottleneck Audit' },
  { value: 'ai_governance', label: 'AI Governance Readiness' },
  { value: 'iso_compliance', label: 'ISO Compliance Survey' },
];

const QUESTION_TYPES = [
  { value: 'yes_no', label: 'ใช่/ไม่ใช่' },
  { value: 'scale_1_5', label: 'คะแนน 1-5' },
  { value: 'multiple_choice', label: 'หลายตัวเลือก' },
  { value: 'text', label: 'ข้อความอิสระ' },
];

function defaultMaxScore(type: string): number {
  if (type === 'scale_1_5') return 5;
  if (type === 'multiple_choice') return 0;
  return 1;
}

function roundHalf(n: number): number {
  return Math.max(0.5, Math.round(n * 2) / 2);
}

function aiDistributeScores(qs: DraftQuestion[]): DraftQuestion[] {
  if (qs.length === 0) return qs;

  // Calculate raw importance per question based on type & critical flag
  const raw = qs.map(q => {
    let imp = 10;
    if (q.question_type === 'scale_1_5') imp = 12;
    else if (q.question_type === 'multiple_choice') {
      const scored = (q.optionItems ?? []).some(o => (o.score ?? 0) > 0);
      imp = scored ? 12 : 4;
    } else if (q.question_type === 'text') imp = 5;
    if ((q.is_critical ?? 0) === 1) imp *= 1.5;
    return imp;
  });

  const totalRaw = raw.reduce((a, b) => a + b, 0);

  // Step 1: Determine max_score per question
  const maxScores = qs.map(q => {
    if (q.question_type === 'yes_no') return 1;
    if (q.question_type === 'scale_1_5') return 5;
    if (q.question_type === 'multiple_choice') {
      return Math.max(...(q.optionItems ?? []).map(o => o.score ?? 0), 0);
    }
    return 1; // text
  });

  // Step 2: Allocate exact points, then weight = allocated / max_score
  const weights = qs.map((q, i) => {
    const allocated = (raw[i] / totalRaw) * 100;
    const ms = maxScores[i];
    if (ms <= 0 || (q.question_type === 'text')) {
      return { idx: i, exact: allocated, ms };
    }
    return { idx: i, exact: allocated / ms, ms };
  });

  // Step 3: Round each weight to 2 decimals
  const rounded = weights.map(w => ({
    ...w,
    rounded: Math.round(w.exact * 100) / 100,
    contrib: w.ms <= 0 ? w.exact : Math.round(w.exact * 100) / 100 * w.ms,
  }));

  // Step 4: Compute remainder and absorb in the largest contributor
  const sumBefore = rounded.reduce((s, r) => s + (r.ms <= 0 ? r.exact : r.rounded * r.ms), 0);
  const remainder = Math.round((100 - sumBefore) * 100) / 100;

  const adjusted = rounded.map(r => ({ ...r }));
  if (Math.abs(remainder) > 0.001) {
    // Find the index with largest contribution to absorb remainder
    const largestIdx = adjusted.reduce((best, r, i) => {
      if (r.ms <= 0) return best;
      const rVal = r.rounded * r.ms;
      const bestVal = best >= 0 ? adjusted[best].rounded * adjusted[best].ms : -1;
      return rVal > bestVal ? i : best;
    }, adjusted.findIndex(r => r.ms > 0));
    if (largestIdx >= 0) {
      const r = adjusted[largestIdx];
      const newContrib = Math.round((r.rounded * r.ms + remainder) * 100) / 100;
      adjusted[largestIdx] = { ...r, rounded: Math.round(newContrib / r.ms * 100) / 100 };
    }
  }

  // Step 5: Build result
  const resultMap = new Map<number, number>();
  adjusted.forEach(r => { resultMap.set(r.idx, r.rounded); });

  return qs.map((q, i) => {
    const ms = maxScores[i];
    const w = resultMap.get(i) ?? 1;

    if (q.question_type === 'yes_no') {
      return { ...q, max_score: 1, weight: Math.round(Math.max(w, 0.5) * 100) / 100 };
    }
    if (q.question_type === 'scale_1_5') {
      return { ...q, max_score: 5, weight: Math.round(Math.max(w, 0.1) * 100) / 100 };
    }
    if (q.question_type === 'multiple_choice') {
      if (ms > 0) {
        return { ...q, max_score: ms, weight: Math.round(Math.max(w, 0.1) * 100) / 100 };
      }
      return { ...q, max_score: 1, weight: 0.5 };
    }
    return { ...q, max_score: Math.round(raw[i] / totalRaw * 100), weight: 1 };
  });
}

let keyCounter = 0;
function newQuestion(): DraftQuestion {
  return { _key: ++keyCounter, question_text: '', question_type: 'yes_no', weight: 1, is_critical: 0, critical_bonus: 0, max_score: 1, optionItems: [] };
}

function parseOptionsForEdit(q: Partial<SurveyQuestion>): SurveyOption[] {
  const raw = q.options_json;
  if (!raw) return [];
  let arr: unknown[];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { return []; } }
  else return [];
  return arr.map(item => {
    if (typeof item === 'string') return { value: item, label: item };
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      return {
        value: String(obj.value ?? ''),
        label: String(obj.label ?? obj.value ?? ''),
        score: typeof obj.score === 'number' ? obj.score : (obj.score !== undefined ? Number(obj.score) : undefined),
      };
    }
    return { value: '', label: '' };
  });
}

function computeMaxFromOptions(items: SurveyOption[]): number {
  const scores = items.map(o => o.score ?? 0).filter(s => s > 0);
  return scores.length > 0 ? Math.max(...scores) : 0;
}

function ScoreInfo({ questionType, maxScore, weight, criticalBonus = 0 }: { questionType: string; maxScore?: number; weight?: number; criticalBonus?: number }) {
  const w = weight ?? 1;
  const ms = maxScore ?? defaultMaxScore(questionType);
  if (questionType === 'yes_no') {
    return (
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p>ตอบ "ใช่" → 1 คะแนน × {w} = <strong>{w}</strong> คะแนน (สูงสุด {ms} × {w} = {ms * w})</p>
        <p>ตอบ "ไม่ใช่" → 0 คะแนน</p>
        {criticalBonus > 0 && <p className="text-amber-600">Critical bonus: +{criticalBonus} คะแนน ถ้าตอบ "ใช่"</p>}
      </div>
    );
  }
  if (questionType === 'scale_1_5') {
    return (
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p>คะแนนดิบ 1–5 × weight: 1→{w}, 2→{w * 2}, 3→{w * 3}, 4→{w * 4}, 5→{w * 5}</p>
        <p>สูงสุด {ms} × {w} = {ms * w} คะแนนต่อข้อ (ตอบ 5/{ms} = {(5 / ms * 100).toFixed(0)}%)</p>
        {criticalBonus > 0 && <p className="text-amber-600">Critical bonus: +{criticalBonus} คะแนน ถ้าตอบ ≥ 4</p>}
      </div>
    );
  }
  if (questionType === 'multiple_choice') {
    return (
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p>แต่ละตัวเลือกมีคะแนนตามที่กำหนด × weight</p>
        {criticalBonus > 0 && <p className="text-amber-600">Critical bonus: +{criticalBonus} (ตรวจสอบด้วยตนเอง)</p>}
      </div>
    );
  }
  if (questionType === 'text') {
    return (
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p>ไม่มีคะแนนอัตโนมัติ (ให้คะแนนด้วยตนเอง)</p>
        {criticalBonus > 0 && <p className="text-amber-600">Critical bonus: +{criticalBonus} (ตรวจสอบด้วยตนเอง)</p>}
      </div>
    );
  }
  return null;
}

export function CreateSurveyTemplateDialog({ open, onOpenChange, editTemplate }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const createMutation = useCreateSurveyTemplate();
  const updateMutation = useUpdateSurveyTemplate();

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('general');
  const [theme, setTheme] = useState('general');
  const [description, setDescription] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion()]);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  const { data: fullTemplate } = useSurveyTemplate(editTemplate?.id ?? null);

  // ── AI weight suggestion via /api/surveys.php?action=suggest-weights ────────
  async function handleAiSuggestWeights() {
    if (questions.length < 2) {
      toast({ title: 'ต้องมีคำถามอย่างน้อย 2 ข้อ', variant: 'destructive' });
      return;
    }
    if (questions.some(q => !q.question_text?.trim())) {
      toast({ title: 'กรุณากรอกคำถามให้ครบก่อนใช้ AI', variant: 'destructive' });
      return;
    }
    setAiSuggesting(true);
    try {
      const payload = {
        questions: questions.map((q, i) => ({
          question_index: i,
          question_text: q.question_text ?? '',
          question_type: q.question_type ?? 'yes_no',
          is_critical: q.is_critical ?? 0,
        })),
      };
      const data = await apiFetch<Array<{ question_index: number; weight_pct: number; reason?: string }>>(
        '/surveys.php?action=suggest-weights',
        { method: 'POST', body: JSON.stringify(payload) },
      );
      if (!Array.isArray(data)) {
        toast({ title: 'AI ตอบรูปแบบไม่ถูก', variant: 'destructive' });
        return;
      }
      // Map weight_pct back to per-question. The new BE scoring normalizes internally,
      // so we store the AI's weight_pct directly as `weight`.
      setQuestions(qs => qs.map((q, i) => {
        const sugg = data.find(d => d.question_index === i);
        if (!sugg) return q;
        return { ...q, weight: Math.round(sugg.weight_pct * 100) / 100 };
      }));
      toast({ title: 'AI แนะนำน้ำหนักสำเร็จ', description: 'รวม = 100%' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ';
      toast({ title: 'เรียก AI ไม่สำเร็จ', description: msg, variant: 'destructive' });
    } finally {
      setAiSuggesting(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (fullTemplate) {
      setName(fullTemplate.name);
      setIndustry(fullTemplate.industry);
      setTheme(fullTemplate.strategic_theme);
      setDescription(fullTemplate.description ?? '');
      setIsGlobal(fullTemplate.is_global === 1);
      setQuestions((fullTemplate.questions ?? []).map(q => ({
        ...q,
        _key: ++keyCounter,
        optionItems: parseOptionsForEdit(q),
      })));
    } else if (!editTemplate) {
      resetForm();
    }
  }, [fullTemplate, editTemplate, open]);

  function resetForm() {
    setName(''); setIndustry('general'); setTheme('general');
    setDescription(''); setIsGlobal(false);
    setQuestions([newQuestion()]);
  }

  function updateQuestion(key: number, field: keyof DraftQuestion, value: unknown) {
    setQuestions(qs => qs.map(q => q._key === key ? { ...q, [field]: value } : q));
  }

  function removeQuestion(key: number) {
    setQuestions(qs => qs.filter(q => q._key !== key));
  }

  async function handleSave() {
    if (!name.trim()) { toast({ title: 'กรุณาระบุชื่อ template', variant: 'destructive' }); return; }
    if (questions.some(q => !q.question_text?.trim())) {
      toast({ title: 'กรุณากรอกคำถามให้ครบทุกข้อ', variant: 'destructive' }); return;
    }
    if (questions.some(q => q.question_type === 'multiple_choice' && (!q.optionItems || q.optionItems.length === 0))) {
      toast({ title: 'คำถามแบบหลายตัวเลือกต้องมีตัวเลือกอย่างน้อย 1 ตัว', variant: 'destructive' }); return;
    }
    if (questions.some(q => q.question_type === 'multiple_choice' && q.optionItems && q.optionItems.some(o => (o.score ?? 0) === 0 && o.label.trim() !== ''))) {
      if (!await confirm({ title: 'คำเตือน', description: 'มีตัวเลือกที่ยังไม่ได้กำหนดคะแนน (คะแนน=0) ต้องการบันทึกต่อหรือไม่?', variant: 'default' })) return;
    }
    const questionsPayload = questions.map(({ _key, optionItems, ...q }) => ({
      ...q,
      options_json: q.question_type === 'multiple_choice' && optionItems && optionItems.length > 0
        ? optionItems : null,
    }));
    const payload = { name, industry, strategic_theme: theme, description, is_global: isGlobal, questions: questionsPayload };
    try {
      if (editTemplate) {
        await updateMutation.mutateAsync({ id: editTemplate.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      toast({ title: editTemplate ? 'อัปเดต template สำเร็จ' : 'สร้าง template สำเร็จ' });
      onOpenChange(false);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && (saving || aiSuggesting)) return; onOpenChange(v); }}>
      <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTemplate ? 'แก้ไข Template' : 'สร้าง Template ใหม่'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>ชื่อ Template *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น IT Audit สำหรับโรงงาน" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>อุตสาหกรรม</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Strategic Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {THEMES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>คำอธิบาย</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          {user?.is_admin === 1 && (
            <div className="flex items-center gap-3">
              <Switch checked={isGlobal} onCheckedChange={setIsGlobal} id="global-switch" />
              <Label htmlFor="global-switch">Global Template (ทุก user มองเห็น)</Label>
            </div>
          )}

          {/* Questions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-base">คำถาม</Label>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm"
                  onClick={handleAiSuggestWeights}
                  disabled={aiSuggesting}
                  title="ใช้ LLM แนะนำน้ำหนักโดยรวม = 100% (เรียก /api/surveys.php?action=suggest-weights)">
                  {aiSuggesting
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />กำลังคิด…</>
                    : <><Sparkles className="h-3.5 w-3.5 mr-1" />AI แนะนำน้ำหนัก</>}
                </Button>
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => setQuestions(aiDistributeScores(questions))}
                  title="คำนวณแบบ heuristic ฝั่ง client (ไม่ต้องใช้ AI)">
                  Auto-balance
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setQuestions(qs => [...qs, newQuestion()])}>
                  <Plus className="h-4 w-4 mr-1" />เพิ่มคำถาม
                </Button>
              </div>
            </div>

            {questions.map((q, idx) => (
              <div key={q._key} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Label className="text-sm text-muted-foreground mt-1">ข้อ {idx + 1}</Label>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                    onClick={() => removeQuestion(q._key)} disabled={questions.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Textarea
                  value={q.question_text ?? ''}
                  onChange={e => updateQuestion(q._key, 'question_text', e.target.value)}
                  placeholder="คำถาม..."
                  rows={2}
                />

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ประเภทคำถาม</Label>
                    <Select value={q.question_type ?? 'yes_no'}
                      onValueChange={v => {
                        updateQuestion(q._key, 'question_type', v);
                        updateQuestion(q._key, 'optionItems', []);
                        updateQuestion(q._key, 'max_score', defaultMaxScore(v));
                      }}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">น้ำหนัก (Weight)</Label>
                    <Input type="number" min={0.1} max={10} step={0.5}
                      value={q.weight ?? 1}
                      onChange={e => updateQuestion(q._key, 'weight', parseFloat(e.target.value) || 1)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">คะแนนสูงสุด (Max)</Label>
                    <Input type="number" min={0} max={10} step={0.5}
                      value={q.max_score ?? defaultMaxScore(q.question_type ?? 'yes_no')}
                      onChange={e => updateQuestion(q._key, 'max_score', Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-8"
                    />
                    {q.question_type === 'multiple_choice' && (q.max_score ?? 0) === 0 && (
                      <p className="text-[10px] text-amber-600">กำหนดคะแนนให้ตัวเลือกเพื่อเปิดใช้งานการคำนวณ</p>
                    )}
                  </div>
                </div>

                <ScoreInfo questionType={q.question_type ?? 'yes_no'} maxScore={q.max_score ?? defaultMaxScore(q.question_type ?? 'yes_no')} weight={q.weight ?? 1} criticalBonus={(q.is_critical ?? 0) === 1 ? q.critical_bonus ?? 0 : 0} />

                {/* Multiple choice options editor */}
                {q.question_type === 'multiple_choice' && (
                  <div className="space-y-2 border rounded-md p-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">ตัวเลือก <span className="text-muted-foreground">(value, label, คะแนน)</span></Label>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => {
                          const items = q.optionItems ?? [];
                          const newItems = [...items, { value: `opt_${items.length + 1}`, label: '', score: 0 }];
                          updateQuestion(q._key, 'optionItems', newItems);
                          updateQuestion(q._key, 'max_score', computeMaxFromOptions(newItems) || 0);
                        }}>
                        <Plus className="h-3 w-3" />เพิ่มตัวเลือก
                      </Button>
                    </div>
                    {(q.optionItems ?? []).length === 0 && (
                      <p className="text-xs text-muted-foreground py-2 text-center">ยังไม่มีตัวเลือก — กด "เพิ่มตัวเลือก"</p>
                    )}
                    {(q.optionItems ?? []).map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-1.5">
                        <Input
                          placeholder="value"
                          value={opt.value}
                          onChange={e => {
                            const items = [...(q.optionItems ?? [])];
                            items[oi] = { ...items[oi], value: e.target.value };
                            updateQuestion(q._key, 'optionItems', items);
                          }}
                          className="h-8 w-[110px] text-xs"
                        />
                        <Input
                          placeholder="ข้อความ"
                          value={opt.label}
                          onChange={e => {
                            const items = [...(q.optionItems ?? [])];
                            items[oi] = { ...items[oi], label: e.target.value };
                            updateQuestion(q._key, 'optionItems', items);
                          }}
                          className="h-8 flex-1 text-xs"
                        />
                        <Input
                          type="number" min={0} max={10} step={0.5}
                          value={opt.score ?? 0}
                          onChange={e => {
                            const items = [...(q.optionItems ?? [])];
                            items[oi] = { ...items[oi], score: parseFloat(e.target.value) || 0 };
                            updateQuestion(q._key, 'optionItems', items);
                            const maxOpt = computeMaxFromOptions(items);
                            if (maxOpt > 0) updateQuestion(q._key, 'max_score', maxOpt);
                          }}
                          className="h-8 w-[64px] text-xs text-center"
                          title="คะแนนของตัวเลือกนี้"
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0"
                          onClick={() => {
                            const items = (q.optionItems ?? []).filter((_, i) => i !== oi);
                            updateQuestion(q._key, 'optionItems', items);
                            updateQuestion(q._key, 'max_score', computeMaxFromOptions(items) || 0);
                          }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={(q.is_critical ?? 0) === 1}
                      onCheckedChange={v => {
                        updateQuestion(q._key, 'is_critical', v ? 1 : 0);
                        if (!v) updateQuestion(q._key, 'critical_bonus', 0);
                      }}
                      id={`crit-${q._key}`}
                    />
                    <Label htmlFor={`crit-${q._key}`} className="text-xs">Critical</Label>
                  </div>
                  {(q.is_critical ?? 0) === 1 && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Bonus:</Label>
                      <Input type="number" min={0} max={50} step={1}
                        value={q.critical_bonus ?? 0}
                        onChange={e => updateQuestion(q._key, 'critical_bonus', parseFloat(e.target.value) || 0)}
                        className="h-8 w-20"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {questions.length > 1 && (() => {
              // New scoring model normalizes weights internally → Σ effective weight always = 100%.
              // Show the breakdown: each question's effective weight.
              const sumW = questions.reduce((s, q) => s + Math.max(0, q.weight ?? 1), 0);
              return (
                <div className="rounded-md bg-muted/30 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">น้ำหนักรวม (effective): <strong>100%</strong></span>
                    <span className="text-[10px] text-muted-foreground">ระบบ normalize อัตโนมัติ Σweight = {Math.round(sumW * 100) / 100}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {questions.map((q, i) => {
                      const w = Math.max(0, q.weight ?? 1);
                      const effPct = sumW > 0 ? (w / sumW) * 100 : 0;
                      return (
                        <div key={q._key} className="flex justify-between">
                          <span className="truncate text-muted-foreground">ข้อ {i + 1}</span>
                          <span className="tabular-nums">{effPct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
