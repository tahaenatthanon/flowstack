import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ContentPlan, ContentSkill, ContentTrigger, BrandContext } from '@/components/content/types';
import { PLAN_STATUS, PLATFORM_MAP, getTriggerDisplayLabel } from '@/components/content/types';
import { parsePlatforms } from '@/lib/contentPlatforms';
import { getPlatformColors } from '@/lib/platformConfig';
import {
  Sparkles, Wand2, Loader2, PanelRightClose, PanelRightOpen,
  Zap, Bot, Trash2,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  plans: ContentPlan[];
  skills: ContentSkill[];
  contexts: BrandContext[];
  triggers: ContentTrigger[];
  gwModelName: string | undefined;
  onSelectPlan: (plan: ContentPlan) => void;
  selectedPlanId: string | null;
  onDeletePlan: (planId: string) => void;
  onGenerate: (params: {
    trigger_command: string;
    skill_id: string | null;
    brand_context_ids: string[];
    plan_type: string;
    plan_start: string | null;
    plan_end: string | null;
    platforms: string[];
  }) => Promise<void>;
  isGenerating: boolean;
  isGeneratingArticles?: boolean;
  generateProgress?: string;
  onCancel?: () => void;
}

export function ContentPlannerAI({
  isOpen, onToggle, plans, skills, contexts, triggers,
  gwModelName, onSelectPlan, selectedPlanId, onDeletePlan, onGenerate, isGenerating,
  isGeneratingArticles, generateProgress, onCancel,
}: Props) {
  const [triggerCmd, setTriggerCmd] = useState('');
  const [triggerSearch, setTriggerSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [selSkillId, setSelSkillId] = useState('__none__');
  const [selContextIds, setSelContextIds] = useState<string[]>([]);
  const [selPlatforms, setSelPlatforms] = useState<string[]>([]);
  const [planType, setPlanType] = useState('monthly');
  const [planStart, setPlanStart] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [planEnd, setPlanEnd] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
  });

  const handleGenerate = async () => {
    if (!triggerCmd.trim()) return;
    await onGenerate({
      trigger_command: triggerCmd.trim(),
      skill_id: selSkillId === '__none__' ? null : selSkillId,
      brand_context_ids: selContextIds,
      plan_type: planType,
      plan_start: planStart || null,
      plan_end: planEnd || null,
      platforms: selPlatforms,
    });
  };

  if (!isOpen) {
    return (
      <div className="border-l bg-muted/10 p-2 flex flex-col items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onToggle}
          title="เปิด AI Panel"
        >
          <PanelRightOpen className="h-4 w-4" />
        </Button>
        <span className="text-[10px] text-muted-foreground" style={{ writingMode: 'vertical-rl' }}>
          AI
        </span>
      </div>
    );
  }

  return (
    <div className="border-l bg-muted/5 w-80 shrink-0 overflow-y-auto max-h-[calc(100vh-16rem)]">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI สร้างแผน
          </h3>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onToggle}>
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[11px]">
              หัวข้อ/คำสั่งสำหรับแผน <span className="text-destructive">*</span>
            </Label>
            <Input
              value={triggerCmd}
              onChange={e => setTriggerCmd(e.target.value)}
              placeholder='เช่น "แผนคอนเทนต์เดือนนี้"'
              className="h-8 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              AI จะคิดหัวข้อย่อยของแต่ละโพสต์เองจากคำสั่งนี้
            </p>
          </div>

          {triggers.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-[11px]">Quick Triggers</Label>
                <Input value={triggerSearch} onChange={e => setTriggerSearch(e.target.value)} placeholder="ค้นหา Trigger..." className="h-8 text-xs w-48" />
              </div>
              <div className="flex flex-wrap gap-1">
                {triggers.filter(tr => {
                  const q = triggerSearch.trim().toLowerCase();
                  return !q || getTriggerDisplayLabel(tr.command).toLowerCase().includes(q) || tr.command.toLowerCase().includes(q);
                }).map(tr => (
                  <Button
                    key={tr.id}
                    size="sm"
                    variant="outline"
                    className="h-6 text-[11px] font-mono gap-1"
                    onClick={() => {
                      setTriggerCmd(tr.command);
                      if (tr.skill_id) setSelSkillId(tr.skill_id);
                    }}
                  >
                    <Zap className="h-2.5 w-2.5 text-amber-500" />
                    {getTriggerDisplayLabel(tr.command)}
                  </Button>
                ))}
                {triggers.filter(tr => {
                    const q = triggerSearch.trim().toLowerCase();
                    return !q || getTriggerDisplayLabel(tr.command).toLowerCase().includes(q) || tr.command.toLowerCase().includes(q);
                  }).length === 0 && (
                  <span className="text-[10px] text-muted-foreground">ไม่พบ Trigger</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[11px]">Skill</Label>
              <Input value={skillSearch} onChange={e => setSkillSearch(e.target.value)} placeholder="ค้นหา Skill..." className="h-8 text-xs w-48" />
            </div>
            <Select value={selSkillId} onValueChange={setSelSkillId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="ไม่เลือก" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ไม่เลือก Skill</SelectItem>
                {skills.filter(sk => !skillSearch.trim() || sk.name.toLowerCase().includes(skillSearch.trim().toLowerCase())).map(sk => (
                  <SelectItem key={sk.id} value={sk.id}>{sk.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">
              Brand Context ({selContextIds.length === 0 ? 'ทั้งหมด' : selContextIds.length})
            </Label>
            <div className="flex flex-wrap gap-1 p-1.5 border rounded-md min-h-[32px] bg-background">
              {contexts.map(ctx => {
                const sel = selContextIds.includes(ctx.id);
                return (
                  <button
                    key={ctx.id}
                    type="button"
                    onClick={() => setSelContextIds(ids =>
                      sel ? ids.filter(x => x !== ctx.id) : [...ids, ctx.id]
                    )}
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full border transition-colors',
                      sel ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                    )}
                  >
                    {ctx.name}
                  </button>
                );
              })}
              {contexts.length === 0 && (
                <span className="text-[10px] text-muted-foreground">ไม่มี Context</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">
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

          <div className="space-y-1">
            <Label className="text-[11px]">ประเภทแผน</Label>
            <Select value={planType} onValueChange={setPlanType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">รายสัปดาห์</SelectItem>
                <SelectItem value="monthly">รายเดือน</SelectItem>
                <SelectItem value="quarterly">รายไตรมาส</SelectItem>
                <SelectItem value="yearly">รายปี</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">เริ่ม</Label>
              <Input
                type="date"
                value={planStart}
                onChange={e => setPlanStart(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">สิ้นสุด</Label>
              <Input
                type="date"
                value={planEnd}
                onChange={e => setPlanEnd(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <Button
            className="w-full gap-2 h-8 text-xs"
            disabled={isGenerating || isGeneratingArticles || !triggerCmd.trim()}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังสร้างแผน...</>
            ) : isGeneratingArticles ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังเขียนบทความ {generateProgress || ''}...</>
            ) : (
              <><Wand2 className="h-3.5 w-3.5" />สร้างแผนด้วย AI</>
            )}
          </Button>

          {(isGenerating || isGeneratingArticles) && (
            <Button
              variant="outline"
              className="w-full h-8 text-xs"
              onClick={onCancel}
            >
              ยกเลิก
            </Button>
          )}

          {gwModelName && (
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {gwModelName}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-semibold">แผนทั้งหมด</Label>
            <span className="text-[10px] text-muted-foreground">{plans.length}</span>
          </div>
          {plans.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-4">ยังไม่มีแผน</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {plans.map(pl => {
                const sm = PLAN_STATUS[pl.status] ?? PLAN_STATUS.draft;
                return (
                  <div
                    key={pl.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectPlan(pl)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPlan(pl); } }}
                    className={cn(
                      'w-full text-left p-2 rounded-lg border text-xs transition-colors hover:bg-muted/40 group cursor-pointer',
                      selectedPlanId === pl.id ? 'border-primary bg-primary/5' : ''
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{pl.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">
                          {getTriggerDisplayLabel(pl.trigger_command)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Badge className={cn('text-[9px] px-1 py-0', sm.color)}>{sm.label}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:text-destructive"
                          onClick={e => { e.stopPropagation(); onDeletePlan(pl.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {(pl.items?.length ?? 0) > 0 && (
                      <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-0.5">
                        {pl.items!.slice(0, 5).map(item => {
                          // เดิม hardcode สีแพลตฟอร์มซ้ำกับ PLATFORM_CATALOG และเทียบ
                          // item.platform === 'facebook' แบบ exact-match ซึ่งพังเมื่อ item
                          // มีหลายแพลตฟอร์ม (comma-joined string) ตกไปสีเทาเสมอ ดู
                          // openspec/changes/content-planner-ai-history-dot-color-fix
                          const firstPlatform = parsePlatforms(item.platforms ?? item.platform)[0];
                          const dotColor = firstPlatform ? getPlatformColors(firstPlatform).text : '#9ca3af';
                          return (
                            <div key={item.id} className="flex items-center gap-1 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                              <span className="truncate flex-1">{item.topic}</span>
                              <span className="text-muted-foreground shrink-0">{item.scheduled_date ?? item.day_label}</span>
                            </div>
                          );
                        })}
                        {(pl.items!.length > 5) && (
                          <p className="text-[10px] text-muted-foreground pl-2">+{pl.items!.length - 5} เพิ่มเติม</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
