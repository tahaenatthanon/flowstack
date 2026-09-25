import { Activity, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPlatformLabel } from '@/lib/platformConfig';
import type { ContentOverview, ScheduleSummaryRow } from '@/components/content/types';
import { ScopeTag, SectionHeading } from './shared';
import { fmtNumber, fmtPct, platformsLabel } from './format';

/**
 * 2. การเผยแพร่ — Publishing Health จากคิวทั้งหมด + สรุปกำหนดการวันนี้/พรุ่งนี้
 * เป็นตัวเลขสรุปเท่านั้น รายการคิวและปุ่มลองส่งใหม่อยู่ในส่วน "งานที่ต้องจัดการ"
 */

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
      <SectionHeading index={2} title="การเผยแพร่" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Publishing Health</span>
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
                <p className="text-xs text-muted-foreground">
                  คิวเผยแพร่ทั้งหมด · ครอบคลุม: {platformsLabel(h?.platforms ?? [])} · ไม่รวมอีเมลแคมเปญ
                </p>
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
            <ScopeTag>วันนี้–พรุ่งนี้</ScopeTag>
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
