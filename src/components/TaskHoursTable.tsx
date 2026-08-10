import { DbTaskHoursEntry } from '@/types/project';
import { format, parseISO, isValid } from 'date-fns';
import { th } from 'date-fns/locale';
import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDeleteTaskHoursEntry, useUpdateTaskHoursEntry } from '@/hooks/useProjectData';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';

interface TimesheetTableProps {
  entries: DbTaskHoursEntry[];
  tasks: { id: string; title: string }[];
  projectId: string;
}

const TaskHoursTable = ({ entries, tasks, projectId }: TimesheetTableProps) => {
  const totalHours = entries.reduce((sum, e) => sum + Number(e.hours_worked), 0);
  const updateEntry = useUpdateTaskHoursEntry();
  const deleteEntry = useDeleteTaskHoursEntry();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DbTaskHoursEntry | null>(null);
  const [taskId, setTaskId] = useState('');
  const [date, setDate] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open || !editing) return;
    setTaskId(editing.task_id);
    setDate(editing.date);
    setHours(String(editing.hours_worked));
    setDescription(editing.description || '');
  }, [open, editing]);

  const handleEdit = (entry: DbTaskHoursEntry) => {
    setEditing(entry);
    setOpen(true);
  };

  const handleDelete = async (entry: DbTaskHoursEntry) => {
    if (!await confirm({ title: 'ลบบันทึกชั่วโมง', description: 'ต้องการลบรายการ บันทึกชั่วโมง นี้?', variant: 'destructive' })) return;
    try {
      await deleteEntry.mutateAsync({ id: entry.id, projectId });
      toast({ title: 'ลบรายการแล้ว' });
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await updateEntry.mutateAsync({
        id: editing.id,
        projectId,
        task_id: taskId,
        date,
        hours_worked: parseFloat(hours),
        description,
      });
      toast({ title: 'แก้ไขบันทึกชั่วโมง สำเร็จ' });
      setOpen(false);
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="bg-card rounded-xl border p-3 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold font-heading">บันทึกชั่วโมง</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          รวม {totalHours} ชั่วโมง
        </div>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">ไม่มีข้อมูล บันทึกชั่วโมง</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-1.5 sm:py-3 sm:px-2 font-medium text-muted-foreground text-xs sm:text-sm">วันที่</th>
                <th className="text-left py-2 px-1.5 sm:py-3 sm:px-2 font-medium text-muted-foreground text-xs sm:text-sm">งาน</th>
                <th className="text-left py-2 px-1.5 sm:py-3 sm:px-2 font-medium text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">รายละเอียด</th>
                <th className="text-right py-2 px-1.5 sm:py-3 sm:px-2 font-medium text-muted-foreground text-xs sm:text-sm">ชม.</th>
                <th className="text-right py-2 px-1.5 sm:py-3 sm:px-2 font-medium text-muted-foreground text-xs sm:text-sm">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-1.5 sm:py-3 sm:px-2 whitespace-nowrap text-xs sm:text-sm">
                    {isValid(parseISO(entry.date)) ? format(parseISO(entry.date), 'd MMM', { locale: th }) : entry.date}
                  </td>
                  <td className="py-2 px-1.5 sm:py-3 sm:px-2 font-medium text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{entry.task_title || '-'}</td>
                  <td className="py-2 px-1.5 sm:py-3 sm:px-2 text-muted-foreground text-xs sm:text-sm hidden sm:table-cell">{entry.description}</td>
                  <td className="py-2 px-1.5 sm:py-3 sm:px-2 text-right font-medium text-xs sm:text-sm">{entry.hours_worked}</td>
                  <td className="py-2 px-1.5 sm:py-3 sm:px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Dialog open={open && editing?.id === entry.id} onOpenChange={(next) => {
                        if (!next) {
                          setOpen(false);
                          setEditing(null);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(entry)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-heading">แก้ไขบันทึกชั่วโมง</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                              <Label>งาน</Label>
                              <Select value={taskId} onValueChange={setTaskId}>
                                <SelectTrigger><SelectValue placeholder="เลือกงาน" /></SelectTrigger>
                                <SelectContent>
                                  {tasks.length === 0 ? (
                                    <SelectItem value="empty" disabled>
                                      ไม่พบงาน
                                    </SelectItem>
                                  ) : (
                                    tasks.map((t) => (
                                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>วันที่</Label>
                                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                              </div>
                              <div>
                                <Label>จำนวนชั่วโมง</Label>
                                <Input type="number" step="0.5" min="0.5" max="24" value={hours} onChange={(e) => setHours(e.target.value)} required />
                              </div>
                            </div>
                            <div>
                              <Label>รายละเอียด</Label>
                              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="สิ่งที่ทำ" required />
                            </div>
                            <Button type="submit" className="w-full" disabled={updateEntry.isPending || !taskId}>
                              {updateEntry.isPending ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(entry)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TaskHoursTable;
