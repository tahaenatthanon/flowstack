import { FileText, Clock, CheckCircle2, Edit3, AlertTriangle, Eye, ThumbsUp, ArrowRight, BarChart3, CalendarClock, Share2, Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useContentItems, useOverdueCount, useAllSchedules, usePublishChannels, useChannelConnectionStatus } from '@/hooks/useContent';
import PageShell from '@/components/PageShell';
import { STATUS_MAP, PLATFORM_MAP, TYPE_MAP } from '@/components/content/types';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { getPlatformColors } from '@/lib/platformConfig';
import { useNavigate } from 'react-router-dom';

export default function ContentDashboardPage() {
  const { data: items = [], isLoading } = useContentItems();
  const { data: overdue } = useOverdueCount();
  const { data: schedules = [] } = useAllSchedules();
  const { data: channels = [] } = usePublishChannels();
  const { data: channelStatus = [] } = useChannelConnectionStatus();
  const overdueCount = overdue?.count ?? 0;
  const navigate = useNavigate();

  const totalItems = items.length;
  const publishedCount = items.filter(i => i.status === 'published').length;
  const draftCount = items.filter(i => i.status === 'draft').length;
  const pendingApprovalCount = items.filter(i => i.status === 'pending_approval').length;

  // Totals for engagement
  const totalViews = items.reduce((s, i) => s + (Number(i.views) || 0), 0);
  const totalLikes = items.reduce((s, i) => s + (Number(i.likes) || 0), 0);

  // Status distribution for Work Progress
  const statusCounts = {
    published: publishedCount,
    pending_approval: pendingApprovalCount,
    approved: items.filter(i => i.status === 'approved').length,
    revision: items.filter(i => i.status === 'revision').length,
    draft: draftCount,
  };
  const workProgressStatuses = ['published', 'approved', 'pending_approval', 'revision', 'draft'] as const;

  // Platform distribution
  const platformCounts = items.reduce<Record<string, number>>((acc, item) => {
    const p = (item.platform ?? 'unknown').trim().toLowerCase();
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

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

  const statCards = [
    { label: 'เนื้อหาทั้งหมด', value: totalItems, icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-500/10', border: 'border-blue-600', countColor: 'text-blue-700' },
    { label: 'เผยแพร่แล้ว', value: publishedCount, icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-500/10', border: 'border-green-600', countColor: 'text-green-700' },
    { label: 'รออนุมัติ', value: pendingApprovalCount, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-500/10', border: 'border-amber-600', countColor: 'text-amber-700' },
    { label: 'ฉบับร่าง', value: draftCount, icon: Edit3, color: 'text-gray-600', bgColor: 'bg-gray-500/10', border: 'border-gray-600', countColor: 'text-gray-700' },
    { label: 'ยอดวิวรวม', value: totalViews, icon: Eye, color: 'text-cyan-600', bgColor: 'bg-cyan-500/10', border: 'border-cyan-600', countColor: 'text-cyan-700' },
    { label: 'ยอดไลก์รวม', value: totalLikes, icon: ThumbsUp, color: 'text-pink-600', bgColor: 'bg-pink-500/10', border: 'border-pink-600', countColor: 'text-pink-700' },
  ];

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
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            {statCards.map((card) => {
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
            {/* LEFT: วิเคราะห์ + ตาราง */}
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

              {/* Platform Distribution */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
                    <Share2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">แพลตฟอร์ม</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(platformCounts).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(platformCounts)
                        .sort(([pa, a], [pb, b]) => {
                          const diff = b - a;
                          if (diff !== 0) return diff;
                          const nameA = PLATFORM_MAP[pa]?.label ?? pa;
                          const nameB = PLATFORM_MAP[pb]?.label ?? pb;
                          return nameA.localeCompare(nameB);
                        })
                        .map(([platform, count]) => {
                          const info = PLATFORM_MAP[platform];
                          const name = info?.label ?? platform;
                          const pc = getPlatformColors(platform);
                          return (
                            <div key={platform} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                                  style={{ backgroundColor: pc.bg, color: pc.text }}
                                  title={name}
                                >
                                  <PlatformIcon platform={platform} size={18} />
                                </span>
                                <span className="text-sm truncate">{name}</span>
                              </div>
                              <span className="text-sm font-medium">{count}</span>
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
                    <span className="truncate">สถานะช่องทาง</span>
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
        </div>
      )}
    </PageShell>
  );
}
