import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { DbTask } from '@/types/project';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useProjectData';
import { differenceInDays, parseISO, addDays, getDay } from 'date-fns';

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
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';
import { useCapacityCheck } from '@/hooks/useCapacity';

interface CreateSubtaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTask: DbTask | null;
  editTask?: DbTask | null; // For editing existing subtask
  onSubmit: (subtask: Partial<DbTask>) => void;
  onUpdate?: (subtask: Partial<DbTask>) => void; // For updating existing subtask
  onDelete?: (subtaskId: string) => void; // For deleting existing subtask
}

// กล่อง error inline
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

export function CreateSubtaskDialog({ open, onOpenChange, parentTask, editTask, onSubmit, onUpdate, onDelete }: CreateSubtaskDialogProps) {
  const { user } = useAuth();
  const { data: users = [] } = useUsers();
  const { activeTaskExecutionTypes, data: settings } = useWorkTypeCatalog();
  const today = new Date().toISOString().split('T')[0];
  const isEditing = !!editTask;
  // Show delete button only when editing an existing subtask and a delete handler is provided
  const canDelete = isEditing && !!editTask && !!onDelete;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('medium');
  const [assignee, setAssignee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estimatedHoursInput, setEstimatedHoursInput] = useState('2');
  const [actualHours, setActualHours] = useState('2');
  const [taskType, setTaskType] = useState('task');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const estimatedDays = (startDate && endDate)
    ? Math.max(1, differenceInDays(parseISO(endDate), parseISO(startDate)) + 1)
    : 1;
  const isMultiDay = startDate !== endDate;
  const maxTaskHours = settings?.max_task_hours ?? 16;

  // Look up user ID from display_name (capacity API needs user UUID)
  const assigneeUser = assignee && assignee !== '__none__'
    ? users.find((u: any) => u.display_name === assignee || u.email === assignee)
    : null;

  const { data: capacityData } = useCapacityCheck({
    assigneeUserId: assigneeUser?.id ?? null,
    startDate: startDate || '',
    endDate: endDate || '',
    enabled: isMultiDay && !!startDate && !!endDate && !!assigneeUser?.id,
  });

  // Track initial date values to avoid overriding user's saved hours on edit load
  const [initialStart] = useState(startDate);
  const [initialEnd] = useState(endDate);

  // Auto-sync estimated hours from server capacity when assignee/dates change
  useEffect(() => {
    if (!isEditing && isMultiDay && startDate && endDate) {
      if (capacityData?.total_capacity != null && capacityData.total_capacity > 0) {
        setEstimatedHoursInput(String(capacityData.total_capacity));
      } else if (!capacityData) {
        const datesChanged = startDate !== initialStart || endDate !== initialEnd;
        if (datesChanged) setEstimatedHoursInput(workingHours(startDate, endDate).toString());
      }
    }
  }, [capacityData?.total_capacity, startDate, endDate, isMultiDay, isEditing]);

  useEffect(() => {
    if (editTask) {
      // Editing mode - populate with existing subtask data
      setTitle(editTask.title || '');
      setDescription(editTask.description || '');
      setStatus(editTask.status || 'pending');
      setPriority(editTask.priority || 'medium');
      setAssignee(editTask.assignee || '');
      setStartDate(editTask.start_date || '');
      setEndDate(editTask.end_date || '');
      setEstimatedHoursInput(editTask.estimated_hours?.toString() || '8');
      setActualHours(editTask?.actual_hours?.toString() || '');
      setTaskType(editTask?.task_type || 'task');
    } else if (parentTask) {
      setStartDate(parentTask.start_date || today);
      setEndDate(parentTask.end_date || today);
      setAssignee(user?.display_name || '');
      setTaskType('task');
      setEstimatedHoursInput('2');
      setActualHours('2');
    }
  }, [parentTask, editTask, user, today]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'กรุณาระบุชื่องาน';
    if (endDate < startDate) errs.endDate = 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น';
    
    // Impact OS Rules:
    const hrs = parseFloat(estimatedHoursInput) || 0;
    if (!isMultiDay && hrs > maxTaskHours) {
      errs.hours = `ห้ามสร้างงานใบเดียวเกิน ${maxTaskHours} ชม. กรุณาแตกเป็นงานย่อยเพิ่ม`;
    }
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (isEditing && editTask && onUpdate) {
        const updatedSubtask: Partial<DbTask> = {
          id: editTask.id,
          title: title.trim(),
          description,
          status,
          priority,
          assignee: assignee === '__none__' ? '' : assignee,
          start_date: startDate,
          end_date: endDate,
          estimated_days: estimatedDays,
          estimated_hours: parseFloat(estimatedHoursInput) || 0,
          actual_hours: parseFloat(actualHours) || 0,
          task_type: taskType,
        };
        onUpdate(updatedSubtask);
      } else if (parentTask) {
        // Create new subtask
        const subtask: Partial<DbTask> = {
          title: title.trim(),
          description,
          status,
          priority,
          assignee: assignee === '__none__' ? '' : assignee,
          start_date: startDate,
          end_date: endDate,
          estimated_days: estimatedDays,
          estimated_hours: parseFloat(estimatedHoursInput) || 0,
          actual_hours: parseFloat(actualHours) || 0,
          task_type: taskType,
          parent_task_id: parentTask.id,
          is_subtask: false, // is_subtask=0 means WBS task, not subtask hour entry
          level: (parentTask.level || 0) + 1,
          project_id: parentTask.project_id,
        };
        onSubmit(subtask);
      }
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setStatus('pending');
    setPriority('medium');
    setAssignee('');
    setEstimatedHoursInput('2');
    setActualHours('2');
    setTaskType('task');
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>
              {isEditing ? 'แก้ไขงานย่อย' : 'เพิ่มงานย่อย'}
              {parentTask && !isEditing && <span className="text-muted-foreground text-sm ml-2">→ {parentTask.title}</span>}
            </DialogTitle>
            {canDelete && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (editTask && onDelete) {
                    onDelete(editTask.id);
                    onOpenChange(false);
                  }
                }}
              >
                ลบงานย่อย
              </Button>
            )}
          </div>
        </DialogHeader>
        
        {/* Creator info when editing */}
        {isEditing && editTask && (
          <div className="px-6 pb-2 -mt-2">
            <p className="text-xs text-muted-foreground">
              ผู้สร้าง: <span className="font-medium text-foreground">{editTask?.user_display_name || editTask?.user_email || '-'}</span>
            </p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">ชื่องาน <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ชื่องานย่อย"
              className={cn(errors.title && 'border-destructive')}
              required
            />
            <FieldError message={errors.title} />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">รายละเอียด</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="รายละเอียดของงาน..."
              rows={2}
            />
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>สถานะ</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">รอดำเนินการ</SelectItem>
                  <SelectItem value="in-progress">กำลังดำเนินการ</SelectItem>
                  <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                  <SelectItem value="overdue">เลยกำหนด</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>ความสำคัญ</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">ต่ำ</SelectItem>
                  <SelectItem value="medium">ปานกลาง</SelectItem>
                  <SelectItem value="high">สูง</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Task Type & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ประเภทงาน</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeTaskExecutionTypes.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ผู้รับผิดชอบ</Label>
              <Select value={assignee || '__none__'} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกผู้รับผิดชอบ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ไม่ระบุ</SelectItem>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.display_name || user.email}>
                      {user.display_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">วันเริ่มต้น</Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="end_date">วันกำหนดส่ง</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className={cn(errors.endDate && 'border-destructive')}
              />
              <FieldError message={errors.endDate} />
            </div>
          </div>

          {/* Hours */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimated_hours">
                  ชั่วโมงประมาณ (ชม.)
                </Label>
                <Input
                  id="estimated_hours"
                  type="number"
                  min="0.5"
                  max={isMultiDay ? 1000 : maxTaskHours}
                  step={0.5}
                  value={estimatedHoursInput}
                  onChange={(e) => {
                    setEstimatedHoursInput(e.target.value);
                    setErrors(prev => ({ ...prev, hours: undefined }));
                  }}
                  placeholder="0.0"
                  className={cn(errors.hours && 'border-destructive')}
                />
                <FieldError message={errors.hours} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual_hours">ชั่วโมงจริง (ชม.)</Label>
                <Input
                  id="actual_hours"
                  type="number"
                  min="0"
                  step={0.5}
                  value={actualHours}
                  onChange={(e) => setActualHours(e.target.value)}
                  placeholder="0.0"
                />
              </div>
            </div>
            {isMultiDay && (
              <p className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                {capacityData
                  ? `${capacityData.working_days} วันทำงาน · Capacity ${capacityData.total_capacity} ชม. (ปรับแก้ได้ตามจริง)`
                  : `แนะนำ: ${workingHours(startDate, endDate)} ชม. (${estimatedDays} วันปฏิทิน, ปรับแก้ได้)`}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'กำลังบันทึก...' : (isEditing ? 'บันทึกการแก้ไข' : 'สร้างงานย่อย')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSubtaskDialog;
