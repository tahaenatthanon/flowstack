import { useEffect, useState } from 'react';
import { DbTask } from '@/types/project';
import { useUpdateTask, useDeleteTask, useUsers } from '@/hooks/useProjectData';
import UserCombobox from '@/components/UserCombobox';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { addDays, differenceInDays, format, parseISO } from 'date-fns';

interface TaskRowActionsProps {
  task: DbTask;
  onAddSubtask?: (task: DbTask) => void;
}

const TaskRowActions = ({ task, onAddSubtask }: TaskRowActionsProps) => {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [assignee, setAssignee] = useState<string | undefined>(task.assignee_user_id || undefined);
  const [startDate, setStartDate] = useState(task.start_date || format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(task.end_date || format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [isAdHoc, setIsAdHoc] = useState(!!task.is_ad_hoc);

  useEffect(() => {
    if (!open) return;
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority || 'medium');
    setAssignee(task.assignee_user_id || undefined);
    setStartDate(task.start_date || format(new Date(), 'yyyy-MM-dd'));
    setEndDate(task.end_date || format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setIsAdHoc(!!task.is_ad_hoc);
  }, [open, task]);

  const estimatedDays = Math.max(1, differenceInDays(parseISO(endDate), parseISO(startDate)));

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        project_id: task.project_id,
        status: newStatus,
        completed_date: newStatus === 'completed' ? new Date().toISOString().split('T')[0] : (newStatus === 'cancelled' ? null : task.completed_date),
      });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!await confirm({ title: 'ลบงาน', description: 'ต้องการลบงานนี้?', variant: 'destructive' })) return;
    try {
      await deleteTask.mutateAsync({ id: task.id, projectId: task.project_id });
      toast({ title: 'ลบงานแล้ว' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateTask.mutateAsync({
        id: task.id,
        project_id: task.project_id,
        title,
        description,
        priority,
        assignee: (!assignee || assignee === 'none') ? '' : (users.find(u => u.id === assignee)?.display_name || ''),
        assignee_user_id: (!assignee || assignee === 'none') ? null : assignee,
        start_date: startDate,
        end_date: endDate,
        estimated_days: estimatedDays,
        is_ad_hoc: isAdHoc,
      });
      toast({ title: 'แก้ไขงานสำเร็จ' });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
      <Select value={task.status} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-[100px] sm:w-[130px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">รอดำเนินการ</SelectItem>
          <SelectItem value="in-progress">กำลังทำ</SelectItem>
          <SelectItem value="completed">เสร็จแล้ว</SelectItem>
          <SelectItem value="overdue">เลยกำหนด</SelectItem>
          <SelectItem value="cancelled">ยกเลิก</SelectItem>
        </SelectContent>
      </Select>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">แก้ไขงาน</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>ชื่องาน</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ผู้รับผิดชอบ</Label>
                <UserCombobox
                  value={assignee || ''}
                  onChange={(id) => setAssignee(id === 'none' ? undefined : id)}
                  placeholder="เลือกผู้รับผิดชอบ"
                  allowNone={true}
                />
              </div>
              <div>
                <Label>ความสำคัญ</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">สูง</SelectItem>
                    <SelectItem value="medium">ปานกลาง</SelectItem>
                    <SelectItem value="low">ต่ำ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>วันเริ่ม</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div>
                <Label>วันสิ้นสุด</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">ระยะเวลาโดยประมาณ: {estimatedDays} วัน</p>
            <div className="flex items-center gap-2">
              <Checkbox id={`adhoc-${task.id}`} checked={isAdHoc} onCheckedChange={(v) => setIsAdHoc(!!v)} />
              <Label htmlFor={`adhoc-${task.id}`} className="text-sm">งานแทรก (Ad-hoc)</Label>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" size="sm" className="flex-1" disabled={updateTask.isPending}>
                {updateTask.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {onAddSubtask && (
        <Button variant="ghost" size="icon" className="h-8 w-8" title="เพิ่มงานย่อย" onClick={() => onAddSubtask(task)}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
};

export default TaskRowActions;
