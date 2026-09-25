import { Users, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PageSummary } from '@/components/content/types';

/**
 * การ์ดเพจ Facebook 2 ใบในแท็บ "ภาพรวม" — ช่วง 28 วันล่าสุดคงที่ ไม่ผูกตัวเลือกช่วงเวลาของ widget อื่น
 * (ดู content-overview-social-performance spec) ข้อมูลจาก overview.page_summary
 *
 * รูปแบบการ์ด/การจัดการ "—" ตาม OverviewEngagementSummary — ห้ามใส่ mock data
 */

interface Props {
  summary?: PageSummary;
  isLoading?: boolean;
}

export function OverviewPageSummary({ summary, isLoading = false }: Props) {
  const hasData = !!summary?.has_data;
  // ยังไม่ซิงก์ข้อมูลเพจ → "—" ไม่ใช่ 0
  const cellValue = (real: number | null | undefined): string =>
    isLoading ? 'กำลังโหลด...' : !hasData || real === null || real === undefined ? '—' : real.toLocaleString();

  const change = hasData ? summary!.followers_change : null;
  const changeHint = change === null ? null
    : change === 0 ? 'ไม่เปลี่ยนแปลง'
    : `${change > 0 ? '+' : '−'}${Math.abs(change).toLocaleString()}`;

  const cards = [
    { key: 'followers', label: 'ผู้ติดตาม', icon: Users, color: 'text-blue-600', value: summary?.followers, hint: changeHint },
    { key: 'page_views', label: 'เข้าชมเพจ', icon: Eye, color: 'text-amber-600', value: summary?.page_views, hint: null },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {cards.map(card => {
        const Icon = card.icon;
        const display = cellValue(card.value);
        const isEmpty = display === '—';
        return (
          <Card key={card.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">{card.label}</CardTitle>
              <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-xl sm:text-2xl font-bold font-heading tabular-nums ${isEmpty ? 'text-muted-foreground' : ''}`}>
                {display}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                28 วันล่าสุด{card.hint ? ` · ${card.hint}` : ''}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
