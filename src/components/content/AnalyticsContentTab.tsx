import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  FileText, CheckCircle2, Activity, Target, Share2, TrendingUp,
  Timer, Gauge, SearchCheck, GitBranch, Send, Eye, ThumbsUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PLATFORM_MAP } from '@/components/content/types';
import type {
  ContentItem, ContentAnalytics, ResultMetricsResponse, PostingAnalyticsResponse,
} from '@/components/content/types';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { BestTimeAnalyticsPanel } from '@/components/content/BestTimeAnalyticsPanel';
import { ContentThroughputChart } from '@/components/content/ContentThroughputChart';
import { getPlatformColors } from '@/lib/platformConfig';

/** ข้อความกำกับ widget ที่ตัวเลขไม่เปลี่ยนตามตัวกรองช่วงวันที่ */
const SNAPSHOT_LABEL = 'ไม่ผูกช่วงวันที่ที่เลือก';

const SENT_COLOR = '#10B981';
const FAILED_COLOR = '#EF4444';

interface Props {
  items: ContentItem[];
  biAnalytics: ContentAnalytics | undefined;
  biAnalyticsLoading: boolean;
  resultMetrics: ResultMetricsResponse | undefined;
  metricsLoading: boolean;
  postingAnalytics: PostingAnalyticsResponse | undefined;
  analyticsLoading: boolean;
  onRecalculate: () => void;
  isRecalculating: boolean;
  /** ช่วงวันที่ที่ผู้ใช้เลือก — ใช้เป็น fallback ก่อน response มาถึง */
  from: string;
  to: string;
}

/** 'YYYY-MM-DD' → '1 ก.ย. 2568' */
function formatDay(d: string): string {
  const t = new Date(`${d}T00:00:00`);
  return Number.isNaN(t.getTime())
    ? d
    : t.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

const formatHours = (h: number | null) =>
  h === null ? '—' : h < 1 ? `${Math.round(h * 60)} นาที` : `${h.toFixed(1)} ชม.`;

const platformLabel = (p: string) =>
  p === '__unknown__' ? 'ไม่ระบุแพลตฟอร์ม' : (PLATFORM_MAP[p]?.label ?? p);

export function AnalyticsContentTab({
  items,
  biAnalytics,
  biAnalyticsLoading,
  resultMetrics,
  metricsLoading,
  postingAnalytics,
  analyticsLoading,
  onRecalculate,
  isRecalculating,
  from,
  to,
}: Props) {
  // ช่วงวันที่ที่ backend ใช้จริง — ถ้า response ยังไม่มาใช้ค่าที่ผู้ใช้เลือกไว้
  const appliedRange = biAnalytics?.range ?? { from, to };
  const rangeCaption = `${formatDay(appliedRange.from)} – ${formatDay(appliedRange.to)}`;

  // ── Stat cards (respect ช่วงวันที่ — นับจาก created_at ฝั่ง backend) ──
  const stats = biAnalytics?.stats;
  const statValue = (render: (s: NonNullable<typeof stats>) => string) =>
    biAnalyticsLoading ? 'กำลังโหลด...' : stats ? render(stats) : '—';

  const contentStatCards = [
    {
      key: 'total',
      label: 'จำนวนคอนเทนต์ทั้งหมด',
      value: statValue(s => s.total.toLocaleString()),
      hint: null as string | null,
      icon: FileText,
      color: 'text-blue-600',
    },
    {
      key: 'published',
      label: 'เผยแพร่แล้ว',
      value: statValue(s => s.published.toLocaleString()),
      hint: null as string | null,
      icon: CheckCircle2,
      color: 'text-green-600',
    },
    {
      key: 'engagement',
      // 0 คือค่าจริง ไม่ใช่ "ไม่มีข้อมูล" — views/likes ยังกรอกมือทั้งหมด
      label: 'Engagement รวม',
      value: statValue(s => s.engagement.toLocaleString()),
      hint: 'ยังไม่มีการซิงก์ engagement จากแพลตฟอร์ม',
      icon: Activity,
      color: 'text-cyan-600',
    },
    {
      key: 'performance',
      label: 'Content Performance',
      value: statValue(s => s.performance_pct === null ? 'ยังไม่มีข้อมูล' : `${s.performance_pct}%`),
      hint: biAnalyticsLoading || !stats
        ? null
        : stats.performance_pct === null
          ? 'ยังไม่มีคอนเทนต์ในช่วงวันที่นี้'
          : `เผยแพร่ ${stats.published.toLocaleString()} จาก ${stats.total.toLocaleString()} ชิ้น`,
      icon: Target,
      color: 'text-violet-600',
    },
  ];

  // ── แพลตฟอร์ม (donut) — นับจาก items ทั้งหมด ไม่ผูกช่วงวันที่ ──
  const platformCounts = items.reduce<Record<string, number>>((acc, item) => {
    const p = (item.platform ?? 'unknown').trim().toLowerCase();
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const platformSlices = Object.entries(platformCounts)
    .sort(([pa, a], [pb, b]) => {
      const diff = b - a;
      if (diff !== 0) return diff;
      const nameA = PLATFORM_MAP[pa]?.label ?? pa;
      const nameB = PLATFORM_MAP[pb]?.label ?? pb;
      return nameA.localeCompare(nameB);
    })
    .map(([platform, count]) => ({
      platform,
      name: PLATFORM_MAP[platform]?.label ?? platform,
      value: count,
      // สี slice มาจาก platformConfig เดียวกับไอคอนช่องทางทั่วทั้งระบบ
      color: getPlatformColors(platform).text,
    }));

  // ── เนื้อหายอดนิยม — logic เดิม: views + likes*2, top 5 ──
  const engagementScore = (i: ContentItem) => (Number(i.views) || 0) + (Number(i.likes) || 0) * 2;
  const topContent = [...items]
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, 5);

  // ── ประสิทธิภาพการผลิต ──
  const avgProductionHours = resultMetrics?.avg_production_hours ?? null;
  const approvedCount = resultMetrics?.approved_count ?? 0;
  const postsLast7Days = resultMetrics?.posts_last_7_days ?? 0;
  const weeklyTarget = resultMetrics?.weekly_posts_target ?? 0;

  const frequencyHint = weeklyTarget === 0
    ? 'ยังไม่ได้ตั้งเป้าหมาย'
    : postsLast7Days > weeklyTarget
      ? `เกินเป้าหมาย (เป้า ${weeklyTarget} โพสต์)`
      : postsLast7Days === weeklyTarget
        ? `ตรงเป้าหมาย (เป้า ${weeklyTarget} โพสต์)`
        : `ต่ำกว่าเป้าหมาย (เป้า ${weeklyTarget} โพสต์)`;

  // ── อัตราสำเร็จการเผยแพร่ (stacked bar) ──
  const publishRows = (biAnalytics?.publish_success ?? []).map(row => ({
    ...row,
    label: platformLabel(row.platform),
  }));

  return (
    <div className="space-y-6">
      {/* Content Stat Cards — KpiCard pattern */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">นับจากคอนเทนต์ที่สร้างในช่วง {rangeCaption}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {contentStatCards.map(card => {
            const Icon = card.icon;
            return (
              <Card key={card.key}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                  <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  {card.hint && <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* แพลตฟอร์ม (donut) + เนื้อหายอดนิยม */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* แพลตฟอร์ม */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Share2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">แพลตฟอร์ม</span>
            </CardTitle>
            <span className="shrink-0 text-xs text-muted-foreground">{SNAPSHOT_LABEL}</span>
          </CardHeader>
          <CardContent>
            {platformSlices.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูล</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={platformSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {platformSlices.map(s => (
                      <Cell key={s.platform} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(value: number, name: string) => [`${value.toLocaleString()} ชิ้น`, name]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value: string) => {
                      const slice = platformSlices.find(s => s.name === value);
                      return slice ? `${value} (${slice.value.toLocaleString()})` : value;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* เนื้อหายอดนิยม */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">เนื้อหายอดนิยม</span>
            </CardTitle>
            <span className="shrink-0 text-xs text-muted-foreground">{SNAPSHOT_LABEL}</span>
          </CardHeader>
          <CardContent>
            {topContent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีเนื้อหา</p>
            ) : (
              <div className="space-y-3">
                {topContent.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold tabular-nums">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {(Number(item.views) || 0).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {(Number(item.likes) || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* เวลาที่ดีที่สุดในการโพสต์ — panel จัดการหัวข้อ/empty state ของตัวเอง */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-end px-4 pt-3">
          <span className="text-xs text-muted-foreground">{SNAPSHOT_LABEL}</span>
        </div>
        <BestTimeAnalyticsPanel
          analytics={postingAnalytics}
          isLoading={analyticsLoading}
          onRecalculate={onRecalculate}
          isRecalculating={isRecalculating}
        />
      </Card>

      {/* ประสิทธิภาพการผลิต */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Timer className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">ประสิทธิภาพการผลิต</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* เวลาผลิตเฉลี่ย — respect ช่วงวันที่ (กรองด้วย approved_at) */}
            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                  <Timer className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                  <span className="truncate">เวลาผลิตเฉลี่ย</span>
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {metricsLoading
                  ? 'กำลังโหลด...'
                  : avgProductionHours === null
                    ? 'ยังไม่มีข้อมูล'
                    : `${avgProductionHours.toFixed(1)} ชม.`}
              </p>
              {!metricsLoading && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {avgProductionHours === null
                    ? 'ยังไม่มีเนื้อหาที่อนุมัติแล้ว'
                    : `จาก ${approvedCount.toLocaleString()} ชิ้นที่อนุมัติแล้ว`}
                </p>
              )}
            </div>

            {/* ความถี่การโพสต์ — นับ 7 วันล่าสุดเสมอ จึงเป็น snapshot */}
            <div className="rounded-lg border p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                  <span className="truncate">ความถี่การโพสต์/สัปดาห์</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{SNAPSHOT_LABEL}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums">
                {metricsLoading ? 'กำลังโหลด...' : `${postsLast7Days.toLocaleString()} โพสต์`}
              </p>
              {!metricsLoading && (
                <p className="mt-1 text-xs text-muted-foreground">{frequencyHint}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* แนวโน้ม Throughput รายเดือน */}
      <ContentThroughputChart
        data={biAnalytics?.throughput ?? []}
        isLoading={biAnalyticsLoading}
        caption={rangeCaption}
      />

      {/* Lead time + ความสมบูรณ์ SEO */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Lead time แยกตามขั้น */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Timer className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Lead time แยกตามขั้น</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {biAnalyticsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : !biAnalytics || biAnalytics.lead_time.every(s => s.sample_size === 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ที่เดินผ่านขั้นตอนครบพอจะวัดเวลาได้</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">ขั้นตอน</th>
                      <th className="pb-2 text-right font-medium">เฉลี่ย</th>
                      <th className="pb-2 text-right font-medium">p50</th>
                      <th className="pb-2 text-right font-medium">p90</th>
                      <th className="pb-2 text-right font-medium">จำนวน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biAnalytics.lead_time.map(stage => (
                      <tr key={stage.key} className="border-b last:border-0">
                        <td className="py-2 pr-2">{stage.label}</td>
                        {stage.sample_size === 0 ? (
                          <td colSpan={3} className="py-2 text-right text-xs text-muted-foreground">ยังไม่มีข้อมูล</td>
                        ) : (
                          <>
                            <td className="py-2 text-right font-medium tabular-nums">{formatHours(stage.avg_hours)}</td>
                            <td className="py-2 text-right tabular-nums text-muted-foreground">{formatHours(stage.p50_hours)}</td>
                            <td className="py-2 text-right tabular-nums text-muted-foreground">{formatHours(stage.p90_hours)}</td>
                          </>
                        )}
                        <td className="py-2 text-right tabular-nums text-muted-foreground">{stage.sample_size.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-muted-foreground">
                  p50/p90 อาจแกว่งมากเมื่อจำนวนตัวอย่างน้อย — ดูคอลัมน์ "จำนวน" ประกอบเสมอ
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ความสมบูรณ์ SEO */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <SearchCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">ความสมบูรณ์ SEO</span>
            </CardTitle>
            <span className="shrink-0 text-xs text-muted-foreground">{SNAPSHOT_LABEL}</span>
          </CardHeader>
          <CardContent>
            {biAnalyticsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : !biAnalytics || biAnalytics.seo.total_articles === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ประเภทบทความ</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  จากบทความทั้งหมด {biAnalytics.seo.total_articles.toLocaleString()} ชิ้น ·{' '}
                  {biAnalytics.seo.gate_enabled
                    ? `เกณฑ์บังคับ ≥ ${biAnalytics.seo.gate_min_score} คะแนน`
                    : 'ยังไม่เปิดเกณฑ์บังคับ'}
                </p>
                {biAnalytics.seo.fields.map(f => (
                  <div key={f.key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{f.label}</span>
                      <span className={`text-sm font-medium tabular-nums ${f.pct === 0 ? 'text-red-600' : f.pct < 50 ? 'text-amber-600' : 'text-green-600'}`}>
                        {f.filled.toLocaleString()}/{f.total.toLocaleString()} ({f.pct}%)
                      </span>
                    </div>
                    <Progress value={f.pct} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan conversion + อัตราสำเร็จการเผยแพร่ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Plan → Content conversion */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">Plan → Content conversion</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {biAnalyticsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : !biAnalytics || biAnalytics.plan_conversion.by_type.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีแผนคอนเทนต์</p>
            ) : (
              <div className="space-y-4">
                {biAnalytics.plan_conversion.by_type.map(row => (
                  <div key={row.plan_type}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{row.label}</span>
                        <Badge variant="outline" className="shrink-0 text-xs">{row.plans.toLocaleString()} แผน</Badge>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {row.converted.toLocaleString()}/{row.plan_items.toLocaleString()} ({row.convert_pct}%)
                      </span>
                    </div>
                    <Progress value={row.convert_pct} className="h-1.5" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.plan_items === 0
                        ? 'แผนนี้ยังไม่มีรายการย่อย'
                        : `แปลงเป็นคอนเทนต์แล้ว ${row.converted.toLocaleString()} ชิ้น · เผยแพร่แล้ว ${row.published.toLocaleString()} ชิ้น`}
                    </p>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm text-muted-foreground">คอนเทนต์ที่สร้างนอกแผน</span>
                  <span className="text-sm font-medium tabular-nums">{biAnalytics.plan_conversion.adhoc_items.toLocaleString()} ชิ้น</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">อัตราสำเร็จการเผยแพร่แยกแพลตฟอร์ม</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {biAnalyticsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : publishRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการเผยแพร่</p>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={publishRows} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value: number, name: string) => [`${value.toLocaleString()} รายการ`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="sent" name="ส่งแล้ว" stackId="queue" fill={SENT_COLOR} />
                    <Bar dataKey="failed" name="ล้มเหลว" stackId="queue" fill={FAILED_COLOR} />
                  </BarChart>
                </ResponsiveContainer>

                {/* รายละเอียดต่อแพลตฟอร์ม — success rate + error ที่พบบ่อย */}
                <div className="space-y-3 border-t pt-3">
                  {publishRows.map(row => (
                    <div key={row.platform}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              backgroundColor: getPlatformColors(row.platform).bg,
                              color: getPlatformColors(row.platform).text,
                            }}
                            title={row.label}
                          >
                            <PlatformIcon platform={row.platform} size={16} />
                          </span>
                          <span className="truncate text-sm">{row.label}</span>
                        </div>
                        {row.success_pct === null ? (
                          <span className="shrink-0 text-xs text-muted-foreground">ยังไม่มีรายการที่จบ</span>
                        ) : (
                          <span className={`shrink-0 text-sm font-medium tabular-nums ${row.success_pct >= 80 ? 'text-green-600' : row.success_pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                            สำเร็จ {row.success_pct}%
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span className="text-green-600">ส่งแล้ว <span className="font-medium tabular-nums">{row.sent.toLocaleString()}</span></span>
                        <span className="text-red-600">ล้มเหลว <span className="font-medium tabular-nums">{row.failed.toLocaleString()}</span></span>
                        <span>รอส่ง <span className="font-medium tabular-nums">{row.pending.toLocaleString()}</span></span>
                        {row.processing > 0 && <span>กำลังส่ง <span className="font-medium tabular-nums">{row.processing.toLocaleString()}</span></span>}
                      </div>
                      {row.top_error && (
                        <p className="mt-1 break-words text-xs text-red-700 dark:text-red-300">
                          ข้อผิดพลาดที่พบบ่อย: {row.top_error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
