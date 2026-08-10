// src/components/SendSurveyDialog.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Copy, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { APP_URL } from '@/lib/api';
import { useSurveyTemplates, useCreateSurveyResponse } from '@/hooks/useSurveys';
import { copyToClipboard } from '@/components/content/views/CopyButton';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  opportunityId: string;
  companyId: string;
  opportunityName: string;
}

export function SendSurveyDialog({ open, onOpenChange, opportunityId, companyId, opportunityName }: Props) {
  const { toast } = useToast();
  const { data: templates = [] } = useSurveyTemplates();
  const createResponse = useCreateSurveyResponse();
  const [templateId, setTemplateId] = useState('');
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!templateId) { toast({ title: 'กรุณาเลือก template', variant: 'destructive' }); return; }
    try {
      const result = await createResponse.mutateAsync({ template_id: templateId, opportunity_id: opportunityId, company_id: companyId });
      setPublicUrl(`${APP_URL}/#/survey/public/${result.token}`);
    } catch {
      toast({ title: 'ไม่สามารถสร้างลิงก์ได้ กรุณาลองใหม่', variant: 'destructive' });
    }
  }

  function handleCopy() {
    if (!publicUrl) return;
    copyToClipboard(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    if (createResponse.isPending) return;
    setTemplateId('');
    setPublicUrl(null);
    setCopied(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ส่ง Survey</DialogTitle>
          <p className="text-sm text-muted-foreground">{opportunityName}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>เลือก Template</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={!!publicUrl}>
              <SelectTrigger><SelectValue placeholder="เลือก template..." /></SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.is_global === 1 ? '🌐 ' : '👤 '}{t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {publicUrl ? (
            <div className="space-y-2">
              <Label>ลิงก์สำหรับลูกค้า</Label>
              <div className="flex gap-2">
                <Input value={publicUrl} readOnly className="text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">คัดลอกลิงก์นี้แล้วส่งให้ลูกค้าผ่าน email หรือ LINE</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>ปิด</Button>
          {!publicUrl && (
            <Button onClick={handleGenerate} disabled={!templateId || createResponse.isPending}>
              {createResponse.isPending ? 'กำลังสร้าง...' : 'สร้างลิงก์'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
