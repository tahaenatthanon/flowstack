import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTimesheetEntry } from '@/hooks/useProjectData';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

interface CreateTimesheetDialogProps {
  projectId: string;
  tasks: { id: string; title: string }[];
}

const CreateTimesheetDialog = ({ projectId, tasks }: CreateTimesheetDialogProps) => {
  const [open, setOpen] = useState(false);
  const [taskId, setTaskId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [hours, setHours] = useState('8');
  const [description, setDescription] = useState('');
  const createEntry = useCreateTimesheetEntry();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEntry.mutateAsync({
        task_id: taskId,
        date,
        hours_worked: parseFloat(hours),
        description,
        projectId,
      });
      toast({ title: 'บันทึกชั่วโมงสำเร็จ' });
      setOpen(false);
      setDescription('');
    } catch (err: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setTaskId(''); setDate(format(new Date(), 'yyyy-MM-dd')); setHours('8'); setDescription(''); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          บันทึกชั่วโมงงาน
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">บันทึกชั่วโมงงาน (Subtask)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>งาน</Label>
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger><SelectValue placeholder="เลือกงาน" /></SelectTrigger>
              <SelectContent>
                {tasks.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
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
          <Button type="submit" className="w-full" disabled={createEntry.isPending || !taskId}>
            {createEntry.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTimesheetDialog;
