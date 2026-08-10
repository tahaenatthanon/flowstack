import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useCreateTask, useUpdateTask, useUsers } from '@/hooks/useProjectData';
import { useDeleteTask } from '@/hooks/useTasks';
import ProjectCombobox from '@/components/ProjectCombobox';
import UserCombobox from '@/components/UserCombobox';
import { TASK_STATUS_LABELS } from '@/lib/labels';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, AlertCircle, Calendar, Clock, User, Flag } from 'lucide-react';
import { useRef } from 'react';

function DateInput({
  value, onChange, min, disabled, className,
}: {
  value: string; onChange: (v: string) => void;
  min?: string; disabled?: boolean; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const formatted = value
    ? (() => { const [y, m, d] = value.split('-'); return `${d} / ${m} / ${y}`; })()
    : 'วว / ดด / ปปปป';
  return (
    <div
      className={cn(
        'relative flex items-center h-10 px-3 rounded-md border border-input bg-background text-sm cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed', className,
      )}
      onClick={() => !disabled && ref.current?.showPicker?.()}
    >
      <span className={cn('flex-1', !value && 'text-muted-foreground')}>{formatted}</span>
      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
        tabIndex={-1}
      />
    </div>
  );
}
import { format, addDays, differenceInDays, parseISO, getDay } from 'date-fns';

/** Fallback: count working hours skipping Sat/Sun (used when no assignee or capacity not loaded yet) */
function workingHours(start: string, end: string, hoursPerDay = 8): number {
  let d = parseISO(start);
  const e = parseISO(end);
  let h = 0;
  while (d <= e) {
    const dow = getDay(d);
    if (dow !== 0 && dow !== 6) h += hoursPerDay;
    d = addDays(d, 1);
  }
  return Math.max(hoursPerDay, h);
}
import { DbProject } from '@/types/project';
import { cn } from '@/lib/utils';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';
import { useCapacityCheck } from '@/hooks/useCapacity';

interface CreateTaskDialogProps {
  projectId?: string;
  defaultDate?: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  editTask?: { id: string; project_id: string; title?: string; description?: string; status?: string; priority?: string; task_type?: string; assignee?: string; assignee_user_id?: string; start_date?: string; end_date?: string; estimated_hours?: number; actual_hours?: number } | null;
  onSuccess?: () => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] text-destructive mt-1">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

const CreateTaskDialog = ({ projectId, defaultDate, externalOpen, onExternalOpenChange, editTask, onSuccess }: CreateTaskDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const isEditing = !!editTask;

  const [taskType, setTaskType] = useState('task');
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('medium');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [estimatedHoursInput, setEstimatedHoursInput] = useState('2');
  const [actualHoursInput, setActualHoursInput] = useState('0');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { activeTaskExecutionTypes, data: settings } = useWorkTypeCatalog();
  const maxTaskHours = settings?.max_task_hours ?? 16;
  const { toast } = useToast();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { user } = useAuth();
  const [assignee, setAssignee] = useState<string>(user?.id || '');

  // Derived early so useCapacityCheck can use it
  const isMultiDay = startDate !== endDate;

  const assigneeId = assignee && assignee !== 'none' ? assignee : null;
  const { data: capacityData } = useCapacityCheck({
    assigneeUserId: assigneeId,
    startDate,
    endDate,
    enabled: isMultiDay && !!assigneeId,
  });

  // Auto-sync estimated hours from server capacity when assignee/dates change (multi-day only)
  useEffect(() => {
    if (isMultiDay && capacityData?.total_capacity != null && capacityData.total_capacity > 0) {
      setEstimatedHoursInput(String(capacityData.total_capacity));
    } else if (isMultiDay && !capacityData) {
      setEstimatedHoursInput(String(workingHours(startDate, endDate)));
    }
  }, [capacityData?.total_capacity, startDate, endDate, isMultiDay]);

  // Initialize from editTask when editing
  useEffect(() => {
    if (open && editTask) {
      setTitle(editTask.title || '');
      setDescription(editTask.description || '');
      setStatus(editTask.status || 'pending');
      setPriority(editTask.priority || 'medium');
      setTaskType(editTask.task_type || 'task');
      setStartDate(editTask.start_date || format(new Date(), 'yyyy-MM-dd'));
      setEndDate(editTask.end_date || format(new Date(), 'yyyy-MM-dd'));
      setEstimatedHoursInput(String(editTask.estimated_hours ?? 2));
      setActualHoursInput(String(editTask.actual_hours ?? 0));
      setAssignee(editTask.assignee_user_id || '');
      if (editTask.project_id) setSelectedProjectId(editTask.project_id);
    }
  }, [open, editTask]);

  useEffect(() => {
    if (open && defaultDate && !editTask) {
      setStartDate(defaultDate);
      setEndDate(defaultDate);
    }
  }, [open, defaultDate, editTask]);

  const estimatedDays = Math.max(1, differenceInDays(parseISO(endDate), parseISO(startDate)) + 1);
  const computedHours = isMultiDay
    ? (parseFloat(estimatedHoursInput) || workingHours(startDate, endDate))
    : (parseFloat(estimatedHoursInput) || 2);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'กรุณาระบุชื่องาน';
    if (!selectedProjectId) errs.project = 'กรุณาเลือกโปรเจกต์';
    if (endDate < startDate) errs.endDate = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น';
    if (!isMultiDay && computedHours > maxTaskHours) errs.hours = `ห้ามสร้างงานใบเดียวเกิน ${maxTaskHours} ชม. กรุณาแตกเป็นงานย่อย`;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTypeChange = (val: string) => {
    setTaskType(val);
    setErrors({});
    setEndDate(startDate);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (!isMultiDay) {
      setEndDate(val);
      setEstimatedHoursInput('2');
    } else {
      const currentDuration = differenceInDays(parseISO(endDate), parseISO(startDate));
      const newEnd = format(addDays(parseISO(val), Math.max(0, currentDuration)), 'yyyy-MM-dd');
      setEndDate(newEnd);
      setEstimatedHoursInput(newEnd === val ? '2' : String(workingHours(val, newEnd)));
    }
    setErrors((e) => ({ ...e, endDate: undefined }));
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setAssignee(user?.id || '');
    setTaskType('task'); setErrors({});
    if (!projectId) setSelectedProjectId('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
    setPriority('medium'); setStatus('pending');
    setEstimatedHoursInput('2'); setActualHoursInput('0');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const effectiveProjectId = selectedProjectId || projectId || '';
    const effectiveTitle = title.trim() || 'งาน';
    try {
      if (isEditing && editTask) {
        await updateTask.mutateAsync({
          id: editTask.id,
          project_id: effectiveProjectId,
          title: effectiveTitle,
          description,
          status,
          priority,
          assignee: (!assignee || assignee === 'none') ? '' : (users.find(u => u.id === assignee)?.display_name || ''),
          assignee_user_id: (!assignee || assignee === 'none') ? null : assignee,
          start_date: startDate,
          end_date: endDate,
          estimated_days: estimatedDays,
          estimated_hours: computedHours,
          actual_hours: parseFloat(actualHoursInput) || 0,
          task_type: taskType,
        });
      } else {
        const result: any = await createTask.mutateAsync({
          project_id: effectiveProjectId,
          title: effectiveTitle,
          description,
          status,
          priority,
          assignee: (!assignee || assignee === 'none') ? '' : (users.find(u => u.id === assignee)?.display_name || ''),
          assignee_user_id: (!assignee || assignee === 'none') ? null : assignee,
          start_date: startDate,
          end_date: endDate,
          estimated_days: estimatedDays,
          estimated_hours: computedHours,
          actual_hours: parseFloat(actualHoursInput) || 0,
          task_type: taskType,
        });
        if (result?.warnings?.length) {
          result.warnings.forEach((w: string) => toast({ title: `⚠️ ${w}` }));
        }
      }
      toast({ title: isEditing ? 'อัปเดตงานสำเร็จ' : 'เพิ่มงานสำเร็จ' });
      setOpen(false);
      resetForm();
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const canDelete = isEditing && editTask && user && (user.is_admin === 1 || user.id === editTask.user_id);
  const deleteTask = useDeleteTask();
  const handleDelete = async () => {
    if (!editTask) return;
    if (window.confirm('ยืนยันการลบงานนี้? งานย่อยและ บันทึกชั่วโมงที่เกี่ยวข้องจะถูกลบด้วย')) {
      await deleteTask.mutateAsync({ id: editTask.id, projectId: editTask.project_id });
      setOpen(false);
      resetForm();
      onSuccess?.();
    }
  };
  return (
    <>
      {externalOpen === undefined && !editTask && (
        <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" />
          เพิ่มงาน
        </Button>
      )}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0" side="right">
          <SheetHeader className="px-5 pt-5 pb-3 border-b">
            <SheetTitle className="sr-only">สร้างงานใหม่</SheetTitle>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  autoFocus
                  value={title}
                  onChange={e => { setTitle(e.target.value); setErrors(err => ({ ...err, title: undefined })); }}
                  placeholder="ระบุชื่องาน..."
                  className={cn(
                    'text-base font-bold h-auto py-1 border-0 border-b rounded-none shadow-none px-0 focus-visible:ring-0 focus-visible:border-b-2',
                    errors.title ? 'border-destructive' : 'border-transparent focus-visible:border-primary'
                  )}
                />
                {errors.title && <FieldError message={errors.title} />}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap min-h-[1.25rem]">
                  <Badge variant="secondary" className="text-[10px]">
                    {priority === 'high' ? '🔴 สูง' : priority === 'medium' ? '🟡 ปานกลาง' : '🟢 ต่ำ'}
                  </Badge>
                </div>
              </div>
              {canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="ml-2"
                  onClick={handleDelete}
                  disabled={deleteTask.isPending}
                >
                  {deleteTask.isPending ? 'กำลังลบ...' : 'ลบงาน'}
                </Button>
              )}
            </div>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="px-5 pb-6 pt-4 space-y-4">

            {/* ประเภทงาน */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Flag className="w-3 h-3" /> ประเภทงาน <span className="text-destructive">*</span>
              </Label>
              <p className="text-[11px] text-muted-foreground">ค่าเริ่มต้น: งานปกติ (task) | กรณีลา/วันหยุดให้บันทึกในปฏิทินทีม</p>
              <Select value={taskType} onValueChange={handleTypeChange}>
                <SelectTrigger className=""><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeTaskExecutionTypes.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* รายละเอียด */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">รายละเอียด</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="รายละเอียดงาน..."
                rows={3}
                className="text-sm"
              />
            </div>

            {/* สถานะ */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Flag className="w-3 h-3" /> สถานะ <span className="text-destructive">*</span>
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className=""><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ความสำคัญ + ผู้รับผิดชอบ */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Flag className="w-3 h-3" /> ความสำคัญ <span className="text-destructive">*</span>
                </Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className=""><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 สูง</SelectItem>
                    <SelectItem value="medium">🟡 ปานกลาง</SelectItem>
                    <SelectItem value="low">🟢 ต่ำ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" /> ผู้รับผิดชอบ
                </Label>
                <UserCombobox
                  value={assignee}
                  onChange={(id) => setAssignee(id)}
                  placeholder="ไม่ระบุ"
                  allowNone={true}
                />
              </div>
            </div>

            {/* วันเริ่ม + วันสิ้นสุด */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> วันเริ่ม <span className="text-destructive">*</span>
                </Label>
                <DateInput value={startDate} onChange={handleStartDateChange} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> วันสิ้นสุด <span className="text-destructive">*</span>
                </Label>
                <DateInput
                  value={endDate}
                  onChange={(v) => {
                    setEndDate(v);
                    if (v === startDate) {
                      setEstimatedHoursInput('8');
                    } else if (v > startDate) {
                      setEstimatedHoursInput(String(workingHours(startDate, v)));
                    }
                    setErrors((err) => ({ ...err, endDate: undefined }));
                  }}
                  min={startDate}
                  className={cn(errors.endDate && 'border-destructive')}
                />
                <FieldError message={errors.endDate} />
              </div>
            </div>

            {/* ชม.ประมาณ + ชม.จริง */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={cn('text-xs text-muted-foreground flex items-center gap-1', errors.hours && 'text-destructive')}>
                  <Clock className="w-3 h-3" /> ชม.ประมาณ <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={estimatedHoursInput}
                  onChange={(e) => { setEstimatedHoursInput(e.target.value); setErrors(prev => ({ ...prev, hours: undefined })); }}
                  placeholder="8"
                  className={cn(errors.hours && 'border-destructive focus-visible:ring-destructive')}
                />
                {errors.hours
                  ? <FieldError message={errors.hours} />
                  : <p className="text-[10px] text-muted-foreground mt-1">
                      {isMultiDay
                        ? capacityData
                          ? `${capacityData.working_days} วันทำงาน · Capacity ${capacityData.total_capacity} ชม. (แก้ไขได้)`
                          : `${estimatedDays} วันปฏิทิน (แก้ไขได้)`
                        : `สูงสุด ${maxTaskHours} ชม.`}
                    </p>
                }
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3 text-green-600" /> ชม.จริง
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  step={0.5}
                  value={actualHoursInput}
                  onChange={(e) => setActualHoursInput(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* โปรเจกต์ */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Flag className="w-3 h-3" /> โปรเจกต์ <span className="text-destructive">*</span>
              </Label>
              <ProjectCombobox
                value={selectedProjectId}
                onChange={(id) => { setSelectedProjectId(id); setErrors((e) => ({ ...e, project: undefined })); }}
                placeholder="เลือกโปรเจกต์"
                includeBaseCalendar={true}
                allowNone={false}
              />
              <FieldError message={errors.project} />
            </div>

            {/* บันทึก / ยกเลิก */}
            <div className="pt-2 border-t flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => { setOpen(false); resetForm(); }}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="flex-1"
                size="sm"
                disabled={(isEditing ? updateTask.isPending : createTask.isPending) || !selectedProjectId}
              >
                {(isEditing ? updateTask.isPending : createTask.isPending) ? (
                  <><span className="animate-spin mr-2">⟳</span>กำลังบันทึก...</>
                ) : isEditing ? (
                  'บันทึก'
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />สร้างงาน</>
                )}
              </Button>
            </div>

          </form>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default CreateTaskDialog;
