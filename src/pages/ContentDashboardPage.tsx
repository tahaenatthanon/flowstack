import { LayoutDashboard, FileText, Clock, CheckCircle2, AlertTriangle, TrendingUp, Plus, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useContentItems, useOverdueCount } from '@/hooks/useContent';
import PageShell from '@/components/PageShell';
import { STATUS_MAP, PLATFORM_MAP, TYPE_MAP } from '@/components/content/types';
import { useNavigate } from 'react-router-dom';

export default function ContentDashboardPage() {
  const { data: items = [], isLoading } = useContentItems();
  const { data: overdue } = useOverdueCount();
  const overdueCount = overdue?.count ?? 0;
  const navigate = useNavigate();

  const totalItems = items.length;
  const publishedCount = items.filter(i => i.status === 'published').length;
  const draftCount = items.filter(i => i.status === 'draft').length;
  const pendingApprovalCount = items.filter(i => i.status === 'pending_approval').length;

  // Platform distribution
  const platformCounts = items.reduce<Record<string, number>>((acc, item) => {
    const p = item.platform ?? 'unknown';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  // Recent items (last 5)
  const recentItems = [...items]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const formatDate = (d?: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const statCards = [
    { label: 'เนื้อหาทั้งหมด', value: totalItems, icon: FileText, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950', border: 'border-blue-200 dark:border-blue-800' },
    { label: 'เผยแพร่แล้ว', value: publishedCount, icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-950', border: 'border-green-200 dark:border-green-800' },
    { label: 'รออนุมัติ', value: pendingApprovalCount, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950', border: 'border-amber-200 dark:border-amber-800' },
    { label: 'ฉบับร่าง', value: draftCount, icon: AlertTriangle, color: 'text-gray-600 bg-gray-50 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700' },
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
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/content')}>
            <Eye className="h-3.5 w-3.5" />ดูเนื้อหาทั้งหมด
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate('/content?create=1')}>
            <Plus className="h-3.5 w-3.5" />สร้างคอนเทนต์
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">กำลังโหลด...</div>
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className={`border ${card.border} shadow-sm`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${card.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  </CardContent>
                </Card>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Platform Distribution */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">แพลตฟอร์ม</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(platformCounts).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">ไม่มีข้อมูล</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(platformCounts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([platform, count]) => {
                        const info = PLATFORM_MAP[platform];
                        return (
                          <div key={platform} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {info ? (
                                <Badge variant="outline" className={info.color}>{info.label}</Badge>
                              ) : (
                                <span className="text-sm">{platform}</span>
                              )}
                            </div>
                            <span className="text-sm font-medium">{count}</span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Content */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">เนื้อหาล่าสุด</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {recentItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">ไม่มีเนื้อหา</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">ชื่อ</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">ประเภท</TableHead>
                        <TableHead className="text-xs hidden md:table-cell">แพลตฟอร์ม</TableHead>
                        <TableHead className="text-xs">สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentItems.map(item => {
                        const type = TYPE_MAP[item.type] ?? TYPE_MAP.article;
                        const status = STATUS_MAP[item.status] ?? { label: item.status, color: 'bg-gray-100 text-gray-600' };
                        const platform = item.platform ? PLATFORM_MAP[item.platform] : null;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm max-w-[150px] truncate">{item.title}</TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="outline" className={type.color}>{type.label}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {platform ? (
                                <Badge variant="outline" className={platform.color}>{platform.label}</Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={status.color}>{status.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
