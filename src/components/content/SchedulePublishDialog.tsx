import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { usePublishChannels, useScheduleContent, useSendNow } from '@/hooks/useContent';
import { useToast } from '@/hooks/use-toast';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { PLATFORM_MAP } from '@/components/content/types';

const ARTICLE_PLATFORMS = new Set(['wordpress', 'wix', 'custom', 'website']);
const SOCIAL_PLATFORMS  = new Set(['facebook', 'instagram', 'tiktok', 'lineoa', 'linkedin', 'twitter']);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentId: string;
  contentTitle: string;
  defaultCaption?: string;
  defaultBody?: string;
  mode?: 'schedule' | 'send_now';
}

export function SchedulePublishDialog({ open, onOpenChange, contentId, contentTitle, defaultCaption = '', defaultBody = '', mode = 'schedule' }: Props) {
  const { toast } = useToast();
  const { data: channels = [] } = usePublishChannels();
  const schedule = useScheduleContent();
  const sendNow = useSendNow();
  const isSendNow = mode === 'send_now';

  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [articleBody, setArticleBody] = useState('');
  const [socialCaption, setSocialCaption] = useState('');

  // Reset state every time dialog opens with new content
  useEffect(() => {
    if (open) {
      setSelectedChannels([]);
      setScheduleDate('');
      setScheduleTime('');
      setArticleBody(defaultBody);
      setSocialCaption(defaultCaption);
    }
  }, [open, contentId]);

  const activeChannels = (channels as any[]).filter((c: any) => c.is_active);

  const toggleChannel = (id: string) => {
    setSelectedChannels(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedChannelObjs = useMemo(
    () => activeChannels.filter((c: any) => selectedChannels.includes(c.id)),
    [activeChannels, selectedChannels]
  );

  const hasArticlePlatform = selectedChannelObjs.some((c: any) => ARTICLE_PLATFORMS.has(c.platform));
  const hasSocialPlatform  = selectedChannelObjs.some((c: any) => SOCIAL_PLATFORMS.has(c.platform));

  const buildOverrides = (): Record<string, string> => {
    const overrides: Record<string, string> = {};
    for (const ch of selectedChannelObjs) {
      if (ARTICLE_PLATFORMS.has(ch.platform) && articleBody.trim()) {
        overrides[ch.id] = articleBody.trim();
      } else if (SOCIAL_PLATFORMS.has(ch.platform) && socialCaption.trim()) {
        overrides[ch.id] = socialCaption.trim();
      }
    }
    return overrides;
  };

  const handleSubmit = async () => {
    if (selectedChannels.length === 0) {
      toast({ title: 'กรุณาเลือก channel อย่างน้อย 1 อัน', variant: 'destructive' });
      return;
    }
    const channel_overrides = buildOverrides();
    try {
      if (isSendNow) {
        await sendNow.mutateAsync({ content_id: contentId, channel_ids: selectedChannels, channel_overrides });
        toast({ title: 'ส่งสำเร็จ!' });
      } else {
        if (!scheduleDate || !scheduleTime) {
          toast({ title: 'กรุณาระบุวันที่และเวลา', variant: 'destructive' });
          return;
        }
        const scheduledAt = `${scheduleDate}T${scheduleTime}:00`;
        if (new Date(scheduledAt) <= new Date()) {
          toast({ title: 'เวลาที่ตั้งต้องอยู่ในอนาคต', variant: 'destructive' });
          return;
        }
        await schedule.mutateAsync({ content_id: contentId, channel_ids: selectedChannels, scheduled_at: scheduledAt, channel_overrides });
        toast({ title: 'ตั้งเวลาส่งแล้ว' });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const isPending = isSendNow ? sendNow.isPending : schedule.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{isSendNow ? 'ส่งเดี๋ยวนี้' : 'ตั้งเวลาโพสต์'}</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{contentTitle}</p>
        </DialogHeader>

        <div className="space-y-5">
          {/* Channel list */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">เลือก Channel (เลือกได้หลายอัน)</Label>
            {activeChannels.length === 0 && (
              <p className="text-xs text-muted-foreground">ยังไม่มี channel — ไปตั้งค่าใน Channel Management</p>
            )}
            <div className="rounded-md border divide-y">
              {activeChannels.map((ch: any) => (
                <label
                  key={ch.id}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${selectedChannels.includes(ch.id) ? 'bg-primary/5' : ''}`}
                >
                  <Checkbox
                    checked={selectedChannels.includes(ch.id)}
                    onCheckedChange={() => toggleChannel(ch.id)}
                  />
                  <PlatformIcon platform={ch.platform} size={14} />
                  <span className="text-sm flex-1">{ch.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(PLATFORM_MAP as any)[ch.platform]?.label ?? ch.platform}
                  </span>
                </label>
              ))}
            </div>
            {selectedChannels.length > 0 && (
              <p className="text-xs text-primary font-medium">เลือก {selectedChannels.length} channel</p>
            )}
          </div>

          {/* Per-platform content fields — shown only when relevant platform is selected */}
          {hasArticlePlatform && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                เนื้อหา
                <span className="ml-1.5 text-muted-foreground font-normal">
                  ({selectedChannelObjs.filter((c: any) => ARTICLE_PLATFORMS.has(c.platform)).map((c: any) => (PLATFORM_MAP as any)[c.platform]?.label ?? c.platform).join(', ')})
                </span>
              </Label>
              <Textarea
                value={articleBody}
                onChange={e => setArticleBody(e.target.value)}
                placeholder="เนื้อหาบทความ (ไม่กรอกจะใช้เนื้อหาเดิม)"
                rows={5}
                className="text-sm resize-none"
              />
            </div>
          )}

          {hasSocialPlatform && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Caption
                <span className="ml-1.5 text-muted-foreground font-normal">
                  ({selectedChannelObjs.filter((c: any) => SOCIAL_PLATFORMS.has(c.platform)).map((c: any) => (PLATFORM_MAP as any)[c.platform]?.label ?? c.platform).join(', ')})
                </span>
              </Label>
              <Textarea
                value={socialCaption}
                onChange={e => setSocialCaption(e.target.value)}
                placeholder="Caption สำหรับโพสต์ (ไม่กรอกจะใช้ caption เดิม)"
                rows={4}
                className="text-sm resize-none"
              />
            </div>
          )}

          {/* Date & Time — schedule mode only */}
          {!isSendNow && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sched-date" className="text-xs">วันที่</Label>
                <Input
                  id="sched-date"
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sched-time" className="text-xs">เวลา</Label>
                <Input
                  id="sched-time"
                  type="time"
                  value={scheduleTime}
                  onChange={e => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            {isSendNow ? 'ส่งเลย' : 'ตั้งเวลา'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
