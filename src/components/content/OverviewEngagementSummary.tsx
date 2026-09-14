import { Heart, FileText, ThumbsUp, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SocialSnapshot } from '@/components/content/types';

/**
 * แถบการ์ดสรุป Engagement บนสุดของแท็บ "ภาพรวม" — all-time snapshot ไม่ผูกช่วงเวลา
 * (ต่างจากกราฟแนวโน้ม/ตารางด้านล่างที่มีตัวเลือกช่วงเวลาของตัวเอง)
 *
 * รูปแบบการ์ด/การจัดการ "—" ก็อปมาจาก AnalyticsSocialTab.tsx เพื่อความสม่ำเสมอของ UI —
 * ห้ามใส่ mock/placeholder data เด็ดขาด (ดูเหตุผลในคอมเมนต์ของไฟล์นั้น)
 */

interface Props {
  snapshot?: SocialSnapshot;
  isLoading?: boolean;
}

export function OverviewEngagementSummary({ snapshot, isLoading = false }: Props) {
  const hasData = !!snapshot?.has_data;
  const fmt = (n: number) => n.toLocaleString();
  // ยังไม่ซิงก์เลย → "—" ไม่ใช่ 0 (ต่างความหมายกับ "วัดแล้วได้ 0")
  const cellValue = (real: number | null | undefined): string =>
    isLoading ? 'กำลังโหลด...' : real === null || real === undefined ? '—' : fmt(real);

  const cards = [
    {
      key: 'engagement',
      label: 'Engagement รวม',
      icon: Heart,
      color: 'text-pink-600',
      value: hasData ? snapshot!.engagement : null,
    },
    {
      key: 'posts',
      label: 'โพสต์ที่วัดได้',
      icon: FileText,
      color: 'text-blue-600',
      value: hasData ? snapshot!.posts : null,
    },
    {
      key: 'likes',
      label: 'ไลก์รวม',
      icon: ThumbsUp,
      color: 'text-violet-600',
      value: hasData ? snapshot!.likes : null,
    },
    {
      key: 'avg',
      label: 'Engagement เฉลี่ย/โพสต์',
      icon: TrendingUp,
      color: 'text-amber-600',
      value: hasData ? snapshot!.avg_engagement_per_post : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
