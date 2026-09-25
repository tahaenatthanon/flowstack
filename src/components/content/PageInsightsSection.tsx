import { Users, Eye, PlayCircle, UserPlus, Heart, Video, Timer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageInsights } from '@/hooks/useContent';
import { formatDurationMs } from '@/lib/durationFormat';
import type { PageInsights } from './types';

/**
 * ข้อมูลระดับเพจ Facebook บนสุดของ sub-tab "โซเชียล" — 5 ส่วนตาม "ชุด metric แบบสั้น"
 * (ดู content-dashboard-page-insights spec) ข้อมูลจาก ?action=page_insights ซึ่งอ่านตาราง
 * facebook_page_insights_daily ที่ cron facebook-page-insights-sync เก็บวันละครั้ง
 *
 * backend รวมค่าตามความหมายของแต่ละ metric ให้แล้ว (page_follows = ค่าล่าสุด ไม่ใช่ผลรวม)
 * component นี้ห้ามรวมค่ารายวันเองซ้ำ — อ่านจาก totals เท่านั้น ยกเว้นกราฟรายวัน
 *
 * ห้ามใส่ mock data — ไม่มีข้อมูลให้แสดง "—" / empty state ไม่ใช่ 0
 */

const REACTIONS = [
  { key: 'page_actions_post_reactions_like_total', label: 'Like', emoji: '👍' },
  { key: 'page_actions_post_reactions_love_total', label: 'Love', emoji: '❤️' },
  { key: 'page_actions_post_reactions_wow_total',  label: 'Wow',  emoji: '😮' },
  { key: 'page_actions_post_reactions_haha_total', label: 'Haha', emoji: '😆' },
] as const;

/** 'YYYY-MM-DD' → '24 ก.ย.' */
function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

interface Props {
  from?: string;
  to?: string;
}

export function PageInsightsSection({ from, to }: Props) {
  const { data, isLoading } = usePageInsights(from, to);
  return <PageInsightsView data={data} isLoading={isLoading} />;
}

interface ViewProps {
  data?: PageInsights;
  isLoading?: boolean;
}

/** แยกส่วนแสดงผลออกจาก hook เพื่อให้ทดสอบด้วยข้อมูลตรง ๆ ได้ */
export function PageInsightsView({ data, isLoading = false }: ViewProps) {
  const hasData = !!data?.has_data;
  const t = data?.totals ?? {};
  const num = (key: string): number | null => (hasData && typeof t[key] === 'number' ? (t[key] as number) : null);
  const show = (n: number | null): string => (isLoading ? 'กำลังโหลด...' : n === null ? '—' : n.toLocaleString());

  const followers = num('page_follows');
  const followersFirst = hasData ? data?.first?.page_follows ?? null : null;
  const followersChange = followers !== null && followersFirst !== null ? followers - followersFirst : null;

  const header = (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">ข้อมูลเพจ Facebook</h3>
      {data?.last_fetched_at && (
        <span className="shrink-0 text-xs text-muted-foreground">
          ซิงก์ล่าสุด {new Date(data.last_fetched_at).toLocaleString('th-TH')}
        </span>
      )}
    </div>
  );

  if (!isLoading && !hasData) {
    return (
      <div className="space-y-2">
        {header}
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลเพจ
            <br />
            ระบบจะเริ่มเก็บข้อมูลเพจ Facebook หลังงานซิงก์รอบแรก (วันละครั้ง)
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── 1) ภาพรวมเพจ ──
  const overviewCards = [
    {
      key: 'followers', label: 'ผู้ติดตาม', icon: Users, color: 'text-blue-600', value: followers,
      hint: followersChange === null ? null
        : followersChange === 0 ? 'ไม่เปลี่ยนแปลงในช่วงนี้'
        : `${followersChange > 0 ? '+' : '−'}${Math.abs(followersChange).toLocaleString()} ในช่วงนี้`,
    },
    { key: 'views', label: 'เข้าชมเพจ', icon: Eye, color: 'text-amber-600', value: num('page_views_total'), hint: null },
    { key: 'media', label: 'การดูสื่อ', icon: PlayCircle, color: 'text-violet-600', value: num('page_media_view'), hint: null },
  ];

  // ── 2) ผู้ติดตาม — กราฟรายวัน follow / unfollow ──
  const followDaily = (data?.daily ?? []).map(d => ({
    label: formatDay(d.date),
    follows: typeof d.page_daily_follows === 'number' ? d.page_daily_follows : 0,
    unfollows: typeof d.page_daily_unfollows === 'number' ? d.page_daily_unfollows : 0,
  }));
  const totalFollows = num('page_daily_follows');
  const totalUnfollows = num('page_daily_unfollows');
  const followActivity = (totalFollows ?? 0) + (totalUnfollows ?? 0) > 0;

  // ── 3) Reaction ──
  const reactionTotal = num('page_actions_post_reactions_total');
  const reactionRows = REACTIONS.map(r => ({ ...r, value: num(r.key) ?? 0 }));
  const maxReaction = Math.max(...reactionRows.map(r => r.value), 1);

  // ── 4) วิดีโอ — จำนวนการดู ──
  const videoViews = num('page_video_views');
  const videoRows = [
    { key: 'organic', label: 'Organic', value: num('page_video_views_organic') ?? 0, bar: 'bg-emerald-500' },
    { key: 'paid', label: 'Paid (โฆษณา)', value: num('page_video_views_paid') ?? 0, bar: 'bg-orange-500' },
  ];
  const maxVideo = Math.max(...videoRows.map(r => r.value), 1);

  // ── 5) วิดีโอ — ระยะเวลาการดู (ms → นาที/ชม.) ──
  const viewTimeMs = num('page_video_view_time');

  return (
    <div className="space-y-4">
      {header}

      {/* 1) ภาพรวมเพจ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {overviewCards.map(card => {
          const Icon = card.icon;
          const display = show(card.value);
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold tabular-nums ${display === '—' ? 'text-muted-foreground' : ''}`}>{display}</div>
                {card.hint && <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 2) ผู้ติดตาม */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">การติดตาม / เลิกติดตาม รายวัน</span>
            </CardTitle>
            <span className="shrink-0 text-xs text-muted-foreground">
              +{show(totalFollows)} / −{show(totalUnfollows)}
            </span>
          </CardHeader>
          <CardContent>
            {!followActivity ? (
              <p className="py-12 text-center text-sm text-muted-foreground">ไม่มีการติดตามหรือเลิกติดตามในช่วงวันที่ที่เลือก</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={followDaily} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={16} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="follows" name="ติดตาม" fill="#10B981" />
                  <Bar dataKey="unfollows" name="เลิกติดตาม" fill="#EF4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 3) Reaction */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Heart className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Reaction ของโพสต์</span>
            </CardTitle>
            <span className="shrink-0 text-xs text-muted-foreground">รวม {show(reactionTotal)}</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {!reactionTotal ? (
              <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มี reaction ในช่วงวันที่ที่เลือก</p>
            ) : (
              reactionRows.map(r => (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{r.emoji} {r.label}</span>
                    <span className="font-mono">{r.value.toLocaleString()}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-pink-500 rounded-full" style={{ width: `${(r.value / maxReaction) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 4) วิดีโอ — จำนวนการดู */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">วิดีโอ — จำนวนการดู</span>
            </CardTitle>
            <span className="shrink-0 text-xs text-muted-foreground">ทั้งหมด {show(videoViews)}</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {!videoViews ? (
              <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีการดูวิดีโอในช่วงวันที่ที่เลือก</p>
            ) : (
              videoRows.map(r => (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{r.label}</span>
                    <span className="font-mono">{r.value.toLocaleString()}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${(r.value / maxVideo) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 5) วิดีโอ — ระยะเวลาการดู */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Timer className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">วิดีโอ — ระยะเวลาการดู</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums ${viewTimeMs === null ? 'text-muted-foreground' : ''}`}>
              {isLoading ? 'กำลังโหลด...' : formatDurationMs(viewTimeMs)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">เวลารวมที่ผู้ชมดูวิดีโอของเพจในช่วงวันที่ที่เลือก</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
