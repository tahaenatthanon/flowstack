import { useState } from 'react';
import { FileText, Clock, CheckCircle2, AlertTriangle, ArrowRight, BarChart3, CalendarClock, Share2, Globe, LayoutDashboard, Hourglass, Send, RefreshCw, XCircle, Loader2 } from 'lucide-react';
import { format, startOfMonth, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useContentItems, useOverdueCount, useAllSchedules, usePostingAnalytics, useRecalculateAnalytics, useResultMetrics, useContentOverview, useContentAnalytics, useSendNow } from '@/hooks/useContent';
import PageShell from '@/components/PageShell';
import { STATUS_MAP, PLATFORM_MAP, TYPE_MAP } from '@/components/content/types';
import { PlatformBadgeList } from '@/components/content/PlatformBadgeList';
import { AnalyticsContentTab } from '@/components/content/AnalyticsContentTab';
import { AnalyticsSocialTab } from '@/components/content/AnalyticsSocialTab';
import { AnalyticsWebsiteTab } from '@/components/content/AnalyticsWebsiteTab';
import { OverviewEngagementSummary } from '@/components/content/OverviewEngagementSummary';
import { OverviewPageSummary } from '@/components/content/OverviewPageSummary';
import { OverviewEngagementTrendChart, type TrendRange } from '@/components/content/OverviewEngagementTrendChart';
import { OverviewPlatformPerformanceTable, type PlatformPeriod } from '@/components/content/OverviewPlatformPerformanceTable';
import ReportDateFilter from '@/components/reports/ReportDateFilter';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';

/** sub-tab ของแท็บวิเคราะห์ — ค่าที่ผูกกับ URL param `view` */
const ANALYTICS_VIEWS = ['social', 'website', 'content'] as const;
type AnalyticsView = typeof ANALYTICS_VIEWS[number];

const ANALYTICS_SUBTABS: Array<{ value: AnalyticsView; label: string; icon: React.ElementType }> = [
  { value: 'social',  label: 'โซเชียล', icon: Share2 },
  { value: 'website', label: 'เว็บไซต์', icon: Globe },
  { value: 'content', label: 'เนื้อหา',  icon: FileText },
];

/** ช่วงวันที่ default = 12 เดือนย้อนหลังถึงวันนี้ — ตรงกับ default ฝั่ง backend */
function defaultDateRange(): { from: string; to: string } {
  const today = new Date();
  return {
    from: format(startOfMonth(subMonths(today, 11)), 'yyyy-MM-dd'),
    to: format(today, 'yyyy-MM-dd'),
  };
}

export default function ContentDashboardPage() {
  const { data: items = [], isLoading } = useContentItems();
  const { data: overdue } = useOverdueCount();
  const { data: schedules = [] } = useAllSchedules();
  const overdueCount = overdue?.count ?? 0;
  const navigate = useNavigate();
  const { toast } = useToast();

  // Active tab driven by the `tab` URL query param (default: overview).
  // The analytics sub-tab lives in `view` so a refresh restores both levels.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'analytics' ? 'analytics' : 'overview';
  const rawView = searchParams.get('view');
  const view: AnalyticsView = ANALYTICS_VIEWS.includes(rawView as AnalyticsView)
    ? (rawView as AnalyticsView)
    : 'content';

  // Carry `view` along when entering the analytics tab so the sub-tab never
  // gets dropped, and drop both params when returning to the overview tab.
  const handleTabChange = (value: string) => {
    setSearchParams(value === 'analytics' ? { tab: 'analytics', view } : {});
  };
  const handleViewChange = (value: string) => {
    setSearchParams({ tab: 'analytics', view: value });
  };

  // Date range for the analytics tab. Kept in component state (not the URL) —
  // only `tab` and `view` are URL-bound.
  const [range, setRange] = useState(defaultDateRange);
  const { from, to } = range;

  // Analytics data (fetched only while the analytics tab is active)
  const { data: postingAnalytics, isLoading: analyticsLoading, refetch: refetchAnalytics } = usePostingAnalytics(tab === 'analytics');
  const { data: resultMetrics, isLoading: metricsLoading } = useResultMetrics(from, to, tab === 'analytics');
  const recalcAnalytics = useRecalculateAnalytics();
  const handleRecalculate = () => {
    recalcAnalytics.mutate(undefined, { onSuccess: () => { refetchAnalytics(); } });
  };

  // ตัวเลือกช่วงเวลาของ 2 widget ใหม่ในแท็บภาพรวม — เป็นคนละตัวควบคุมกัน โดยตั้งใจ
  // (ดู content-overview-social-performance spec): กราฟแนวโน้ม Engagement ใช้ trendRange,
  // ตารางประสิทธิภาพแยกแพลตฟอร์มใช้ platformPeriod — การ์ดสรุป 4 ใบเป็น all-time
  // snapshot ไม่มีตัวเลือกช่วงเวลาเลย จึงไม่ต้องมี state ของตัวเอง
  const [trendRange, setTrendRange] = useState<TrendRange>('7');
  const [platformPeriod, setPlatformPeriod] = useState<PlatformPeriod>('day');

  // BI aggregations — one request per tab, fetched lazily
  const { data: bi, isLoading: biLoading, refetch: refetchBi } = useContentOverview(tab === 'overview', trendRange, platformPeriod);
  const { data: biAnalytics, isLoading: biAnalyticsLoading } = useContentAnalytics(from, to, tab === 'analytics');

  // Retry a failed publish through the existing send_now action. The original
  // failed row stays in the queue — send_now dispatches a new attempt.
  const sendNow = useSendNow();
  const handleRetry = (contentId: string, channelId: string) => {
    sendNow.mutate(
      { content_id: contentId, channel_ids: [channelId] },
      {
        // API คืน 200 พร้อมผลรายช่องทาง — ต้องอ่าน results[] ไม่ใช่ถือว่าส่งแล้วทุกกรณี
        onSuccess: (res) => {
          const row = res?.results?.[0];
          if (row?.status === 'skipped') {
            toast({
              title: 'ข้ามการส่งซ้ำ',
              description: row.reason || 'เพิ่งส่งช่องทางนี้ไปแล้ว — ระบบข้ามเพื่อกันเผยแพร่ซ้ำ',
            });
          } else if (row?.status === 'failed') {
            toast({
              title: 'ลองส่งใหม่ไม่สำเร็จ',
              description: row.error || 'ปลายทางตอบกลับว่าล้มเหลว',
              variant: 'destructive',
            });
          } else {
            toast({ title: 'ส่งคำสั่งเผยแพร่ใหม่แล้ว', description: 'ระบบกำลังลองส่งอีกครั้ง — รายการที่ล้มเหลวเดิมยังคงอยู่ในประวัติ' });
          }
          refetchBi();
        },
        onError: (err: unknown) => {
          toast({ title: 'ลองส่งใหม่ไม่สำเร็จ', description: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด', variant: 'destructive' });
        },
      },
    );
  };

  const totalItems = items.length;
  const publishedCount = items.filter(i => i.status === 'published').length;
  const draftCount = items.filter(i => i.status === 'draft').length;
  const pendingApprovalCount = items.filter(i => i.status === 'pending_approval').length;

  // Status distribution for Work Progress — single source of truth for
  // per-status counts and the overview total (replaces the old top-of-page
  // stat cards). Includes `rejected` so no reachable status is invisible here.
  const statusCounts = {
    published: publishedCount,
    pending_approval: pendingApprovalCount,
    approved: items.filter(i => i.status === 'approved').length,
    revision: items.filter(i => i.status === 'revision').length,
    draft: draftCount,
    rejected: items.filter(i => i.status === 'rejected').length,
  };
  const workProgressStatuses = ['published', 'approved', 'pending_approval', 'revision', 'draft', 'rejected'] as const;

  // Recent items (last 5)
  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Upcoming schedules (future only, soonest first)
  const now = Date.now();
  const upcomingSchedules = schedules
    .filter(s => s.scheduled_at && new Date(s.scheduled_at).getTime() > now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5);

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // ── BI derived values ────────────────────────────────────────────
  const queue = bi?.queue;
  const aging = bi?.aging;

  // "ต้องดำเนินการ" column collapses to one combined empty message only when
  // BOTH cards would otherwise be empty — a single empty card still renders
  // its own empty state normally.
  const hasFailures = (queue?.failures.length ?? 0) > 0;
  const hasAgingItems = (aging?.total ?? 0) > 0;
  const actionColumnEmpty = !biLoading && !hasFailures && !hasAgingItems;

  const queueStatuses = [
    { key: 'pending' as const,    label: 'รอส่ง',     icon: Clock,        color: 'text-amber-600' },
    { key: 'processing' as const, label: 'กำลังส่ง',  icon: Loader2,      color: 'text-blue-600' },
    { key: 'sent' as const,       label: 'ส่งแล้ว',   icon: CheckCircle2, color: 'text-green-600' },
    { key: 'failed' as const,     label: 'ล้มเหลว',   icon: XCircle,      color: 'text-red-600' },
  ];

  const agingBuckets = aging ? [
    { key: 'd0_7',     label: '0-7 วัน',    count: aging.d0_7,     color: 'text-green-600',  bg: 'bg-green-500' },
    { key: 'd8_30',    label: '8-30 วัน',   count: aging.d8_30,    color: 'text-amber-600',  bg: 'bg-amber-500' },
    { key: 'd31_90',   label: '31-90 วัน',  count: aging.d31_90,   color: 'text-orange-600', bg: 'bg-orange-500' },
    { key: 'd90_plus', label: 'เกิน 90 วัน', count: aging.d90_plus, color: 'text-red-600',    bg: 'bg-red-500' },
  ] : [];

  return (
    <PageShell
      breadcrumbs={[
        { label: 'การตลาด', href: '/campaigns' },
        { label: 'คอนเทนต์โซเชียล' },
        { label: 'แดชบอร์ด', isCurrent: true },
      ]}
      title="แดชบอร์ดคอนเทนต์"
      description="ภาพรวมเนื้อหาและสถานะการผลิต"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex overflow-x-auto w-full text-xs sm:text-sm sm:grid sm:grid-cols-2">
            <TabsTrigger value="overview" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">ภาพรวม</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1 sm:gap-2 px-2 sm:px-3 shrink-0">
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">วิเคราะห์</span>
            </TabsTrigger>
          </TabsList>

          {/* ── ภาพรวม ─────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6">
            {/* การ์ดสรุป Engagement — all-time snapshot, สิ่งแรกที่เห็นในแท็บนี้โดยตั้งใจ */}
            <OverviewEngagementSummary snapshot={bi?.social_snapshot} isLoading={biLoading} />

            {/* การ์ดเพจ Facebook — 28 วันล่าสุดคงที่ ไม่ผูกตัวเลือกช่วงเวลาของ widget อื่น */}
            <OverviewPageSummary summary={bi?.page_summary} isLoading={biLoading} />

            {/* กราฟแนวโน้ม Engagement — ควบคุมด้วย trendRange (7/30/90 วัน) แยกจาก platformPeriod ของตารางท้ายหน้า */}
            <OverviewEngagementTrendChart
              data={bi?.engagement_trend ?? []}
              isLoading={biLoading}
              range={trendRange}
              onRangeChange={setTrendRange}
            />

            {/* คิวเผยแพร่ + กำหนดการโพสต์ถัดไป (1:1) — ย้ายมาอยู่ใต้กราฟแนวโน้ม Engagement ตามคำขอ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* คิวเผยแพร่ */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">คิวเผยแพร่</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {biLoading ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                  ) : !queue || queue.total === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการในคิวเผยแพร่</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {queueStatuses.filter(s => s.key !== 'failed' && s.key !== 'processing').map(s => {
                        const StatusIcon = s.icon;
                        return (
                          <div key={s.key} className="flex items-center gap-2 rounded-lg border p-2">
                            <StatusIcon className={`h-4 w-4 shrink-0 ${s.color}`} />
                            <div className="min-w-0">
                              <p className="truncate text-xs text-muted-foreground">{s.label}</p>
                              <p className={`text-base font-bold tabular-nums ${s.color}`}>{queue[s.key].toLocaleString()}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Schedule */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">กำหนดการโพสต์ถัดไป</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingSchedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">ไม่มีโพสต์ที่กำลังจะถึง</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingSchedules.map(s => {
                        const platform = s.platform ? PLATFORM_MAP[s.platform] : null;
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{s.topic || s.plan_title || 'ไม่มีชื่อ'}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(s.scheduled_at)}</p>
                            </div>
                            {platform ? (
                              <Badge variant="outline" className={platform.color}>{platform.label}</Badge>
                            ) : s.channel_name ? (
                              <span className="text-xs text-muted-foreground shrink-0">{s.channel_name}</span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Overdue Alert */}
            {overdueCount > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <span>มีโพสต์ที่เลยกำหนดส่ง <strong>{overdueCount}</strong> รายการ — กรุณาตรวจสอบในปฏิทินคอนเทนต์</span>
                <Button variant="outline" size="sm" className="ml-auto" onClick={() => navigate('/content-planner')}>
                  ดูปฏิทิน
                </Button>
              </div>
            )}

            {/* 2 แถวอิสระ อัตราส่วนต่อแถว (mirror HomePage.tsx) — แต่ละแถวไม่ผูกความสูงกับแถวอื่น (แถว "คิวเผยแพร่ + กำหนดการโพสต์ถัดไป" ย้ายไปอยู่ใต้กราฟแนวโน้ม Engagement ด้านบนแล้ว) */}
            <div className="space-y-6">
              {/* แถว 1: เผยแพร่ล้มเหลว + คอนเทนต์รอดำเนินการ (1:1) */}
              {actionColumnEmpty ? (
                <Card>
                  <CardContent>
                    <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีงานที่ต้องดำเนินการตอนนี้</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* เผยแพร่ล้มเหลว */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">เผยแพร่ล้มเหลว</span>
                        {hasFailures && (
                          <Badge variant="destructive" className="shrink-0">{queue!.failures.length}</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {biLoading ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                      ) : !hasFailures ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีรายการเผยแพร่ล้มเหลว</p>
                      ) : (
                        <div className="space-y-3">
                          {queue!.failures.map(f => (
                            <div key={f.id} className="space-y-1.5 rounded-lg border border-red-200 bg-red-50/50 p-2 dark:border-red-900 dark:bg-red-950/20">
                              <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 flex-1 truncate text-sm font-medium">{f.title}</p>
                                <Badge variant="outline" className="shrink-0 text-xs">
                                  {f.retry_count > 0 ? `ลอง ${f.retry_count.toLocaleString()} ครั้ง` : 'ยังไม่ลองส่งใหม่'}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {f.platform && PLATFORM_MAP[f.platform] ? (
                                  <Badge variant="outline" className={PLATFORM_MAP[f.platform].color}>{PLATFORM_MAP[f.platform].label}</Badge>
                                ) : null}
                                {/* ไม่แสดงชื่อ channel ซ้ำเมื่อตรงกับชื่อแพลตฟอร์มที่ badge ข้างบนแสดงไปแล้ว (เช่น channel ชื่อ "Facebook" ของแพลตฟอร์ม facebook) */}
                                {f.channel_name && f.channel_name !== PLATFORM_MAP[f.platform ?? '']?.label && (
                                  <span className="truncate">{f.channel_name}</span>
                                )}
                                <span>{formatDateTime(f.scheduled_at)}</span>
                              </div>
                              {f.error_msg && (
                                <p className="break-words text-xs text-red-700 dark:text-red-300">{f.error_msg}</p>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-full gap-1.5 text-xs"
                                disabled={sendNow.isPending}
                                onClick={() => handleRetry(f.content_id, f.channel_id)}
                              >
                                <RefreshCw className="h-3 w-3" />
                                ลองส่งใหม่
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* คอนเทนต์รอดำเนินการ */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <Hourglass className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">คอนเทนต์รอดำเนินการ</span>
                        {hasAgingItems && (
                          <Badge variant="outline" className="shrink-0">{aging!.total}</Badge>
                        )}
                      </CardTitle>
                      {aging && aging.oldest_days !== null && (
                        <span className="shrink-0 text-xs text-muted-foreground">เก่าสุด {aging.oldest_days.toLocaleString()} วัน</span>
                      )}
                    </CardHeader>
                    <CardContent>
                      {biLoading ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                      ) : !hasAgingItems ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีคอนเทนต์รอดำเนินการ — เผยแพร่ครบทุกชิ้น</p>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {agingBuckets.map(b => (
                              <div key={b.key} className="rounded-lg border p-3">
                                <p className="text-xs text-muted-foreground">{b.label}</p>
                                <p className={`text-xl font-bold font-heading tabular-nums ${b.color}`}>{b.count.toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                          <div className="flex h-2 overflow-hidden rounded bg-muted">
                            {agingBuckets.map(b => (
                              b.count > 0 ? (
                                <div
                                  key={b.key}
                                  className={b.bg}
                                  style={{ width: `${(b.count / aging!.total) * 100}%` }}
                                  title={`${b.label}: ${b.count} ชิ้น`}
                                />
                              ) : null
                            ))}
                          </div>
                          <div className="space-y-2 border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground">ค้างนานที่สุด</p>
                            {aging!.items.map(item => {
                              const status = STATUS_MAP[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                              return (
                                <div key={item.id} className="flex items-center justify-between gap-3">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <p className="truncate text-sm">{item.title}</p>
                                    <Badge variant="outline" className={`shrink-0 ${status.color}`}>{status.label}</Badge>
                                    <PlatformBadgeList platforms={item.platform} variant="pill" />
                                  </div>
                                  <span className={`shrink-0 text-xs font-medium tabular-nums ${item.age_days > 90 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                    {item.age_days.toLocaleString()} วัน
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* แถว 2: เนื้อหาล่าสุด (กว้าง) + ภาพรวมสถานะคอนเทนต์ (แคบ) (2:1) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* เนื้อหาล่าสุด */}
                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">เนื้อหาล่าสุด</span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate('/content')}>
                      ดูทั้งหมด
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {recentItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">ไม่มีเนื้อหา</p>
                    ) : (
                      <div className="space-y-3">
                        {recentItems.map(item => {
                          const type = TYPE_MAP[item.type] ?? TYPE_MAP.article;
                          const status = STATUS_MAP[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                          const TypeIcon = type.icon;
                          return (
                            <div key={item.id} className="flex gap-3">
                              {/* Thumbnail (left, stretched to data height) */}
                              {item.generated_image_url ? (
                                <img
                                  src={item.generated_image_url}
                                  alt={item.title}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-14 self-stretch min-h-[56px] rounded border bg-muted object-cover shrink-0"
                                />
                              ) : (
                                <span className={`flex items-center justify-center w-14 self-stretch min-h-[56px] rounded border bg-muted shrink-0 ${type.color}`}>
                                  <TypeIcon className="h-5 w-5" />
                                </span>
                              )}
                              {/* Data (right) */}
                              <div className="flex-1 min-w-0 space-y-1">
                                {/* Line 1: title */}
                                <p className="text-sm font-medium truncate">{item.title}</p>
                                {/* Line 2: type | platform */}
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={type.color}>{type.label}</Badge>
                                  {item.platform ? (
                                    <PlatformBadgeList platforms={item.platform} variant="pill" />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </div>
                                {/* Line 3: status | created date */}
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={status.color}>{status.label}</Badge>
                                  <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Work Progress */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <BarChart3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">ภาพรวมสถานะคอนเทนต์</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {workProgressStatuses.map(statusKey => {
                      const count = statusCounts[statusKey];
                      const percent = totalItems > 0 ? Math.round((count / totalItems) * 100) : 0;
                      const info = STATUS_MAP[statusKey];
                      return (
                        <div key={statusKey}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              {(() => { const StatusIcon = info.icon; return <StatusIcon className={`h-3.5 w-3.5 ${info.iconColor}`} />; })()}
                              {info.label}
                            </span>
                            <span className={`text-sm font-medium ${info.iconColor}`}>{count} ชิ้น ({percent}%)</span>
                          </div>
                          <Progress value={percent} className={`h-1.5 ${info.progressColor}`} />
                        </div>
                      );
                    })}
                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">เนื้อหาทั้งหมด</span>
                      <span className="text-lg font-bold">{totalItems.toLocaleString()} ชิ้น</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ประสิทธิภาพแต่ละแพลตฟอร์ม — widget สุดท้ายของแท็บภาพรวม ควบคุมด้วย platformPeriod (วัน/สัปดาห์/เดือน) แยกจากกราฟแนวโน้มด้านบน */}
            <OverviewPlatformPerformanceTable
              rows={bi?.platform_performance ?? []}
              isLoading={biLoading}
              period={platformPeriod}
              onPeriodChange={setPlatformPeriod}
            />
          </TabsContent>

          {/* ── วิเคราะห์ ───────────────────────────────────────── */}
          <TabsContent value="analytics" className="space-y-6">
            {/* ตัวกรองช่วงวันที่ — ใช้ร่วมกับทุก sub-tab ที่มีเมตริกผูกช่วงเวลา */}
            <ReportDateFilter
              startDate={from}
              endDate={to}
              onDateRangeChange={(start, end) => setRange({ from: start, to: end })}
              onReset={() => setRange(defaultDateRange())}
              summary={'ช่วงวันที่นี้ใช้กับ widget ที่ผูกช่วงเวลา — widget ที่เป็น snapshot จะกำกับไว้ว่า "ไม่ผูกช่วงวันที่ที่เลือก"'}
            />

            {/* ── sub-tab ระดับที่ 2 ────────────────────────────── */}
            <Tabs value={view} onValueChange={handleViewChange} className="space-y-6">
              <TabsList className="flex overflow-x-auto sm:grid sm:grid-cols-3 border-b rounded-none bg-transparent h-auto p-0 gap-0 w-full justify-start">
                {ANALYTICS_SUBTABS.map(subtab => {
                  const Icon = subtab.icon;
                  return (
                    <TabsTrigger
                      key={subtab.value}
                      value={subtab.value}
                      className="shrink-0 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm font-medium"
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {subtab.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="social" className="mt-0">
                <AnalyticsSocialTab
                  social={biAnalytics?.social}
                  socialLoading={biAnalyticsLoading}
                  from={from}
                  to={to}
                />
              </TabsContent>

              <TabsContent value="website" className="mt-0">
                <AnalyticsWebsiteTab />
              </TabsContent>

              <TabsContent value="content" className="mt-0">
                <AnalyticsContentTab
                  items={items}
                  biAnalytics={biAnalytics}
                  biAnalyticsLoading={biAnalyticsLoading}
                  resultMetrics={resultMetrics}
                  metricsLoading={metricsLoading}
                  postingAnalytics={postingAnalytics}
                  analyticsLoading={analyticsLoading}
                  onRecalculate={handleRecalculate}
                  isRecalculating={recalcAnalytics.isPending}
                  from={from}
                  to={to}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      )}
    </PageShell>
  );
}
