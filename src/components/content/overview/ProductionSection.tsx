import { Filter, ListChecks, Hourglass } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STATUS_MAP } from '@/components/content/types';
import type { ContentOverview, FunnelStageKey } from '@/components/content/types';
import { ScopeTag, SectionHeading } from './shared';
import { CONTENT_STATUS_ORDER, fmtNumber, fmtPct } from './format';

/**
 * 1. การผลิต — Production Funnel (คอนเทนต์ทั้งหมด, ทุกขั้นนับ
 * "ถึงขั้นนี้หรือเลยไปแล้ว") + สถานะคอนเทนต์แบบย่อ + คอนเทนต์ที่ยังไม่เผยแพร่ (ณ ตอนนี้)
 */

const STAGE_LABEL: Record<FunnelStageKey, string> = {
  created: 'สร้าง',
  requested: 'ขออนุมัติ',
  approved: 'อนุมัติ',
  published: 'เผยแพร่',
};

const AGING_BUCKETS = [
  { key: 'd0_7' as const,     label: '0–7 วัน',    color: 'text-green-600' },
  { key: 'd8_30' as const,    label: '8–30 วัน',   color: 'text-amber-600' },
  { key: 'd31_90' as const,   label: '31–90 วัน',  color: 'text-orange-600' },
  { key: 'd90_plus' as const, label: 'เกิน 90 วัน', color: 'text-red-600' },
];

interface Props {
  data?: ContentOverview;
  isLoading?: boolean;
}

export function ProductionSection({ data, isLoading = false }: Props) {
  const funnel = data?.funnel;
  // payload ไม่ครบ (เช่น backend ยังเป็นเวอร์ชันเก่าช่วง deploy) → ถือว่าไม่มีข้อมูล ไม่ crash ทั้งหน้า
  const stages = Array.isArray(funnel?.stages) ? funnel!.stages : [];
  const created = stages.find(s => s.key === 'created')?.count ?? 0;
  const status = data?.status_summary;
  const aging = data?.unpublished_aging;

  return (
    <section className="space-y-3">
      <SectionHeading index={1} title="การผลิต" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Production Funnel */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Production Funnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : !funnel || created === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์</p>
            ) : (
              <>
                {stages.map(stage => (
                  <div key={stage.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {STAGE_LABEL[stage.key]}
                        {stage.key === 'approved' && <span className="ml-1 text-xs">(อนุมัติอยู่ ณ ตอนนี้)</span>}
                      </span>
                      <span className="tabular-nums">
                        <span className="font-semibold">{stage.count.toLocaleString('th-TH')}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{fmtPct(stage.pct)}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(stage.count / created) * 100}%` }} />
                    </div>
                  </div>
                ))}
                <p className="border-t pt-2 text-xs text-muted-foreground">
                  ยังอยู่ระหว่างทาง <span className="font-medium text-foreground tabular-nums">{funnel.in_progress.toLocaleString('th-TH')}</span> ชิ้น
                  — คอนเทนต์ที่ยังไม่เผยแพร่ · % = สัดส่วนจากขั้นก่อนหน้า
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* สถานะคอนเทนต์แบบย่อ */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">สถานะคอนเทนต์</span>
            </CardTitle>
            <ScopeTag>ณ ตอนนี้</ScopeTag>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : !status || !status.by_status || status.total === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์</p>
            ) : (
              <div className="space-y-2">
                {CONTENT_STATUS_ORDER.map(key => {
                  const info = STATUS_MAP[key];
                  const Icon = info.icon;
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Icon className={`h-3.5 w-3.5 ${info.iconColor}`} />
                        {info.label}
                      </span>
                      <span className="font-medium tabular-nums">{fmtNumber(status.by_status[key] ?? 0)}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">ทั้งหมด</span>
                  <span className="font-bold tabular-nums">{fmtNumber(status.total)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* คอนเทนต์ที่ยังไม่เผยแพร่ */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Hourglass className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">คอนเทนต์ที่ยังไม่เผยแพร่</span>
            </CardTitle>
            <ScopeTag>ณ ตอนนี้</ScopeTag>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : !aging || aging.total === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">เผยแพร่ครบทุกชิ้น</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {AGING_BUCKETS.map(b => (
                    <div key={b.key} className="rounded-lg border p-2">
                      <p className="text-xs text-muted-foreground">{b.label}</p>
                      <p className={`text-lg font-bold tabular-nums ${b.color}`}>{aging[b.key].toLocaleString('th-TH')}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">รวม (นับอายุจากวันที่สร้าง)</span>
                  <span className="font-bold tabular-nums">{aging.total.toLocaleString('th-TH')}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
