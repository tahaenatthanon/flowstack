import { useMemo, useState } from 'react';
import { useAllTimesheetEntries, useUsers, useDeleteTimesheetEntry, useUpdateTimesheetEntry, useCreateTimesheetEntry, useTasks } from '@/hooks/useProjectData';
import ProjectCombobox from '@/components/ProjectCombobox';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { endOfYear, startOfYear } from 'date-fns';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';

const TimesheetViewByProject = () => {
  // State declarations first (all hooks must be called in the same order)
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [dateFrom, setDateFrom] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfYear(new Date()), 'yyyy-MM-dd'));
  const [selectedProjectId, setSelectedProjectId] = useState<string>('none');
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editHours, setEditHours] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newTaskId, setNewTaskId] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newHours, setNewHours] = useState('8');
  const [newDescription, setNewDescription] = useState('');
  const [newWorkType, setNewWorkType] = useState('work');
  const [editWorkType, setEditWorkType] = useState('work');

  // Hooks
  const { user } = useAuth();
  const deleteEntry = useDeleteTimesheetEntry();
  const updateEntry = useUpdateTimesheetEntry();
  const createEntry = useCreateTimesheetEntry();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  // Data queries (must be after useState)
  const isAdmin = Number(user?.is_admin) === 1;
  const { data: timesheetEntries = [], isLoading } = useAllTimesheetEntries(true, { dateFrom, dateTo });
  const { data: users = [] } = useUsers();
  const { data: tasks = [] } = useTasks(newProjectId || undefined);

  // Filter tasks by selected project for create form
  const filteredTasks = newProjectId ? tasks.filter((t: any) => t.project_id === newProjectId) : [];

  const handleYearChange = (year: string) => {
    setYearFilter(year);
    if (year === '__all__') {
      setDateFrom('');
      setDateTo('');
    } else {
      const selectedYear = parseInt(year, 10);
      setDateFrom(format(startOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'));
      setDateTo(format(endOfYear(new Date(selectedYear, 0, 1)), 'yyyy-MM-dd'));
    }
  };

  // Filter entries
  const filteredEntries = useMemo(() => {
    let entries = [...timesheetEntries];

    if (selectedProjectId && selectedProjectId !== 'none') {
      entries = entries.filter((entry: any) => entry.project_id === selectedProjectId);
    }

    entries.sort((a: any, b: any) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return entries;
  }, [timesheetEntries, selectedProjectId]);

  const handleDelete = async (entry: any) => {
    if (!await confirm({ title: 'ลบ Timesheet', description: 'ต้องการลบรายการ Timesheet นี้?', variant: 'destructive' })) return;
    try {
      await deleteEntry.mutateAsync({ id: entry.id, projectId: entry.project_id });
      toast({ title: 'ลบรายการแล้ว' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setEditHours(String(entry.hours_worked || ''));
    setEditDescription(entry.description || '');
    setEditWorkType(entry.work_type || 'work');
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    try {
      await updateEntry.mutateAsync({
        id: editingEntry.id,
        hours_worked: parseFloat(editHours) || 0,
        description: editDescription,
        work_type: editWorkType,
        projectId: editingEntry.project_id,
      });
      toast({ title: 'แก้ไขสำเร็จ' });
      setEditingEntry(null);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleCreate = async () => {
    // For leave/holiday type, project and task are optional
    if (newWorkType !== 'leave' && newWorkType !== 'holiday' && (!newProjectId || !newTaskId)) {
      toast({ title: 'กรุณาเลือกโปรเจกต์และงาน', variant: 'destructive' });
      return;
    }
    try {
      await createEntry.mutateAsync({
        projectId: (newWorkType === 'leave' || newWorkType === 'holiday') ? '' : newProjectId,
        task_id: (newWorkType === 'leave' || newWorkType === 'holiday') ? '' : newTaskId,
        date: newDate,
        hours_worked: parseFloat(newHours) || 0,
        description: newDescription,
        work_type: newWorkType,
      });
      toast({ title: 'สร้าง Timesheet สำเร็จ' });
      setIsCreateOpen(false);
      setNewProjectId('');
      setNewTaskId('');
      setNewDate(format(new Date(), 'yyyy-MM-dd'));
      setNewHours('8');
      setNewDescription('');
      setNewWorkType('work');
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  // Get unique years
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    timesheetEntries.forEach((entry: any) => {
      if (entry.date) {
        years.add(new Date(entry.date).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [timesheetEntries]);

  const totalHours = filteredEntries.reduce((sum: number, e: any) => sum + Number(e.hours_worked || 0), 0);

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">กำลังโหลด...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters and Create Button */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="mb-1 block text-xs">โปรเจกต์</Label>
          <div className="w-40">
            <ProjectCombobox
              value={selectedProjectId}
              onChange={(id) => setSelectedProjectId(id)}
              placeholder="ทุกโปรเจกต์"
              allowNone={true}
            />
          </div>
        </div>
        <div>
          <Label className="mb-1 block text-xs">ปี</Label>
          <select
            className="flex h-9 w-24 rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={yearFilter}
            onChange={(e) => handleYearChange(e.target.value)}
          >
            <option value="__all__">ทุกปี</option>
            {availableYears.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="mb-1 block text-xs">จากวันที่</Label>
          <Input
            type="date"
            className="h-9 w-36 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">ถึงวันที่</Label>
          <Input
            type="date"
            className="h-9 w-36 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="ml-auto">
          <Plus className="w-4 h-4 mr-1" />
          เพิ่ม Timesheet
        </Button>
        <div className="ml-2 text-sm">
          <span className="text-muted-foreground">รวม: </span>
          <span className="font-medium">{totalHours} ชม.</span>
          <span className="text-muted-foreground ml-2">({filteredEntries.length} รายการ)</span>
        </div>
      </div>

      {/* Create Dialog */}
      {isCreateOpen && (
        <Dialog open={isCreateOpen} onOpenChange={(v) => { setIsCreateOpen(v); if (!v) { setNewProjectId(''); setNewTaskId(''); setNewDate(format(new Date(), 'yyyy-MM-dd')); setNewHours('8'); setNewDescription(''); setNewWorkType('work'); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่ม Timesheet ใหม่</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Select work type first */}
              <div className="grid gap-2">
                <Label className="text-xs">ประเภทงาน</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newWorkType}
                  onChange={(e) => {
                    setNewWorkType(e.target.value);
                    // Reset project/task if switching to leave or holiday type
                    if (e.target.value === 'leave' || e.target.value === 'holiday') {
                      setNewProjectId('');
                      setNewTaskId('');
                    }
                  }}
                >
                  <option value="work">งานปกติ</option>
                  <option value="meeting">ประชุม</option>
                  <option value="ot">งานล่วงเวลา (OT)</option>
                  <option value="leave">ลาหยุด</option>
                  <option value="holiday">วันหยุด</option>
                  <option value="onsite">งานลูกค้า (Onsite)</option>
                </select>
              </div>

              {/* Project and Task - only required for normal work/meeting/ot/onsite */}
              <div className={`grid gap-2 ${(newWorkType === 'leave' || newWorkType === 'holiday') ? 'opacity-50' : ''}`}>
                <Label className="text-xs">โปรเจกต์ {(newWorkType === 'leave' || newWorkType === 'holiday') && '(ไม่จำเป็น)'}</Label>
                <ProjectCombobox
                  value={newProjectId}
                  onChange={(id) => { setNewProjectId(id); setNewTaskId(''); }}
                  placeholder="เลือกโปรเจกต์"
                  disabled={newWorkType === 'leave' || newWorkType === 'holiday'}
                  allowNone={false}
                />
              </div>
              <div className={`grid gap-2 ${(newWorkType === 'leave' || newWorkType === 'holiday') ? 'opacity-50' : ''}`}>
                <Label className="text-xs">งาน {(newWorkType === 'leave' || newWorkType === 'holiday') && '(ไม่จำเป็น)'}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newTaskId}
                  onChange={(e) => setNewTaskId(e.target.value)}
                  disabled={(newWorkType === 'leave' || newWorkType === 'holiday') || !newProjectId}
                >
                  <option value="">เลือกงาน</option>
                  {filteredTasks.map((task: any) => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs">วันที่</Label>
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs">ชั่วโมง</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={newHours}
                    onChange={(e) => setNewHours(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">รายละเอียด</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="รายละเอียด..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleCreate} disabled={createEntry.isPending}>
                บันทึก
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      {editingEntry && (
        <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>แก้ไข Timesheet</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label className="text-xs">ชั่วโมง</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">รายละเอียด</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">ประเภทงาน</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editWorkType}
                  onChange={(e) => setEditWorkType(e.target.value)}
                >
                  <option value="work">งานปกติ</option>
                  <option value="meeting">ประชุม</option>
                  <option value="ot">งานล่วงเวลา (OT)</option>
                  <option value="leave">ลาหยุด</option>
                  <option value="holiday">วันหยุด</option>
                  <option value="onsite">งานลูกค้า (Onsite)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingEntry(null)}>
                ยกเลิก
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateEntry.isPending}>
                บันทึก
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Table */}
      {filteredEntries.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          ไม่มีข้อมูล Timesheet
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">วันที่</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">โปรเจกต์</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">งาน</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden md:table-cell">ประเภท</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground hidden md:table-cell">รายละเอียด</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">ผู้บันทึก</th>
                <th className="text-right py-2 px-3 font-medium text-muted-foreground">ชม.</th>
                {isAdmin && <th className="text-right py-2 px-3 font-medium text-muted-foreground">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry: any) => (
                <tr key={entry.id} className="border-t hover:bg-muted/30">
                  <td className="py-2 px-3 whitespace-nowrap">
                    {entry.date ? format(parseISO(entry.date), 'd MMM yyyy', { locale: th }) : '-'}
                  </td>
                  <td className="py-2 px-3">{entry.project_name || '-'}</td>
                  <td className="py-2 px-3 font-medium">{entry.task_title || '-'}</td>
                  <td className="py-2 px-3 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      entry.work_type === 'meeting' ? 'bg-blue-100 text-blue-800' :
                      entry.work_type === 'leave' ? 'bg-red-100 text-red-800' :
                      entry.work_type === 'holiday' ? 'bg-green-100 text-green-800' :
                      entry.work_type === 'ot' ? 'bg-orange-100 text-orange-800' :
                      entry.work_type === 'onsite' ? 'bg-purple-100 text-purple-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {entry.work_type === 'meeting' ? 'ประชุม' :
                       entry.work_type === 'leave' ? 'ลาหยุด' :
                       entry.work_type === 'holiday' ? 'วันหยุด' :
                       entry.work_type === 'ot' ? 'งานล่วงเวลา (OT)' :
                       entry.work_type === 'onsite' ? 'งานลูกค้า (Onsite)' : 'งานปกติ'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground hidden md:table-cell">{entry.description}</td>
                  <td className="py-2 px-3">{entry.user_name || '-'}</td>
                  <td className="py-2 px-3 text-right font-medium">{entry.hours_worked}</td>
                  {isAdmin && (
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(entry)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(entry)}
                          disabled={deleteEntry.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TimesheetViewByProject;
