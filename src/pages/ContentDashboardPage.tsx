import { useState } from 'react';
import { FileText, Clock, CheckCircle2, Edit3, AlertTriangle, ArrowRight, BarChart3, CalendarClock, Share2, Globe, Radio, LayoutDashboard, Filter, Hourglass, Sparkles, Send, RefreshCw, XCircle, Loader2 } from 'lucide-react';
import { format, startOfMonth, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useContentItems, useOverdueCount, useAllSchedules, usePublishChannels, useChannelConnectionStatus, usePostingAnalytics, useRecalculateAnalytics, useResultMetrics, useContentOverview, useContentAnalytics, useSendNow } from '@/hooks/useContent';
import PageShell from '@/components/PageShell';
import { STATUS_MAP, PLATFORM_MAP, TYPE_MAP } from '@/components/content/types';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { AnalyticsContentTab } from '@/components/content/AnalyticsContentTab';
import { AnalyticsSocialTab } from '@/components/content/AnalyticsSocialTab';
import { AnalyticsWebsiteTab } from '@/components/content/AnalyticsWebsiteTab';
import ReportDateFilter from '@/components/reports/ReportDateFilter';
import { getPlatformColors } from '@/lib/platformConfig';
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
  const { data: channels = [] } = usePublishChannels();
  const { data: channelStatus = [] } = useChannelConnectionStatus();
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

  // BI aggregations — one request per tab, fetched lazily
  const { data: bi, isLoading: biLoading, refetch: refetchBi } = useContentOverview(tab === 'overview');
  const { data: biAnalytics, isLoading: biAnalyticsLoading } = useContentAnalytics(from, to, tab === 'analytics');

  // Retry a failed publish through the existing send_now action. The original
  // failed row stays in the queue — send_now dispatches a new attempt.
  const sendNow = useSendNow();
  const handleRetry = (contentId: string, channelId: string) => {
    sendNow.mutate(
      { content_id: contentId, channel_ids: [channelId] },
      {
        onSuccess: () => {
          toast({ title: 'ส่งคำสั่งเผยแพร่ใหม่แล้ว', description: 'ระบบกำลังลองส่งอีกครั้ง — รายการที่ล้มเหลวเดิมยังคงอยู่ในประวัติ' });
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

  // Status distribution for Work Progress
  const statusCounts = {
    published: publishedCount,
    pending_approval: pendingApprovalCount,
    approved: items.filter(i => i.status === 'approved').length,
    revision: items.filter(i => i.status === 'revision').length,
    draft: draftCount,
  };
  const workProgressStatuses = ['published', 'approved', 'pending_approval', 'revision', 'draft'] as const;

  // Recent items (last 5)
  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Pending approval queue (oldest request first, null last)
  const pendingItems = items
    .filter(i => i.status === 'pending_approval')
    .sort((a, b) => {
      const ta = a.requested_at ? new Date(a.requested_at).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.requested_at ? new Date(b.requested_at).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });

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

  // Production stat cards (overview tab)
  const productionStatCards = [
    { label: 'เนื้อหาทั้งหมด', value: totalItems, icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-500/10', border: 'border-blue-600', countColor: 'text-blue-700' },
    { label: 'เผยแพร่แล้ว', value: publishedCount, icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-500/10', border: 'border-green-600', countColor: 'text-green-700' },
    { label: 'รออนุมัติ', value: pendingApprovalCount, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-500/10', border: 'border-amber-600', countColor: 'text-amber-700' },
    { label: 'ฉบับร่าง', value: draftCount, icon: Edit3, color: 'text-gray-600', bgColor: 'bg-gray-500/10', border: 'border-gray-600', countColor: 'text-gray-700' },
  ];

  // ── BI derived values ────────────────────────────────────────────
  const queue = bi?.queue;
  const funnel = bi?.funnel;
  const aging = bi?.aging;
  const assets = bi?.assets;

  const queueStatuses = [
    { key: 'pending' as const,    label: 'รอส่ง',     icon: Clock,        color: 'text-amber-600' },
    { key: 'processing' as const, label: 'กำลังส่ง',  icon: Loader2,      color: 'text-blue-600' },
    { key: 'sent' as const,       label: 'ส่งแล้ว',   icon: CheckCircle2, color: 'text-green-600' },
    { key: 'failed' as const,     label: 'ล้มเหลว',   icon: XCircle,      color: 'text-red-600' },
  ];

  // Funnel stages, widest first. Drop-off is measured against the previous stage.
  const funnelStages = funnel ? [
    { key: 'created',   label: 'สร้าง',     count: funnel.created,   color: 'bg-blue-500' },
    { key: 'requested', label: 'ขออนุมัติ', count: funnel.requested, color: 'bg-amber-500' },
    { key: 'approved',  label: 'อนุมัติ',   count: funnel.approved,  color: 'bg-violet-500' },
    { key: 'published', label: 'เผยแพร่',   count: funnel.published, color: 'bg-green-500' },
  ] : [];

  const agingBuckets = aging ? [
    { key: 'd0_7',     label: '0-7 วัน',    count: aging.d0_7,     color: 'text-green-600',  bg: 'bg-green-500' },
    { key: 'd8_30',    label: '8-30 วัน',   count: aging.d8_30,    color: 'text-amber-600',  bg: 'bg-amber-500' },
    { key: 'd31_90',   label: '31-90 วัน',  count: aging.d31_90,   color: 'text-orange-600', bg: 'bg-orange-500' },
    { key: 'd90_plus', label: 'เกิน 90 วัน', count: aging.d90_plus, color: 'text-red-600',    bg: 'bg-red-500' },
  ] : [];

  const assetKinds = assets ? [
    { key: 'image', label: 'รูปภาพ', data: assets.image },
    { key: 'video', label: 'วิดีโอ', data: assets.video },
  ] : [];
  const assetStatuses = [
    { key: 'done' as const,       label: 'สำเร็จ',      color: 'text-green-600' },
    { key: 'generating' as const, label: 'กำลังสร้าง',  color: 'text-blue-600' },
    { key: 'failed' as const,     label: 'ล้มเหลว',     color: 'text-red-600' },
    { key: 'none' as const,       label: 'ยังไม่สร้าง', color: 'text-muted-foreground' },
  ];
  const hasAssetActivity = assetKinds.some(k => k.data.done + k.data.generating + k.data.failed > 0);

  return (
    <PageShell
      breadcrumbs={[
        { label: 'การตลาด', href: '/marketing' },
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
            {/* Production Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {productionStatCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className={`stat-card p-3 sm:p-5 ${card.border} ${card.bgColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{card.label}</span>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <p className={`text-xl sm:text-2xl font-bold font-heading tabular-nums ${card.countColor}`}>{card.value.toLocaleString()}</p>
                  </div>
                );
              })}
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

            {/* Master 2-column */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* LEFT: สถานะการผลิต + ตาราง */}
              <div className="flex flex-col space-y-6 xl:col-span-2">
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

                {/* Funnel การผลิต */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">Funnel การผลิต</span>
                    </CardTitle>
                    <span className="shrink-0 text-xs text-muted-foreground">นับจากที่เคยผ่านแต่ละขั้น</span>
                  </CardHeader>
                  <CardContent>
                    {biLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                    ) : !funnel || funnel.created === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีคอนเทนต์ในระบบ</p>
                    ) : (
                      <div className="space-y-1">
                        {funnelStages.map((stage, idx) => {
                          const prev = idx > 0 ? funnelStages[idx - 1] : null;
                          const widthPct = funnel.created > 0 ? (stage.count / funnel.created) * 100 : 0;
                          const dropPct = prev && prev.count > 0
                            ? Math.round((1 - stage.count / prev.count) * 100)
                            : null;
                          return (
                            <div key={stage.key}>
                              {dropPct !== null && (
                                <p className="py-1 pl-1 text-xs text-muted-foreground">
                                  ↓ ตกหล่น <span className={dropPct >= 50 ? 'font-medium text-red-600' : 'font-medium text-amber-600'}>{dropPct}%</span>
                                  {' '}({(prev!.count - stage.count).toLocaleString()} ชิ้น)
                                </p>
                              )}
                              <div className="flex items-center gap-3">
                                <span className="w-20 shrink-0 text-sm text-muted-foreground">{stage.label}</span>
                                <div className="h-6 flex-1 rounded bg-muted">
                                  <div
                                    className={`flex h-6 items-center justify-end rounded px-2 ${stage.color}`}
                                    style={{ width: `${Math.max(widthPct, stage.count > 0 ? 8 : 0)}%` }}
                                  >
                                    {stage.count > 0 && (
                                      <span className="text-xs font-medium tabular-nums text-white">{stage.count.toLocaleString()}</span>
                                    )}
                                  </div>
                                </div>
                                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                  {Math.round(widthPct)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* คอนเทนต์ค้างท่อ */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Hourglass className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">คอนเทนต์ค้างท่อ</span>
                    </CardTitle>
                    {aging && aging.oldest_days !== null && (
                      <span className="shrink-0 text-xs text-muted-foreground">เก่าสุด {aging.oldest_days.toLocaleString()} วัน</span>
                    )}
                  </CardHeader>
                  <CardContent>
                    {biLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                    ) : !aging || aging.total === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีคอนเทนต์ค้างท่อ — เผยแพร่ครบทุกชิ้น</p>
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
                                style={{ width: `${(b.count / aging.total) * 100}%` }}
                                title={`${b.label}: ${b.count} ชิ้น`}
                              />
                            ) : null
                          ))}
                        </div>
                        <div className="space-y-2 border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground">ค้างนานที่สุด</p>
                          {aging.items.map(item => {
                            const status = STATUS_MAP[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                            const platform = item.platform ? PLATFORM_MAP[item.platform] : null;
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-2">
                                  <p className="truncate text-sm">{item.title}</p>
                                  <Badge variant="outline" className={`shrink-0 ${status.color}`}>{status.label}</Badge>
                                  {platform && <Badge variant="outline" className={`shrink-0 ${platform.color}`}>{platform.label}</Badge>}
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

                {/* สถานะสร้างสื่อ AI */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">สถานะสร้างสื่อ AI</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {biLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                    ) : !assets || !hasAssetActivity ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีการสร้างสื่อด้วย AI</p>
                    ) : (
                      <div className="space-y-4">
                        {assetKinds.map(kind => {
                          const total = kind.data.none + kind.data.generating + kind.data.done + kind.data.failed;
                          const donePct = total > 0 ? Math.round((kind.data.done / total) * 100) : 0;
                          return (
                            <div key={kind.key}>
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">{kind.label}</span>
                                <span className="text-sm font-medium">สำเร็จ {donePct}% ({kind.data.done.toLocaleString()}/{total.toLocaleString()})</span>
                              </div>
                              <Progress value={donePct} className="h-1.5" />
                              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                                {assetStatuses.map(s => (
                                  <span key={s.key} className={`text-xs ${s.color}`}>
                                    {s.label} <span className="font-medium tabular-nums">{kind.data[s.key].toLocaleString()}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* เนื้อหาล่าสุด */}
                <Card className="flex flex-1 flex-col">
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
                          const platform = item.platform ? PLATFORM_MAP[item.platform] : null;
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
                                  {platform ? (
                                    <Badge variant="outline" className={platform.color}>{platform.label}</Badge>
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
              </div>

              {/* RIGHT: สถานะ + งานที่ต้องทำ */}
              <div className="flex flex-col space-y-6">
                {/* สุขภาพคิวเผยแพร่ */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">สุขภาพคิวเผยแพร่</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {biLoading ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
                    ) : !queue || queue.total === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการในคิวเผยแพร่</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                          {queueStatuses.map(s => {
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

                        {queue.overdue_pending > 0 && (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span>มี <strong>{queue.overdue_pending.toLocaleString()}</strong> รายการรอส่งที่เลยเวลาที่ตั้งไว้แล้ว</span>
                          </div>
                        )}

                        {queue.failures.length > 0 && (
                          <div className="space-y-3 border-t pt-3">
                            <p className="text-xs font-medium text-muted-foreground">รายการที่ล้มเหลว</p>
                            {queue.failures.map(f => (
                              <div key={f.id} className="space-y-1.5 rounded-lg border border-red-200 bg-red-50/50 p-2 dark:border-red-900 dark:bg-red-950/20">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{f.title}</p>
                                  <Badge variant="outline" className="shrink-0 text-xs">ลอง {f.retry_count.toLocaleString()} ครั้ง</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  {f.platform && PLATFORM_MAP[f.platform] ? (
                                    <Badge variant="outline" className={PLATFORM_MAP[f.platform].color}>{PLATFORM_MAP[f.platform].label}</Badge>
                                  ) : null}
                                  {f.channel_name && <span className="truncate">{f.channel_name}</span>}
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
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Pending Queue */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">รออนุมัติ</span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate('/content?tab=approval')}>
                      ดูทั้งหมด
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {pendingItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">ไม่มีรายการรออนุมัติ</p>
                    ) : (
                      <div className="space-y-3">
                        {pendingItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium truncate min-w-0">{item.title}</p>
                            <span className="text-xs text-muted-foreground shrink-0">{formatDate(item.created_at)}</span>
                          </div>
                        ))}
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

                {/* Channels */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <Radio className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">สถานะแพลตฟอร์ม</span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate('/content?tab=settings')}>
                      จัดการ
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {channels.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">ไม่มีช่องทางที่เชื่อมต่อ</p>
                    ) : (
                      <div className="space-y-2">
                        {channels.map(ch => {
                          const status = channelStatus.find(s => s.id === ch.id);
                          const connected = status?.ok === true;
                          const pc = getPlatformColors(ch.platform);
                          return (
                            <div key={ch.id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                                  style={{ backgroundColor: pc.bg, color: pc.text }}
                                  title={PLATFORM_MAP[ch.platform]?.label ?? ch.platform}
                                >
                                  <PlatformIcon platform={ch.platform} size={18} />
                                </span>
                                <span className="text-sm truncate">{ch.name}</span>
                              </div>
                              <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium ${connected ? 'text-green-600' : 'text-red-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                                {connected ? 'เชื่อมต่อแล้ว' : 'ไม่เชื่อมต่อ'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
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
                <AnalyticsSocialTab />
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
