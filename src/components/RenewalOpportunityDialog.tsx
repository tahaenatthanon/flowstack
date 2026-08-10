import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { format, addDays } from 'date-fns';

interface SourceOpp {
  id: string;
  name: string;
  company_id: string;
  company_name?: string;
  value?: number;
  assigned_to?: string;
}

interface Props {
  source: SourceOpp;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

export default function RenewalOpportunityDialog({ source, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [name, setName]           = useState(`[Renewal] ${source.name}`);
  const [value, setValue]         = useState(String(source.value ?? 0));
  const [closeDate, setCloseDate] = useState(format(addDays(new Date(), 90), 'yyyy-MM-dd'));

  const mut = useMutation({
    mutationFn: () => apiFetch('/opportunities.php', {
      method: 'POST',
      body: JSON.stringify({
        company_id:          source.company_id,
        assigned_to:         source.assigned_to ?? '',
        renewal_of:          source.id,
        name:                name.trim(),
        stage:               'lead',
        value:               parseFloat(value) || 0,
        probability:         50,
        expected_close_date: closeDate,
        lead_source:         'renewal',
      }),
    }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      qc.invalidateQueries({ queryKey: ['journey-analytics'] });
      toast({ title: `สร้าง Renewal "${d.name}" สำเร็จ` });
      onCreated?.(d.id);
      onClose();
    },
    onError: (e: Error) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open onOpenChange={open => { if (!open && mut.isPending) return; if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-violet-500" />
            สร้าง Renewal / Upsell
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-md bg-muted/50 border p-2.5 text-xs space-y-1">
            <div className="font-medium text-muted-foreground">Deal ต้นฉบับ</div>
            <div className="font-medium">{source.name}</div>
            {source.company_name && <div className="text-muted-foreground">{source.company_name}</div>}
            <Badge variant="outline" className="text-[10px]">renewal_of: {source.id.slice(0, 8)}…</Badge>
          </div>

          <div>
            <Label>ชื่อ Deal ใหม่ <span className="text-destructive">*</span></Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>มูลค่า (บาท)</Label>
              <Input className="mt-1" type="number" min="0" value={value} onChange={e => setValue(e.target.value)} />
            </div>
            <div>
              <Label>Expected Close</Label>
              <Input className="mt-1" type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button disabled={!name.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            สร้าง Renewal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
