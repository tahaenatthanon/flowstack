import { useAdminOverview } from '@/hooks/useProjectData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, CheckCircle2, TrendingUp, DollarSign, FileText, Clock, AlertTriangle, FolderKanban, Building2 } from 'lucide-react';
import { getProjectStatusColor, getStatusLabel, getPriorityLabel } from '@/lib/projectUtils';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';

function formatCurrency(value: number) {
  return value >= 1_000_000
    ? (value / 1_000_000).toFixed(1) + 'M'
    : value.toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  try { return format(parseISO(dateStr), 'd MMM yy', { locale: th }); } catch { return dateStr; }
}

export function AdminOverviewTab({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data: overviewData, isLoading: isLoadingOverview } = useAdminOverview({
    start_date: startDate || '2000-01-01',
    end_date: endDate || '2099-12-31',
  });

  const ovStats         = overviewData?.stats;
  const atRiskProjects  = overviewData?.at_risk_projects ?? [];
  const overdueTaskList = overviewData?.overdue_tasks ?? [];
  const recentUsers     = overviewData?.recent_users ?? [];

  return (
    <>
      {isLoadingOverview ? (
            <div className="flex items-center justify-center min-h-[40vh]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* === System Stats === */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">ข้อมูลระบบ</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-medium">ผู้ใช้งาน</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="text-2xl font-bold">{ovStats?.users.total ?? 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {ovStats?.users.active ?? 0} ใช้งาน · {ovStats?.users.admin ?? 0} แอดมิน
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-medium">โครงการ</CardTitle>
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="text-2xl font-bold">{ovStats?.projects.total ?? 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {ovStats?.projects.active ?? 0} กำลังดำเนินการ · {ovStats?.projects.completed ?? 0} เสร็จแล้ว
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-medium">งานทั้งหมด</CardTitle>
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="text-2xl font-bold">{ovStats?.tasks.total ?? 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {ovStats?.tasks.completed ?? 0} เสร็จ · {ovStats?.tasks.in_progress ?? 0} กำลังทำ · {ovStats?.tasks.overdue ?? 0} เลยกำหนด
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-medium">บริษัท/ลูกค้า</CardTitle>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="text-2xl font-bold">{ovStats?.companies.total ?? 0}</div>
                      <p className="text-xs text-muted-foreground">{ovStats?.companies.customers ?? 0} ผู้ติดต่อ</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* === Business Stats === */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">ธุรกิจ</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-medium">โอกาสการขาย</CardTitle>
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="text-2xl font-bold">{ovStats?.opportunities.total ?? 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {ovStats?.opportunities.active ?? 0} กำลังดำเนินการ · {ovStats?.opportunities.won ?? 0} ปิดสำเร็จ
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-medium">มูลค่าไปป์ไลน์</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="text-2xl font-bold">฿{formatCurrency(ovStats?.opportunities.pipeline_value ?? 0)}</div>
                      <p className="text-xs text-muted-foreground">ไม่รวมที่เสียไปแล้ว</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-medium">ใบเสนอราคา</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="text-2xl font-bold">{ovStats?.quotations.total ?? 0}</div>
                      <p className="text-xs text-muted-foreground">
                        {ovStats?.quotations.approved ?? 0} อนุมัติ · {ovStats?.quotations.pending ?? 0} รอดำเนินการ
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                      <CardTitle className="text-xs sm:text-sm font-medium">ชั่วโมงทำงาน</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
                      <div className="text-2xl font-bold">{(ovStats?.task_hours.total_hours ?? 0).toFixed(1)}</div>
                      <p className="text-xs text-muted-foreground">จาก {ovStats?.task_hours.total_entries ?? 0} รายการ</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* === Alert Lists === */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Overdue Tasks */}
                <Card>
                  <CardHeader className="p-4 sm:p-6 pb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <CardTitle className="text-sm">งานเลยกำหนด ({ovStats?.tasks.overdue ?? 0})</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {overdueTaskList.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">ไม่มีงานเลยกำหนด</p>
                    ) : (
                      <div className="divide-y">
                        {overdueTaskList.map((task: any) => (
                          <div key={task.id} className="flex items-start justify-between px-4 sm:px-6 py-3 gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{task.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{task.assignee || '-'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge variant={task.priority === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                                {getPriorityLabel(task.priority)}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-1">{formatDate(task.end_date)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* At-risk Projects */}
                <Card>
                  <CardHeader className="p-4 sm:p-6 pb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <CardTitle className="text-sm">โครงการที่มีความเสี่ยง ({atRiskProjects.length})</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {atRiskProjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">ไม่มีโครงการที่มีความเสี่ยง</p>
                    ) : (
                      <div className="divide-y">
                        {atRiskProjects.map((project: any) => (
                          <div key={project.project_id || project.id} className="flex items-start justify-between px-4 sm:px-6 py-3 gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{project.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{project.company_name || '-'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`status-badge text-xs ${getProjectStatusColor(project.project_status)}`}>
                                {getStatusLabel(project.project_status)}
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">{formatDate(project.end_date)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* === Recent Users === */}
              <Card>
                <CardHeader className="p-4 sm:p-6 pb-3">
                  <CardTitle className="text-sm">ผู้ใช้ล่าสุด</CardTitle>
                  <CardDescription>5 บัญชีที่สร้างล่าสุด</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {recentUsers.map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between px-4 sm:px-6 py-3 gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{u.display_name || u.email}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {Number(u.is_admin) === 1 ? (
                            <Badge variant="default" className="text-xs">ผู้ดูแล</Badge>
                          ) : u.role_label ? (
                            <Badge variant="secondary" className="text-xs">{u.role_label}</Badge>
                          ) : null}
                          <p className="text-xs text-muted-foreground">{formatDate(u.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
    </>
  );
}
