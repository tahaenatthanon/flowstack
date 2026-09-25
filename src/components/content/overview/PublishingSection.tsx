import { Activity, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPlatformLabel } from '@/lib/platformConfig';
import { PLATFORM_MAP } from '@/components/content/types';
import type { ContentOverview, QueueFailure, ScheduleSummaryRow } from '@/components/content/types';
import { fmtNumber, fmtPct } from './format';

/**
 * 2. การเผยแพร่ — Publishing Health จากคิวทั้งหมด + สรุปกำหนดการวันนี้/พรุ่งนี้
 * ใต้ Success Rate แสดงรายการที่ล้มเหลว (ข้อยกเว้นเดียวของ "ส่วน BI ไม่แสดงรายการรายชิ้น")
 * เพื่อให้เห็นรายการที่มีปัญหาทันที — แสดงอย่างเดียว ไม่มีปุ่มลองส่งใหม่
 */

function formatDateTime(d: string): string {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function FailureList({ failures, total }: { failures: QueueFailure[]; total: number }) {
  if (failures.length === 0) return null;
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">การเผยแพร่ที่ล้มเหลว</p>
      <ul className="space-y-2">
        {failures.map(f => {
          const platform = f.platform ? PLATFORM_MAP[f.platform] : undefined;
          const platformLabel = f.platform ? (platform?.label ?? getPlatformLabel(f.platform)) : null;
          return (
            <li key={f.id} className="space-y-1 rounded-lg border border-red-200 bg-red-50/50 p-2 dark:border-red-900 dark:bg-red-950/20">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium" title={f.title}>{f.title}</p>
                {platformLabel ? (
                  <Badge variant="outline" className={`shrink-0 ${platform?.color ?? ''}`}>{platformLabel}</Badge>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">ไม่ระบุแพลตฟอร์ม</span>
                )}
              </div>
              {/* ชื่อช่องทางเฉพาะเมื่อไม่ซ้ำกับชื่อแพลตฟอร์ม (เช่น channel ชื่อ "Facebook") */}
              {f.channel_name && f.channel_name !== platformLabel && (
                <p className="truncate text-xs text-muted-foreground">ช่องทาง: {f.channel_name}</p>
              )}
              <p className="whitespace-pre-line break-words text-xs text-red-700 dark:text-red-300">
                {f.error_msg?.trim() || 'ไม่ทราบสาเหตุ'}
              </p>
              <p className="text-xs text-muted-foreground">
                {f.retry_count > 0 ? `ลองส่งแล้ว ${f.retry_count.toLocaleString('th-TH')} ครั้ง` : 'ยังไม่ลองส่งใหม่'}
                {' · '}กำหนดส่ง {formatDateTime(f.scheduled_at)}
              </p>
            </li>
          );
        })}
      </ul>
      {total > failures.length && (
        <p className="text-xs text-muted-foreground">
          แสดง {failures.length.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')} รายการ
        </p>
      )}
    </div>
  );
}

interface Props {
  data?: ContentOverview;
  isLoading?: boolean;
}

function ScheduleDay({ title, rows }: { title: string; rows: ScheduleSummaryRow[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่มีกำหนดการ</p>
      ) : (
        rows.map(r => (
          <div key={`${r.time}-${r.platform ?? ''}`} className="flex items-center justify-between text-sm">
            <span className="tabular-nums">{r.time}</span>
            <span className="flex-1 truncate px-3 text-muted-foreground">{r.platform ? getPlatformLabel(r.platform) : 'ไม่ระบุแพลตฟอร์ม'}</span>
            <span className="font-medium tabular-nums">{r.count.toLocaleString('th-TH')} รายการ</span>
          </div>
        ))
      )}
    </div>
  );
}

export function PublishingSection({ data, isLoading = false }: Props) {
  const h = data?.publishing_health;
  const sched = data?.schedule_summary;
  const stats = [
    { key: 'pending', label: 'รอดำเนินการ', value: fmtNumber(h?.pending), color: 'text-amber-600' },
    { key: 'sent', label: 'ส่งสำเร็จ', value: fmtNumber(h?.sent), color: 'text-green-600' },
    { key: 'failed', label: 'ส่งไม่สำเร็จ', value: fmtNumber(h?.failed), color: 'text-red-600' },
  ];

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">ภาพรวมการเผยแพร่</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {stats.map(s => (
                    <div key={s.key} className="rounded-lg border p-2">
                      <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-baseline justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">Success Rate</span>
                  <span className="text-xl font-bold tabular-nums">{fmtPct(h?.success_rate)}</span>
                </div>
                <FailureList failures={h?.failures ?? []} total={h?.failed ?? 0} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">กำหนดการ</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading || !sched ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{isLoading ? 'กำลังโหลด...' : 'ไม่มีข้อมูล'}</p>
            ) : (
              <>
                <ScheduleDay title="วันนี้" rows={sched.today?.rows ?? []} />
                <ScheduleDay title="พรุ่งนี้" rows={sched.tomorrow?.rows ?? []} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
