import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Info } from 'lucide-react';

interface EventFormData {
  title: string;
  event_type: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  description: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate?: string;
}

function makeDefaultForm(date?: string, isAdmin?: boolean): EventFormData {
  const today = date || new Date().toISOString().split('T')[0];
  return {
    title: '',
    event_type: isAdmin ? 'holiday' : 'other',
    start_at: today + 'T09:00',
    end_at: today + 'T10:00',
    all_day: true,
    description: '',
  };
}

export default function CreateCalendarEventDialog({ open, onOpenChange, defaultDate }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = user?.is_admin === 1;

  const [form, setForm] = useState<EventFormData>(() => makeDefaultForm(defaultDate, isAdmin));

  useEffect(() => {
    if (open) setForm(makeDefaultForm(defaultDate, isAdmin));
  }, [open, defaultDate, isAdmin]);

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      const body: Record<string, unknown> = {
        title: data.title,
        event_type: data.event_type,
        start_at: data.all_day
          ? data.start_at.split('T')[0] + ' 00:00:00'
          : data.start_at.replace('T', ' ') + ':00',
        end_at: data.all_day
          ? data.end_at.split('T')[0] + ' 23:59:59'
          : data.end_at.replace('T', ' ') + ':00',
        all_day: data.all_day ? 1 : 0,
        description: data.description,
      };
      return apiFetch('/calendar.php', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-all'] });
      onOpenChange(false);
      toast({ title: 'สำเร็จ', description: form.event_type === 'holiday' ? 'เพิ่มวันหยุดเรียบร้อยแล้ว' : 'เพิ่มกิจกรรมเรียบร้อยแล้ว' });
    },
    onError: (err: any) => {
      toast({ title: 'เกิดข้อผิดพลาด', description: err.message, variant: 'destructive' });
    },
  });

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast({ title: 'กรุณาระบุชื่อ', variant: 'destructive' });
      return;
    }
    createMutation.mutate(form);
  };

  // Only admin can create holidays; everyone can create "other"
  const allowedTypes = isAdmin
    ? [{ key: 'holiday', label: 'วันหยุดบริษัท' }, { key: 'other', label: 'กิจกรรมอื่นๆ' }]
    : [{ key: 'other', label: 'กิจกรรมอื่นๆ' }];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isAdmin ? 'วันหยุดบริษัท / กิจกรรม' : 'กิจกรรมอื่นๆ'}</DialogTitle>
          <div className="flex items-start gap-1.5 mt-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              {isAdmin
                ? 'สำหรับวันหยุดบริษัทและกิจกรรมที่ไม่นับชั่วโมง — ประชุม / ลา / งานให้บันทึกใน ปฏิทินทีม (งาน)'
                : 'สำหรับกิจกรรมที่ไม่นับชั่วโมง — ประชุม / ลา / งานให้บันทึกใน ปฏิทินทีม (งาน)'}
            </p>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>ชื่อ *</Label>
            <Input
              placeholder={isAdmin ? 'เช่น วันสงกรานต์, วันหยุดพิเศษ' : 'เช่น กิจกรรมทีม, งานเลี้ยง'}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          {isAdmin && (
            <div className="space-y-1.5">
              <Label>ประเภท</Label>
              <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedTypes.map(t => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              id="cal-all-day"
              checked={form.all_day}
              onCheckedChange={v => setForm(f => ({ ...f, all_day: v }))}
            />
            <Label htmlFor="cal-all-day">ทั้งวัน</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>เริ่มต้น</Label>
              <Input
                type={form.all_day ? 'date' : 'datetime-local'}
                value={form.all_day ? form.start_at.split('T')[0] : form.start_at}
                onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>สิ้นสุด</Label>
              <Input
                type={form.all_day ? 'date' : 'datetime-local'}
                value={form.all_day ? form.end_at.split('T')[0] : form.end_at}
                onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>หมายเหตุ</Label>
            <Textarea
              placeholder="รายละเอียดเพิ่มเติม..."
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
