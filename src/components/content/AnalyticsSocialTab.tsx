import { Heart, Eye, ThumbsUp, FileText, TrendingUp, Info, ExternalLink, BarChart3, Trophy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SocialEngagementSummary } from './types';

/**
 * sub-tab "โซเชียล"
 *
 * ทุกตัวเลข/กราฟ/รายการในหน้านี้มาจากข้อมูลจริงใน `social` ที่ backend คำนวณจาก
 * ตาราง time-series `content_post_metrics` (cron `content-metrics-sync`) เท่านั้น
 * — ครอบคลุมเฉพาะแพลตฟอร์มที่มีข้อมูลจริงในช่วงที่เลือก (อ่านจาก `social.platforms`)
 *
 * ห้ามใส่ mock data หรือค่า hardcode เด็ดขาด เพราะจะทำให้ผู้ใช้เข้าใจผิดว่ามีข้อมูลแล้ว
 * เมตริกระดับเพจ (followers/reach/impressions/engagement rate) ยังไม่แสดงในเฟสนี้
 * เพราะต้องเชื่อมต่อ OAuth page insights ซึ่งเป็นงาน integration เฟสถัดไป
 */

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
};

function platformLabel(platform: string): string {
  // cross-post คั่นด้วย '/' — แปลงทีละส่วนแล้วต่อกลับ
  return platform
    .split('/')
    .map(p => PLATFORM_LABELS[p] ?? p)
    .join(' / ');
}

function formatPlatforms(platforms: string[]): string {
  if (!platforms.length) return 'ยังไม่มีแพลตฟอร์มที่มีข้อมูล';
  return platforms.map(platformLabel).join(', ');
}

/** 'YYYY-MM' → 'ส.ค. 69' (พ.ศ. 2 หลัก) — ให้ตรงกับ ContentThroughputChart */
function formatPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

interface Props {
  /** จาก `useContentAnalytics` — ส่งเป็น prop ตามแบบ AnalyticsContentTab (query เดียวต่อหน้า) */
  social?: SocialEngagementSummary;
  socialLoading?: boolean;
}

export function AnalyticsSocialTab({ social, socialLoading = false }: Props) {
  const hasData = !!social?.has_data;
  const platformsLabel = formatPlatforms(social?.platforms ?? []);

  // ยังไม่ซิงก์เลย → "—" ไม่ใช่ 0 เพราะ 0 อ่านได้ว่า "ไม่มีคนมีปฏิสัมพันธ์"
  // ซึ่งต่างจาก "ยังไม่ได้วัด"
  const fmt = (n: number) => n.toLocaleString();
  const cellValue = (real: number | null): string =>
    socialLoading ? 'กำลังโหลด...' : real === null ? '—' : fmt(real);

  const statCards = [
    {
      key: 'engagement',
      label: 'Engagement รวม',
      icon: Heart,
      color: 'text-pink-600',
      value: hasData ? social!.engagement : null,
      hint: 'วิว + ไลก์',
    },
    {
      key: 'posts',
      label: 'โพสต์ที่วัดได้',
      icon: FileText,
      color: 'text-blue-600',
      value: hasData ? social!.posts : null,
      hint: 'ที่ซิงก์ข้อมูลสำเร็จ',
    },
    {
      key: 'likes',
      label: 'ไลก์รวม',
      icon: ThumbsUp,
      color: 'text-violet-600',
      value: hasData ? social!.likes : null,
      hint: null,
    },
    {
      key: 'views',
      label: 'วิวรวม',
      icon: Eye,
      color: 'text-amber-600',
      value: hasData ? social!.views : null,
      // อธิบายตรง ๆ ว่าทำไมวิวเป็น 0 (Facebook feed post คืน 0) แทนที่จะซ่อน
      hint: hasData && social!.views === 0 ? 'โพสต์ Facebook feed คืน 0' : null,
    },
  ];

  const monthly = social?.monthly ?? [];
  const monthlyData = monthly.map(m => ({ ...m, label: formatPeriod(m.month) }));
  const monthlyHasActivity = monthly.some(m => m.engagement > 0);

  const byPlatform = social?.by_platform ?? [];
  const maxPlatformEng = Math.max(...byPlatform.map(p => p.engagement), 1);

  const topPosts = social?.top_posts ?? [];

  return (
    <div className="space-y-6">
      {/* แถว stat card — ค่าทุกใบมาจาก social เท่านั้น */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">ภาพรวม Engagement</h3>
          <span className="shrink-0 text-xs text-muted-foreground">ครอบคลุม: {platformsLabel}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map(card => {
            const Icon = card.icon;
            const display = cellValue(card.value);
            const isEmpty = display === '—';
            return (
              <Card key={card.key}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                  <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${isEmpty ? 'text-muted-foreground' : ''}`}>
                    {display}
                  </div>
                  {card.hint && <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ไม่มีข้อมูล → empty state ชัดเจน ไม่วาดกราฟ/ตารางจากค่า 0 ปลอม */}
      {!socialLoading && !hasData && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            ยังไม่มีโพสต์ที่ซิงก์ข้อมูลในช่วงวันที่ที่เลือก
            <br />
            เมื่อมีโพสต์ Facebook/Instagram ที่เผยแพร่สำเร็จและงานซิงก์ดึงเมตริกกลับมาแล้ว
            กราฟแนวโน้ม รายแพลตฟอร์ม และโพสต์เด่นจะปรากฏที่นี่
          </CardContent>
        </Card>
      )}

      {/* กราฟแนวโน้ม engagement รายเดือน (มิเรอร์ ContentThroughputChart) */}
      {hasData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">แนวโน้ม Engagement รายเดือน</span>
            </CardTitle>
            <span className="shrink-0 text-xs text-muted-foreground">ตามเดือนที่เผยแพร่</span>
          </CardHeader>
          <CardContent>
            {!monthlyHasActivity ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                ยังไม่มี engagement ในช่วงวันที่ที่เลือก
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={52} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    labelFormatter={(l) => `เดือน ${l}`}
                    formatter={(value: number) => [`${value.toLocaleString()}`, 'Engagement']}
                  />
                  <Line
                    type="monotone"
                    dataKey="engagement"
                    name="Engagement"
                    stroke="#EC4899"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* breakdown รายแพลตฟอร์ม — เฉพาะแพลตฟอร์มที่มีข้อมูลจริง */}
      {hasData && byPlatform.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">แยกตามแพลตฟอร์ม</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byPlatform.map(p => {
              const pct = (p.engagement / maxPlatformEng) * 100;
              return (
                <div key={p.platform} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{platformLabel(p.platform)}</span>
                    <span className="text-muted-foreground">
                      {p.posts.toLocaleString()} โพสต์ · {p.views.toLocaleString()} วิว · {p.likes.toLocaleString()} ไลก์
                      {' · '}<span className="font-mono text-foreground">{p.engagement.toLocaleString()}</span> engagement
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-pink-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ตารางโพสต์เด่น */}
      {hasData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">โพสต์เด่น (เรียงตาม Engagement)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPosts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีโพสต์ที่วัดได้</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">คอนเทนต์</th>
                      <th className="py-2 px-3 font-medium">แพลตฟอร์ม</th>
                      <th className="py-2 px-3 font-medium whitespace-nowrap">วันเผยแพร่</th>
                      <th className="py-2 px-3 font-medium text-right">วิว</th>
                      <th className="py-2 px-3 font-medium text-right">ไลก์</th>
                      <th className="py-2 pl-3 font-medium text-right">Engagement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPosts.map(post => (
                      <tr key={post.content_item_id} className="border-b last:border-0">
                        <td className="py-2 pr-3 max-w-[280px]">
                          {post.published_url ? (
                            <a
                              href={post.published_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <span className="truncate">{post.title || '(ไม่มีชื่อ)'}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="truncate text-foreground">{post.title || '(ไม่มีชื่อ)'}</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs">
                            {platformLabel(post.platform)}
                          </span>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{formatDate(post.published_at)}</td>
                        <td className="py-2 px-3 text-right font-mono">{post.views.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right font-mono">{post.likes.toLocaleString()}</td>
                        <td className="py-2 pl-3 text-right font-mono font-semibold">{post.engagement.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* notice card — สะท้อนขอบเขตจริง ไม่สัญญาว่าเมตริกระดับเพจ "กำลังจะมา" */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">ตัวเลขนี้ครอบคลุมอะไร</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            ทุกตัวเลขในหน้านี้คือ engagement ระดับโพสต์ (วิว + ไลก์) ดึงกลับจาก Graph API โดยงานซิงก์อัตโนมัติ
            ครอบคลุมเฉพาะ <span className="text-foreground">{platformsLabel}</span> ที่เผยแพร่ในช่วงวันที่ที่เลือก
            {social?.last_fetched_at && (
              <> · ซิงก์ล่าสุด {new Date(social.last_fetched_at).toLocaleString('th-TH')}</>
            )}
          </p>
          <p>
            <span className="text-foreground">วิว</span> และ <span className="text-foreground">ไลก์</span> แสดงแยกกัน —
            ปัจจุบันโพสต์ Facebook feed คืนค่าวิวเป็น 0 ดังนั้น Engagement รวม (= วิว + ไลก์) จึงมาจากไลก์เป็นหลัก
          </p>
          <p>
            เมตริกระดับเพจ — ผู้ติดตาม (followers), Reach, Impressions, Engagement Rate — ยังไม่แสดงในเฟสนี้
            เพราะต้องเชื่อมต่อ OAuth page insights (Facebook Graph / Instagram) ซึ่งเป็นงาน integration เฟสถัดไป
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
