import { Heart, FileText, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContentOverview, EngagementBreakdown } from '@/components/content/types';
import { fmtNumber, platformsLabel } from './format';

/**
 * Global KPI จากข้อมูลทั้งหมด (ไม่มีการเปรียบเทียบช่วงเวลา)
 * Engagement = Reaction + Comment + Share + Click ของโพสต์ที่เผยแพร่แล้ว — Posts / Avg/Post ใช้ชุดเดียวกัน
 * ส่วนผู้ติดตามเป็นระดับเพจ จึงตั้งชื่อ "ผู้ติดตามเพจ" และไม่นำไปคำนวณร่วม
 */

const INSIGHTS_NOTE = 'ตัวเลขจาก Facebook Insights อาจต่างจากที่เห็นบนหน้าเพจ';

function breakdownHint(b: EngagementBreakdown | null | undefined): string {
  if (!b) return 'Reaction + Comment + Share + Click';
  return `Reaction ${fmtNumber(b.reactions)} · Comment ${fmtNumber(b.comments)} · Share ${fmtNumber(b.shares)} · Click ${fmtNumber(b.clicks)}`;
}

interface Props {
  kpi?: ContentOverview['kpi'];
  isLoading?: boolean;
}

export function GlobalKpiRow({ kpi, isLoading = false }: Props) {
  const cards: { key: string; label: string; icon: typeof Heart; color: string; value: string; hint: string; title?: string }[] = [
    {
      key: 'engagement', label: 'Engagement', icon: Heart, color: 'text-pink-600',
      // posts = 0 → engagement เป็น null ("—")
      value: fmtNumber(kpi?.engagement), hint: breakdownHint(kpi?.breakdown), title: INSIGHTS_NOTE,
    },
    {
      key: 'posts', label: 'Posts', icon: FileText, color: 'text-blue-600',
      value: kpi && kpi.posts > 0 ? fmtNumber(kpi.posts) : '—', hint: 'โพสต์ที่เผยแพร่แล้วและวัดผลได้',
    },
    {
      key: 'avg', label: 'Avg/Post', icon: TrendingUp, color: 'text-amber-600',
      value: fmtNumber(kpi?.avg_per_post, 1), hint: 'Engagement ÷ Posts',
    },
    {
      key: 'followers', label: 'ผู้ติดตามเพจ', icon: Users, color: 'text-violet-600',
      value: fmtNumber(kpi?.followers?.current),
      hint: `ยอดล่าสุด ระดับเพจ · ครอบคลุม: ${platformsLabel(kpi?.followers?.platforms ?? [])}`,
    },
  ];

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(card => {
          const Icon = card.icon;
          const display = isLoading ? 'กำลังโหลด...' : card.value;
          return (
            <Card key={card.key} title={card.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium sm:text-sm">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
              </CardHeader>
              <CardContent className="space-y-1">
                <div className={`text-xl font-bold font-heading tabular-nums sm:text-2xl ${display === '—' ? 'text-muted-foreground' : ''}`}>
                  {display}
                </div>
                <p className="text-xs text-muted-foreground">{card.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        ข้อมูลทั้งหมดตั้งแต่เริ่มใช้งาน · ครอบคลุมโพสต์: {platformsLabel(kpi?.platforms ?? [])}
      </p>
    </div>
  );
}
