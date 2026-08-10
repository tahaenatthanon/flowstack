import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateTimesheetEntry, useTasks } from '@/hooks/useProjectData';
import ProjectCombobox from '@/components/ProjectCombobox';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';

interface EditTimesheetEntryDialogProps {
  entry: any;
  onSuccess?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const WORK_TYPE_OPTIONS = [
  { value: 'work',    label: 'งานปกติ' },
  { value: 'meeting', label: 'ประชุม' },
  { value: 'ot',      label: 'งานล่วงเวลา (OT)' },
  { value: 'onsite',  label: 'งานลูกค้า (Onsite)' },
];

const EditTimesheetEntryDialog = ({ entry, onSuccess, open: externalOpen, onOpenChange: externalOnOpenChange }: EditTimesheetEntryDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Default values when entry is null
  const defaultEntry = entry || {};
  
  const [workType, setWorkType]   = useState(defaultEntry.work_type   || 'work');
  const [projectId, setProjectId] = useState(defaultEntry.project_id  || '');
  const [taskId, setTaskId]       = useState(defaultEntry.task_id     || '');
  const [date, setDate]           = useState(defaultEntry.date        || '');
  const [hours, setHours]         = useState(String(defaultEntry.hours_worked ?? '8'));
  const [description, setDescription] = useState(defaultEntry.description || '');

  // Use external props if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange !== undefined ? externalOnOpenChange : setInternalOpen;

  const updateEntry = useUpdateTimesheetEntry();
  const { data: tasks = [] }    = useTasks(projectId || undefined);
  const { toast } = useToast();

  // Re-sync from entry each time dialog opens
  useEffect(() => {
    if (open && entry) {
      setWorkType(entry.work_type   || 'work');
      setProjectId(entry.project_id || '');
      setTaskId(entry.task_id       || '');
      setDate(entry.date            || '');
      setHours(String(entry.hours_worked ?? '8'));
      setDescription(entry.description  || '');
    }
  }, [open, entry]);

  const filteredTasks = projectId
    ? (tasks as any[]).filter((t) => t.project_id === projectId)
    : (tasks as any[]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId) {
      toast({ title: 'กรุณาเลือกงาน', variant: 'destructive' });
      return;
    }
    try {
      await updateEntry.mutateAsync({
        id:           entry.id,
        task_id:      taskId,
        date,
        hours_worked: parseFloat(hours),
        description,
        projectId:    projectId,
        work_type:    workType,
      });
      toast({ title: 'แก้ไข Timesheet สำเร็จ' });
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">แก้ไข Timesheet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* 1. ประเภทงาน */}
          <div>
            <Label>ประเภทงาน</Label>
            <Select value={workType} onValueChange={setWorkType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WORK_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 2. โปรเจกต์ */}
          <div>
            <Label>โปรเจกต์</Label>
            <ProjectCombobox
              value={projectId}
              onChange={(id) => { setProjectId(id); setTaskId(''); }}
              placeholder="เลือกโปรเจกต์"
              allowNone={false}
              includeBaseCalendar={true}
            />
          </div>

          {/* 3. งาน */}
          <div>
            <Label>งาน</Label>
            <Select
              value={taskId}
              onValueChange={setTaskId}
              disabled={!projectId}
            >
              <SelectTrigger>
                <SelectValue placeholder={projectId ? 'เลือกงาน' : 'เลือกโปรเจกต์ก่อน'} />
              </SelectTrigger>
              <SelectContent>
                {filteredTasks.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 4. วันที่ + ชั่วโมง */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>วันที่</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <Label>จำนวนชั่วโมง</Label>
              <Input
                type="number" step="0.5" min="0.5" max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 5. รายละเอียด */}
          <div>
            <Label>รายละเอียด</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="สิ่งที่ทำ"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={updateEntry.isPending || !taskId}
          >
            {updateEntry.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTimesheetEntryDialog;
