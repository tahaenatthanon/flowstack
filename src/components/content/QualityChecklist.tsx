import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, MinusCircle, Clock, Loader2 } from 'lucide-react';
import type { SeoRule, SeoRuleStatus } from '@/components/content/types';
import { requiredFailedRules } from '@/components/content/types';

// รายการผลตรวจ SEO/AEO แบบแยกกลุ่ม ข้อบังคับ (Required) / ข้อแนะนำ (Recommended)
// ผ่าน/ไม่ผ่านตัดสินจาก Required rule ที่ failed เท่านั้น — คะแนนแสดงเป็นข้อมูลรอง
// (change quality-required-tiers) ใช้ร่วมกันใน ArticleEditor และหน้าอนุมัติ

const STATUS_META: Record<SeoRuleStatus, { icon: React.ElementType; className: string; label: string }> = {
  passed:            { icon: CheckCircle2,  className: 'text-green-600',             label: 'ผ่าน' },
  needs_improvement: { icon: AlertTriangle, className: 'text-amber-500',             label: 'ควรปรับปรุง' },
  failed:            { icon: XCircle,       className: 'text-destructive',           label: 'ไม่ผ่าน' },
  'n/a':             { icon: MinusCircle,   className: 'text-muted-foreground/50',   label: 'ไม่เกี่ยวข้อง' },
  pending:           { icon: Clock,         className: 'text-muted-foreground',      label: 'รอข้อมูล' },
  skip:              { icon: MinusCircle,   className: 'text-muted-foreground/50',   label: 'ไม่เกี่ยวข้อง' },
};

const LEVEL_TO_STATUS: Record<string, SeoRuleStatus> = {
  pass: 'passed', warn: 'needs_improvement', fail: 'failed', pending: 'pending', skip: 'skip',
};

function ruleStatus(rule: SeoRule): SeoRuleStatus {
  return rule.status ?? LEVEL_TO_STATUS[rule.level] ?? 'pending';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-500';
  return 'text-destructive';
}

export interface QualityChecklistProps {
  /** "SEO" หรือ "AEO" */
  title: string;
  result: { score: number; rules: SeoRule[] } | null;
  loading?: boolean;
  error?: string | null;
  /** เกตของ tenant ปิดอยู่ — ผลไม่บล็อกการขออนุมัติ/เผยแพร่ */
  gateDisabled?: boolean;
}

export default function QualityChecklist({ title, result, loading, error, gateDisabled }: QualityChecklistProps) {
  const failedRequired = requiredFailedRules(result?.rules);
  const required = result?.rules.filter(r => (r.tier ?? 'required') === 'required') ?? [];
  const recommended = result?.rules.filter(r => (r.tier ?? 'required') !== 'required') ?? [];
  const passed = failedRequired.length === 0;

  return (
    <div className="rounded-md border bg-background/60 p-3 space-y-2" data-testid={`quality-checklist-${title.toLowerCase()}`}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">ตรวจ {title}</span>
        {result && (
          <span className={cn('text-[11px] font-medium', passed ? 'text-green-600' : 'text-destructive')}>
            {passed ? 'ผ่าน' : `ไม่ผ่าน (ติดข้อบังคับ ${failedRequired.length} ข้อ)`}
          </span>
        )}
        {result && (
          <span className={cn('ml-auto text-xs font-semibold', scoreColor(result.score))} title="คะแนนเป็นข้อมูลประกอบ ไม่ใช้ตัดสินผ่าน/ไม่ผ่าน">
            {result.score}<span className="text-[10px] font-normal text-muted-foreground">/100</span>
          </span>
        )}
      </div>

      {loading && !result && (
        <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังตรวจ...
        </div>
      )}
      {error && <div className="py-1 text-xs text-destructive">{error}</div>}
      {!loading && !error && !result && (
        <div className="py-1 text-xs text-muted-foreground">ยังไม่ได้ตรวจ</div>
      )}

      {result && gateDisabled && (
        <p className="text-[10px] text-muted-foreground">เกต SEO/AEO ปิดอยู่ — ผลตรวจนี้ไม่บล็อกการขออนุมัติ/เผยแพร่</p>
      )}

      {result && (
        <>
          <RuleGroup label="ข้อบังคับ (Required)" rules={required} testId="required" />
          <RuleGroup label="ข้อแนะนำ (Recommended)" rules={recommended} testId="recommended" />
        </>
      )}
    </div>
  );
}

function RuleGroup({ label, rules, testId }: { label: string; rules: SeoRule[]; testId: string }) {
  if (rules.length === 0) return null;
  return (
    <div className="space-y-1" data-testid={`quality-group-${testId}`}>
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <ul className="space-y-1">
        {rules.map(rule => {
          const status = ruleStatus(rule);
          const meta = STATUS_META[status] ?? STATUS_META.pending;
          const Icon = meta.icon;
          const muted = status === 'skip' || status === 'pending' || status === 'n/a';
          return (
            <li key={rule.key} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
              <Icon className={cn('h-3.5 w-3.5 mt-px shrink-0', meta.className)} aria-label={meta.label} />
              <span className={cn(muted && 'text-muted-foreground/70')}>
                <span className={cn('mr-1 font-medium', meta.className)}>{meta.label}</span>
                {rule.message}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
