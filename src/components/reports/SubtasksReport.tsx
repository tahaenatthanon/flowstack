import { useState, useEffect } from 'react';
import { useSubtasksReport } from '@/hooks/useProjectData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RowsPerPageSelector from '@/components/RowsPerPageSelector';
import { Loader2, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { getStatusLabel, getPriorityLabel } from '@/lib/projectUtils';

interface Props {
  startDate?: string;
  endDate?: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed':  return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20';
    case 'in-progress': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    case 'overdue':    return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
    default:           return 'bg-muted text-muted-foreground border-border';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':   return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20';
    case 'medium': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20';
    case 'low':    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    default:       return 'bg-muted text-muted-foreground border-border';
  }
}

export default function SubtasksReport({ startDate, endDate }: Props) {
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(25);
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('__all__');
  const [priorityFilter, setPriorityFilter] = useState('__all__');

  useEffect(() => { setPage(1); }, [pageSize, debouncedSearch, statusFilter, priorityFilter]);

  // Debounce search by 400 ms
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(val: string) {
    setSearch(val);
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
    setSearchTimer(t);
  }

  const params = {
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter !== '__all__' ? statusFilter : undefined,
    priority: priorityFilter !== '__all__' ? priorityFilter : undefined,
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  };

  const { data, isLoading, isFetching } = useSubtasksReport(params);

  const subtasks = data?.subtasks ?? [];
  const total    = data?.total ?? 0;
  const pages    = data?.pages ?? 1;

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setStatusFilter('__all__');
    setPriorityFilter('__all__');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Sub-filters */}
      <div className="flex flex-wrap gap-3 items-center no-print">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="ค้นหางานย่อย, งานหลัก, โครงการ..."
            className="pl-9 pr-9"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="สถานะ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">ทุกสถานะ</SelectItem>
            <SelectItem value="pending">รอดำเนินการ</SelectItem>
            <SelectItem value="in-progress">กำลังทำ</SelectItem>
            <SelectItem value="completed">เสร็จแล้ว</SelectItem>
            <SelectItem value="overdue">เกินกำหนด</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={(v) => { setPriorityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="ความสำคัญ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">ทุกระดับ</SelectItem>
            <SelectItem value="high">สูง</SelectItem>
            <SelectItem value="medium">กลาง</SelectItem>
            <SelectItem value="low">ต่ำ</SelectItem>
          </SelectContent>
        </Select>

        {(debouncedSearch || statusFilter !== '__all__' || priorityFilter !== '__all__') && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            ล้างตัวกรอง
          </Button>
        )}

        <span className="text-sm text-muted-foreground ml-auto">
          {isFetching && !isLoading && <Loader2 className="h-3 w-3 animate-spin inline mr-1" />}
          {total} รายการ
        </span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : subtasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <span className="text-4xl">🔍</span>
          <p>ไม่พบงานย่อย</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="min-w-[180px]">งานย่อย</TableHead>
                  <TableHead className="min-w-[160px]">งานหลัก</TableHead>
                  <TableHead className="min-w-[140px]">โครงการ</TableHead>
                  <TableHead className="w-[110px]">สถานะ</TableHead>
                  <TableHead className="w-[90px]">ความสำคัญ</TableHead>
                  <TableHead className="min-w-[120px]">ผู้รับผิดชอบ</TableHead>
                  <TableHead className="w-[100px]">วันเริ่ม</TableHead>
                  <TableHead className="w-[100px]">วันสิ้นสุด</TableHead>
                  <TableHead className="w-[90px] text-center">วัน (ใช้/ประมาณ)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subtasks.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{s.title}</TableCell>
                    <TableCell className="text-muted-foreground">{s.parent_task_title || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.project_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getStatusColor(s.status)}`}>
                        {getStatusLabel(s.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getPriorityColor(s.priority)}`}>
                        {getPriorityLabel(s.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.assignee || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.start_date || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.end_date || '—'}</TableCell>
                    <TableCell className="text-center text-sm">
                      <span className={s.days_spent > s.estimated_days ? 'text-red-500 font-medium' : ''}>
                        {s.days_spent}
                      </span>
                      <span className="text-muted-foreground">/{s.estimated_days}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 flex-wrap no-print">
        <RowsPerPageSelector value={pageSize} onChange={setPageSize} />
        <span className="text-xs text-muted-foreground">{total} รายการ</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              ก่อนหน้า
            </Button>
            <span className="text-sm text-muted-foreground">
              หน้า {page} / {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="gap-1"
            >
              ถัดไป
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
