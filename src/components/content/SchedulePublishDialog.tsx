import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { usePublishChannels, useScheduleContent, useSendNow } from '@/hooks/useContent';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { PLATFORM_MAP, getPublishDefaultText, SOCIAL_POST_PLATFORMS, type PostTextSource } from '@/components/content/types';

// ข้อความที่โพสต์แสดงแบบอ่านอย่างเดียว (platform-post-text) — แก้ได้ที่ "ข้อความโพสต์แต่ละ Platform"
// ใน ContentCardDialog เท่านั้น (ผ่านการอนุมัติก่อนโพสต์) หน้าต่างนี้ไม่ส่ง channel_overrides แล้ว
const SOCIAL_PLATFORMS = new Set(SOCIAL_POST_PLATFORMS);
const SOURCE_LABEL: Record<PostTextSource, string> = {
  script: 'จากข้อความโพสต์ของ platform นี้',
  caption: 'จากข้อความโพสต์สำรอง',
  article: 'จากเนื้อหาบทความ (แปลงเป็นข้อความ)',
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentId: string;
  contentTitle: string;
  defaultCaption?: string;
  /** @deprecated หน้าต่างนี้ไม่แก้เนื้อหาบทความแล้ว — คงไว้ให้ผู้เรียกเดิมไม่ต้องแก้ */
  defaultBody?: string;
  scripts?: Record<string, string | undefined>;
  mode?: 'schedule' | 'send_now';
}

export function SchedulePublishDialog({ open, onOpenChange, contentId, contentTitle, defaultCaption = '', scripts, mode = 'schedule' }: Props) {
  const { toast } = useToast();
  const { data: channels = [] } = usePublishChannels();
  const schedule = useScheduleContent();
  const sendNow = useSendNow();
  const isSendNow = mode === 'send_now';

  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [platformStatus, setPlatformStatus] = useState<Record<string, { published: boolean; pending: boolean }>>({});

  const activeChannels = (channels as any[]).filter((c: any) => c.is_active);

  // Reset state every time dialog opens with new content
  useEffect(() => {
    if (open) {
      setSelectedChannels([]);
      setScheduleDate('');
      setScheduleTime('');
      setPlatformStatus({});
      apiFetch(`/content-publish.php?action=platform_status&content_id=${encodeURIComponent(contentId)}`)
        .then((res: any) => setPlatformStatus(res?.platforms ?? {}))
        .catch(() => setPlatformStatus({}));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contentId]);

  const toggleChannel = (id: string) => {
    const channel = activeChannels.find((c: any) => c.id === id);
    const platform = String(channel?.platform ?? '').toLowerCase();
    const state = platformStatus[platform];
    if (state?.published || state?.pending) return;
    setSelectedChannels(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      const samePlatformSelected = prev.some(selectedId => {
        const selected = activeChannels.find((c: any) => c.id === selectedId);
        return String(selected?.platform ?? '').toLowerCase() === platform;
      });
      return samePlatformSelected ? prev : [...prev, id];
    });
  };

  const selectedChannelObjs = useMemo(
    () => activeChannels.filter((c: any) => selectedChannels.includes(c.id)),
    [activeChannels, selectedChannels]
  );

  const platformOf = (c: any) => String(c.platform ?? '').toLowerCase();
  const selectedSocialPlatforms = Array.from(new Set(selectedChannelObjs.map(platformOf).filter(p => SOCIAL_PLATFORMS.has(p))));
  const selectedWebChannels = selectedChannelObjs.filter((c: any) => !SOCIAL_PLATFORMS.has(platformOf(c)));

  const handleSubmit = async () => {
    if (selectedChannels.length === 0) {
      toast({ title: 'กรุณาเลือก channel อย่างน้อย 1 อัน', variant: 'destructive' });
      return;
    }
    try {
      if (isSendNow) {
        // API คืน HTTP 200 พร้อมผลรายช่องทาง — ต้องอ่าน results[] ไม่ใช่ถือว่าสำเร็จทั้งก้อน
        const res = await sendNow.mutateAsync({ content_id: contentId, channel_ids: selectedChannels });
        const rows = res?.results ?? [];
        const ok      = rows.filter(r => r.status === 'success');
        const skipped = rows.filter(r => r.status === 'skipped');
        const blocked = rows.filter(r => r.status === 'blocked');
        const failed  = rows.filter(r => r.status === 'failed');

        // ไม่มีช่องใดสำเร็จและมีช่องล้มเหลว → แจ้งล้มเหลวและคง dialog ไว้ให้ลองใหม่
        // (backend ส่งเหตุผลมาเป็นคีย์ `reason` เดียวเสมอ ไม่มีคีย์ `error` แยก)
        if (ok.length === 0 && failed.length > 0) {
          toast({
            title: 'ส่งไม่สำเร็จ',
            description: failed[0].reason || `ล้มเหลว ${failed.length} channel`,
            variant: 'destructive',
          });
          return;
        }
        // ถูกเกตปฏิเสธก่อนเผยแพร่ (approval/quality/SEO gate ฯลฯ) — ไม่มี request ออกไปยัง
        // ปลายทางเลย ต่างจาก failed ที่ยิงปลายทางแล้วแต่ไม่สำเร็จ ต้องแสดงเหตุผลจริงจาก backend
        // ไม่ใช่ข้อความทั่วไป ไม่งั้นผู้ใช้ไม่รู้ว่าต้องแก้อะไรก่อนถึงจะส่งได้
        if (ok.length === 0 && blocked.length > 0) {
          toast({
            title: 'ถูกบล็อกก่อนเผยแพร่',
            description: blocked[0].reason || `${blocked.length} ช่องทางถูกบล็อกโดยเงื่อนไขเผยแพร่`,
            variant: 'destructive',
          });
          return;
        }
        if (ok.length === 0 && skipped.length > 0) {
          // ถูกข้ามทั้งหมดจาก idempotency guard — ไม่ใช่สำเร็จ และไม่ใช่ล้มเหลว
          toast({
            title: 'ข้ามการส่ง',
            description: skipped[0].reason || 'เพิ่งส่งช่องทางนี้ไปแล้ว',
          });
        } else if (ok.length === 0) {
          toast({ title: 'ไม่มีช่องทางที่ถูกส่ง', variant: 'destructive' });
          return;
        } else {
          const parts = [`สำเร็จ ${ok.length}`];
          if (skipped.length) parts.push(`ข้าม ${skipped.length}`);
          if (blocked.length) parts.push(`ถูกบล็อก ${blocked.length}`);
          if (failed.length)  parts.push(`ล้มเหลว ${failed.length}`);
          toast({
            title: (failed.length || blocked.length) ? 'ส่งบางส่วนไม่สำเร็จ' : 'ส่งสำเร็จ!',
            description: parts.length > 1 ? parts.join(' · ') : undefined,
            variant: (failed.length || blocked.length) ? 'destructive' : undefined,
          });
        }
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
        await schedule.mutateAsync({ content_id: contentId, channel_ids: selectedChannels, scheduled_at: scheduledAt });
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
      <DialogContent className="w-full sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base">{isSendNow ? 'ส่งเดี๋ยวนี้' : 'ตั้งเวลาโพสต์'}</DialogTitle>
          <p className="text-xs text-muted-foreground truncate">{contentTitle}</p>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
          {/* Channel list */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">เลือก Channel (เลือกได้หลายอัน)</Label>
            {activeChannels.length === 0 && (
              <p className="text-xs text-muted-foreground">ยังไม่มี channel — ไปตั้งค่าใน Channel Management</p>
            )}
            <div className="rounded-md border divide-y">
              {activeChannels.map((ch: any) => {
                const platform = String(ch.platform ?? '').toLowerCase();
                const state = platformStatus[platform];
                const samePlatformSelected = selectedChannels.some(selectedId => {
                      const selected = activeChannels.find((c: any) => c.id === selectedId);
                      return selectedId !== ch.id && String(selected?.platform ?? '').toLowerCase() === platform;
                    });
                    const locked = !!state?.published || !!state?.pending || samePlatformSelected;
                return (
                  <label
                    key={ch.id}
                    className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors ${locked ? 'opacity-60 cursor-not-allowed bg-muted/20' : 'cursor-pointer hover:bg-muted/50'} ${selectedChannels.includes(ch.id) ? 'bg-primary/5' : ''}`}
                  >
                    <Checkbox
                      checked={selectedChannels.includes(ch.id)}
                      disabled={locked}
                      onCheckedChange={() => toggleChannel(ch.id)}
                    />
                    <PlatformIcon platform={ch.platform} size={14} />
                    <span className="text-sm flex-1">{ch.name}</span>
                    {state?.published ? (
                      <span className="text-xs font-medium text-green-600">เผยแพร่แล้ว</span>
                    ) : state?.pending ? (
                      <span className="text-xs font-medium text-amber-600">รอดำเนินการ</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{(PLATFORM_MAP as any)[ch.platform]?.label ?? ch.platform}</span>
                    )}
                  </label>
                );
              })}
            </div>
            {selectedChannels.length > 0 && (
              <p className="text-xs text-primary font-medium">เลือก {selectedChannels.length} channel</p>
            )}
            {Object.values(platformStatus).some(s => s.published) && (
              <p className="text-xs text-muted-foreground">แพลตฟอร์มที่เผยแพร่แล้วจะถูกล็อก แต่แพลตฟอร์มอื่นยังสามารถเผยแพร่ต่อได้</p>
            )}
          </div>

          {/* ตัวอย่างข้อความที่จะโพสต์ต่อ platform — อ่านอย่างเดียว (platform-post-text) */}
          {selectedWebChannels.length > 0 && (
            <div className="space-y-1.5" data-testid="publish-preview-web">
              <Label className="text-xs font-medium">
                เนื้อหา
                <span className="ml-1.5 text-muted-foreground font-normal">
                  ({selectedWebChannels.map((c: any) => (PLATFORM_MAP as any)[c.platform]?.label ?? c.platform).join(', ')})
                </span>
              </Label>
              <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">จะโพสต์เนื้อหาบทความของคอนเทนต์นี้</p>
            </div>
          )}

          {selectedSocialPlatforms.length > 0 && (
            <div className="space-y-3">
              {selectedSocialPlatforms.map(platform => {
                const { text, source } = getPublishDefaultText(scripts, platform, defaultCaption);
                return (
                  <div key={platform} className="space-y-1.5" data-testid={`publish-preview-${platform}`}>
                    <Label className="text-xs font-medium">
                      ข้อความโพสต์
                      <span className="ml-1.5 text-muted-foreground font-normal">
                        ({(PLATFORM_MAP as any)[platform]?.label ?? platform})
                      </span>
                    </Label>
                    <div className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
                      {contentTitle && <p className="font-semibold mb-2">{contentTitle}</p>}
                      {text || <span className="text-muted-foreground">เนื้อหาบทความ (แปลงเป็นข้อความตอนโพสต์)</span>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{SOURCE_LABEL[source]}</p>
                  </div>
                );
              })}
            </div>
          )}

          {selectedChannelObjs.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              ต้องการแก้ข้อความ? แก้ที่ "ข้อความโพสต์แต่ละ Platform" ในหน้าแก้ไขคอนเทนต์ (ต้องขออนุมัติใหม่)
            </p>
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
