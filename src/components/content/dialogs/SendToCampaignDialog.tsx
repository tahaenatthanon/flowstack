import { Send, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import type { ContentItem } from '@/components/content/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentItem: ContentItem;
}

export default function SendToCampaignDialog({ open, onOpenChange, contentItem }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [campaignName, setCampaignName] = useState('');
  const [existingCampaignId, setExistingCampaignId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: campaigns = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['campaigns'],
    queryFn: () => apiFetch('/email-campaigns.php'),
    enabled: open,
  });

  const draftCampaigns = campaigns.filter((c: any) => c.status === 'draft');

  useEffect(() => {
    if (open) {
      setCampaignName('');
      setExistingCampaignId('');
      setMode('new');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await apiFetch('/content-to-campaign.php?action=to-campaign', {
        method: 'POST',
        body: JSON.stringify({
          content_item_id: contentItem.id,
          campaign_name: mode === 'new' ? campaignName : undefined,
          campaign_id: mode === 'existing' ? existingCampaignId : undefined,
        }),
      });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast({ title: mode === 'new' ? 'สร้างแคมเปญจากบทความแล้ว' : 'เพิ่มบทความในแคมเปญแล้ว' });
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />ส่งเข้า Email Campaign
          </DialogTitle>
          <DialogDescription>
            นำเนื้อหาบทความ "{contentItem.title}" ไปใช้ในแคมเปญอีเมล
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')} className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <RadioGroupItem value="new" id="mode-new" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="mode-new" className="font-medium">สร้างแคมเปญใหม่</Label>
              {mode === 'new' && (
                <Input value={campaignName} onChange={e => setCampaignName(e.target.value)}
                  placeholder="ชื่อแคมเปญ (ถ้าไม่ระบุใช้ชื่อบทความ)" />
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-4">
            <RadioGroupItem value="existing" id="mode-existing" />
            <div className="flex-1 space-y-2">
              <Label htmlFor="mode-existing" className="font-medium">เพิ่มในแคมเปญที่มีอยู่</Label>
              {mode === 'existing' && (
                <>
                  {isLoading ? (
                    <p className="text-xs text-muted-foreground py-2">กำลังโหลดแคมเปญ...</p>
                  ) : (
                    <Select value={existingCampaignId} onValueChange={setExistingCampaignId}>
                      <SelectTrigger><SelectValue placeholder="เลือกแคมเปญ (draft)" /></SelectTrigger>
                      <SelectContent>
                        {draftCampaigns.length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">ไม่มี draft campaign</div>
                        ) : (
                          draftCampaigns.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {!isLoading && draftCampaigns.length === 0 && (
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => refetch()}>
                      <RefreshCw className="h-3 w-3 mr-1" />โหลดใหม่
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </RadioGroup>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">เกิดข้อผิดพลาด</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs shrink-0 border-red-300 hover:bg-red-100 dark:border-red-700 dark:hover:bg-red-900/30"
              onClick={handleSubmit} disabled={saving}>
              <RefreshCw className="h-3 w-3" />ลองใหม่
            </Button>
          </div>
        )}

        <Button
          disabled={saving || (mode === 'existing' && !existingCampaignId)}
          onClick={handleSubmit}
          className="gap-2">
          <Send className="h-4 w-4" />
          {saving ? 'กำลังส่ง...' : 'ส่งเข้า Campaign'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
