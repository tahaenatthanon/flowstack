import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTimesheetEntry, useUpdateTimesheetEntry, useTasks } from '@/hooks/useProjectData';
import ProjectCombobox from '@/components/ProjectCombobox';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useWorkTypeCatalog } from '@/hooks/useWorkTypes';

export interface CreateTimesheetEntryDialogProps {
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  buttonLabel?: string;
  defaultDate?: string;
  defaultWorkType?: string;
  defaultProjectId?: string;
  defaultTaskId?: string;
  defaultHours?: string;
  defaultDescription?: string;
  className?: string;
  /** Pass an entry to switch to edit mode — uses update mutation instead of create */
  editEntry?: {
    id: string;
    task_id?: string;
    project_id?: string;
    date?: string;
    hours_worked?: number;
    work_type?: string;
    description?: string;
  };
}

const QUICK_HOURS = ['0.5', '1', '1.5', '2', '3', '4', '6', '8'];

function Required() {
  return <span className="text-destructive ml-0.5">*</span>;
}
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 shrink-0" />{message}
    </p>
  );
}

/** Compute hours from HH:MM start/end. Returns null if invalid. */
function calcHours(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (isNaN(sh) || isNaN(eh)) return null;
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? Math.round(diff / 60 * 10) / 10 : null;
}

const CreateTimesheetEntryDialog = ({
  onSuccess,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  buttonLabel,
  defaultDate,
  defaultWorkType,
  defaultProjectId,
  defaultTaskId,
  defaultHours,
  defaultDescription,
  className,
  editEntry,
}: CreateTimesheetEntryDialogProps) => {
  const isEditMode = !!editEntry;

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const isOpen = isControlled ? openProp : internalOpen;
  const setIsOpen = (v: boolean) => { if (isControlled) onOpenChange?.(v); else setInternalOpen(v); };

  const { activeTaskExecutionTypes } = useWorkTypeCatalog();
  const workTypeOptions = useMemo(() => {
    return activeTaskExecutionTypes.map(t => ({ value: t.key, label: t.label }));
  }, [activeTaskExecutionTypes]);

  const [workType,    setWorkType]    = useState('work');
  const [projectId,   setProjectId]   = useState('');
  const [taskId,      setTaskId]      = useState('');
  const [date,        setDate]        = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime,   setStartTime]   = useState('');
  const [endTime,     setEndTime]     = useState('');
  const [hours,       setHours]       = useState('8');
  const [description, setDescription] = useState('');
  const [errors,      setErrors]      = useState<Record<string, string | undefined>>({});
  const [useTimePicker, setUseTimePicker] = useState(false);

  const createEntry = useCreateTimesheetEntry();
  const updateEntry = useUpdateTimesheetEntry();
  const { data: tasks = [] } = useTasks(projectId || undefined);
  const { toast } = useToast();

  const filteredTasks = projectId
    ? tasks.filter((t) => t.project_id === projectId && !t.is_subtask)
    : tasks.filter((t) => !t.is_subtask);

  // Auto-calc hours from time picker
  useEffect(() => {
    if (!useTimePicker) return;
    const h = calcHours(startTime, endTime);
    if (h !== null) { setHours(String(h)); setErrors(e => ({ ...e, hours: undefined })); }
  }, [startTime, endTime, useTimePicker]);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && editEntry) {
        setWorkType(editEntry.work_type   ?? 'work');
        setProjectId(editEntry.project_id ?? '');
        setTaskId(editEntry.task_id       ?? '');
        setDate(editEntry.date            ?? format(new Date(), 'yyyy-MM-dd'));
        setHours(String(editEntry.hours_worked ?? '8'));
        setDescription(editEntry.description ?? '');
      } else {
        setWorkType(defaultWorkType   ?? 'work');
        setProjectId(defaultProjectId ?? '');
        setTaskId(defaultTaskId       ?? '');
        setDate(defaultDate           ?? format(new Date(), 'yyyy-MM-dd'));
        setHours(defaultHours         ?? '8');
        setDescription(defaultDescription ?? '');
      }
      setStartTime(''); setEndTime('');
      setUseTimePicker(false);
      setErrors({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const resetForm = () => {
    setWorkType('work'); setProjectId(''); setTaskId('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setHours('8'); setDescription('');
    setStartTime(''); setEndTime('');
    setUseTimePicker(false); setErrors({});
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!taskId) errs.task = 'กรุณาเลือกงานที่ทำ';
    const h = parseFloat(hours);
    if (!hours || isNaN(h) || h <= 0) errs.hours = 'กรุณาระบุจำนวนชั่วโมง (มากกว่า 0)';
    if (h > 24) errs.hours = 'ชั่วโมงต้องไม่เกิน 24';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (isEditMode && editEntry) {
        await updateEntry.mutateAsync({
          id:           editEntry.id,
          task_id:      taskId,
          projectId:    projectId,
          date,
          hours_worked: parseFloat(hours),
          description,
          work_type:    workType,
        });
        toast({ title: 'แก้ไข Timesheet สำเร็จ' });
      } else {
        await createEntry.mutateAsync({
          task_id:      taskId,
          project_id:   projectId,
          date,
          hours_worked: parseFloat(hours),
          description,
          work_type:    workType,
          start_time:   useTimePicker && startTime ? startTime : undefined,
          end_time:     useTimePicker && endTime   ? endTime   : undefined,
        });
        toast({ title: 'บันทึกชั่วโมงสำเร็จ' });
      }
      resetForm();
      setIsOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const dialogContent = (
    <DialogContent className="w-full sm:max-w-2xl sm:max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-heading text-xl flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          {isEditMode ? 'แก้ไขบันทึกเวลา' : 'บันทึกชั่วโมงงาน (Timesheet)'}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ประเภทงาน */}
          <div className="space-y-1.5">
            <Label className="text-sm">ประเภทงาน<Required /></Label>
            <Select value={workType} onValueChange={(v) => {
              setWorkType(v);
              setErrors({});
            }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {workTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* วันที่ */}
          <div className="space-y-1.5">
            <Label className="text-sm">วันที่ทำงาน<Required /></Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required className="h-9 text-sm" />
          </div>
        </div>

        {/* โปรเจกต์ + งาน */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">โปรเจกต์<Required /></Label>
            <ProjectCombobox
              value={projectId}
              onChange={(id) => { setProjectId(id); setTaskId(''); setErrors(e => ({ ...e, task: undefined })); }}
              placeholder="เลือกโปรเจกต์"
              allowNone={false}
              includeBaseCalendar={true}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">งานที่ทำ (Task)<Required /></Label>
            <Select value={taskId} onValueChange={(v) => { setTaskId(v); setErrors(e => ({ ...e, task: undefined })); }} disabled={!projectId}>
              <SelectTrigger className={cn("h-9 text-sm", errors.task && 'border-destructive')}>
                <SelectValue placeholder={projectId ? 'เลือกงาน' : 'เลือกโปรเจกต์ก่อน'} />
              </SelectTrigger>
              <SelectContent>
                {filteredTasks.length === 0
                  ? <div className="px-3 py-2 text-sm text-muted-foreground">ไม่มีงานในโปรเจกต์นี้</div>
                  : filteredTasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)
                }
              </SelectContent>
            </Select>
            <FieldError message={errors.task} />
          </div>
        </div>

        {/* ชั่วโมง */}
        <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">ชั่วโมงทำงาน<Required /></Label>
            <button
              type="button"
              onClick={() => setUseTimePicker(!useTimePicker)}
              className={cn(
                'flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all shadow-sm',
                useTimePicker ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              <Clock className="h-3 w-3" />
              {useTimePicker ? 'สลับเป็นกรอกชั่วโมง' : 'ระบุเวลาเริ่ม-สิ้นสุด'}
            </button>
          </div>

          {useTimePicker ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">เวลาที่เริ่ม</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">เวลาที่เลิก</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-9 text-sm" />
              </div>
              {calcHours(startTime, endTime) !== null && (
                <div className="col-span-2 text-xs text-blue-600 font-medium bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 rounded border border-blue-100 dark:border-blue-900">
                  ระบบคำนวณให้: <strong>{calcHours(startTime, endTime)} ชั่วโมง</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                type="number"
                step="0.5" min="0.5" max="24"
                value={hours}
                onChange={e => { setHours(e.target.value); setErrors(err => ({ ...err, hours: undefined })); }}
                className={cn("h-10 text-lg font-bold text-center", errors.hours && 'border-destructive')}
                required
              />
              <div className="flex gap-1.5 mt-1.5 flex-wrap justify-center">
                {QUICK_HOURS.map(h => (
                  <button
                    key={h} type="button"
                    onClick={() => { setHours(h); setErrors(err => ({ ...err, hours: undefined })); }}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs border transition-all',
                      hours === h ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    )}
                  >{h} ชม.</button>
                ))}
              </div>
            </div>
          )}

          {/* show manual hours input if picker is active but user wants to override */}
          {useTimePicker && (
            <div className="pt-2 border-t border-dashed">
              <Label className="text-[11px] text-muted-foreground italic">ปรับแต่งจำนวนชั่วโมงเอง (ถ้าจำเป็น)</Label>
              <Input
                type="number" step="0.5" min="0.5" max="24"
                value={hours}
                onChange={e => { setHours(e.target.value); setErrors(err => ({ ...err, hours: undefined })); }}
                className={cn('h-8 text-xs mt-1 w-24', errors.hours && 'border-destructive')}
              />
            </div>
          )}
          <FieldError message={errors.hours} />
        </div>

        {/* รายละเอียด */}
        <div className="space-y-1.5">
          <Label className="text-sm">รายละเอียดงาน <span className="text-[11px] font-normal text-muted-foreground">(แนะนำให้ระบุ)</span></Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="เช่น แก้ไขบั๊กหน้า Login, ประชุมทีมประจำสัปดาห์..."
            rows={2}
            className="text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
            ยกเลิก
          </Button>
          <Button type="submit" className="px-8" disabled={createEntry.isPending || updateEntry.isPending}>
            {isEditMode
              ? (updateEntry.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข')
              : (createEntry.isPending ? 'กำลังบันทึก...' : 'บันทึกชั่วโมง')
            }
          </Button>
        </div>
      </form>
    </DialogContent>
  );

  if (hideTrigger) {
    return <Dialog open={isOpen} onOpenChange={(v) => { if (!v) resetForm(); setIsOpen(v); }}>{dialogContent}</Dialog>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(v) => { if (!v) resetForm(); setIsOpen(v); }}>
      <DialogTrigger asChild>
        <Button className={`gap-2 ${className || ''}`}>
          <Plus className="w-4 h-4" />{buttonLabel || 'บันทึกชั่วโมง'}
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
};

export default CreateTimesheetEntryDialog;
