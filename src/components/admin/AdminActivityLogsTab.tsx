import { useState } from 'react';
import { useActivityLogs, type ActivityLog } from '@/hooks/useProjectData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, X, ChevronLeft, ChevronRight, Activity, LogIn, LogOut } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import RowsPerPageSelector from '@/components/RowsPerPageSelector';

export function AdminActivityLogsTab({ users }: { users: any[] }) {
  const [logPage, setLogPage]     = useState(1);
  const [logSearch, setLogSearch] = useState('');
  const [logAction, setLogAction] = useState('');
  const [logUserId, setLogUserId] = useState('');
  const [logLimit, setLogLimit]   = useState(50);

  const { data: activityData, isLoading: isLoadingLogs } = useActivityLogs(
    { page: logPage, limit: logLimit, search: logSearch || undefined, action: logAction || undefined, user_id: logUserId || undefined },
    true
  );
  const activityLogs  = activityData?.logs ?? [];
  const logTotalPages = activityData?.pages ?? 1;
  const logTotal      = activityData?.total ?? 0;

  return (
    <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Log กิจกรรมผู้ใช้งาน
              </CardTitle>
              <CardDescription>บันทึกการเข้าสู่ระบบและกิจกรรมต่างๆ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อ, อีเมล, IP..."
                    value={logSearch}
                    onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }}
                    className="pl-9 pr-9"
                  />
                  {logSearch && (
                    <button onClick={() => { setLogSearch(''); setLogPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select value={logAction} onValueChange={(v) => { setLogAction(v === '__all__' ? '' : v); setLogPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="ประเภทกิจกรรม" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทุกประเภท</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={logUserId} onValueChange={(v) => { setLogUserId(v === '__all__' ? '' : v); setLogPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="ผู้ใช้งาน" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">ทุกคน</SelectItem>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.display_name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-sm text-muted-foreground flex items-center">
                  {isLoadingLogs ? 'กำลังโหลด...' : `${logTotal.toLocaleString()} รายการ`}
                </div>
              </div>

              {/* Table */}
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">ไม่พบข้อมูล</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">วันที่/เวลา</TableHead>
                        <TableHead>ผู้ใช้งาน</TableHead>
                        <TableHead className="w-[90px]">กิจกรรม</TableHead>
                        <TableHead>รายละเอียด</TableHead>
                        <TableHead className="w-[110px]">IP Address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogs.map((log: ActivityLog) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(parseISO(log.created_at), 'dd MMM yy HH:mm', { locale: th })}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{log.display_name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{log.email}</div>
                          </TableCell>
                          <TableCell>
                            {log.action === 'login' ? (
                              <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                                <LogIn className="h-3 w-3" /> Login
                              </Badge>
                            ) : log.action === 'logout' ? (
                              <Badge className="gap-1 bg-gray-100 text-gray-700 hover:bg-gray-100">
                                <LogOut className="h-3 w-3" /> Logout
                              </Badge>
                            ) : (
                              <Badge variant="outline">{log.action}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{log.description}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{log.ip_address || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
                <RowsPerPageSelector value={logLimit} onChange={setLogLimit} />
                <span className="text-sm text-muted-foreground">{logTotal} รายการ</span>
                {logTotalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">หน้า {logPage} / {logTotalPages}</span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={logPage >= logTotalPages} onClick={() => setLogPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
  );
}
