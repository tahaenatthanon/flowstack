import { useEffect } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useSurveyResponses } from '@/hooks/useSurveys';

export function WbsSurveyPrompt({ opportunityId, onClose, onOpenWbs }: { opportunityId: string; onClose: () => void; onOpenWbs: () => void }) {
  const { data: responses = [], isLoading } = useSurveyResponses(opportunityId);

  const completed = responses.filter(r => r.status === 'completed');

  useEffect(() => {
    if (!isLoading && completed.length === 0) {
      onClose();
    }
  }, [isLoading, completed.length, onClose]);

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="w-full sm:max-w-sm">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (completed.length === 0) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>มีข้อมูล Survey พร้อมสร้าง Project</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          พบแบบสอบถามที่ตอบแล้ว {completed.length} รายการ ต้องการเปิด AI WBS Generator พร้อมข้อมูล Survey หรือไม่?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ไม่ใช่</Button>
          <Button onClick={onOpenWbs}>เปิด AI WBS</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
