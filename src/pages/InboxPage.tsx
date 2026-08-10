import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Mail, MailOpen, RefreshCw, Trash2, Star, StarOff, PenSquare, CheckCheck } from 'lucide-react';
import {
  useInbox, useMarkAsRead, useMarkAllAsRead, useDeleteMessage, useToggleStar,
  useInboxUsers, useSendMessage, type InboxMessage,
} from '@/hooks/useProjectData';
import { safeFmt } from '@/lib/dateUtils';
import PageShell from '@/components/PageShell';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ticket:       { label: 'Ticket',    color: 'bg-blue-100 text-blue-700' },
  message:      { label: 'ข้อความ',  color: 'bg-green-100 text-green-700' },
  notification: { label: 'แจ้งเตือน', color: 'bg-amber-100 text-amber-700' },
  email:        { label: 'อีเมล',    color: 'bg-purple-100 text-purple-700' },
};

const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
  low:      { label: 'ต่ำ',      color: 'bg-gray-100 text-gray-600' },
  medium:   { label: 'ปานกลาง', color: 'bg-yellow-100 text-yellow-700' },
  high:     { label: 'สูง',      color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'วิกฤต',   color: 'bg-red-100 text-red-700' },
};

const inboxFmt = (s?: string) => safeFmt(s, 'd MMM yyyy HH:mm');

type FilterTab = 'all' | 'unread' | 'starred';

// ── Compose Dialog ────────────────────────────────────────────────────────────
function ComposeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: users = [] } = useInboxUsers();
  const send = useSendMessage();
  const { toast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState('medium');

  const handleSend = async () => {
    if (!recipient || !subject.trim()) {
      toast({ title: 'กรุณาเลือกผู้รับและระบุหัวข้อ', variant: 'destructive' });
      return;
    }
    try {
      await send.mutateAsync({ recipient_user_id: recipient, subject: subject.trim(), preview: body.trim(), priority });
      toast({ title: 'ส่งข้อความสำเร็จ' });
      setRecipient(''); setSubject(''); setBody(''); setPriority('medium');
      onClose();
    } catch (e: any) {
      toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-lg">
        <DialogHeader><DialogTitle>เขียนข้อความใหม่</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>ถึง</Label>
            <Select value={recipient} onValueChange={setRecipient}>
              <SelectTrigger><SelectValue placeholder="เลือกผู้รับ..." /></SelectTrigger>
              <SelectContent>
                {(Array.isArray(users) ? users : []).map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name} {u.position ? `(${u.position})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>หัวข้อ</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="หัวข้อข้อความ..." />
          </div>
          <div className="space-y-1">
            <Label>ความสำคัญ</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">ต่ำ</SelectItem>
                <SelectItem value="medium">ปานกลาง</SelectItem>
                <SelectItem value="high">สูง</SelectItem>
                <SelectItem value="critical">วิกฤต</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>เนื้อหา</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="พิมพ์ข้อความ..." rows={5} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleSend} disabled={send.isPending}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            ส่งข้อความ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InboxPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const { data: messages = [], isLoading, refetch } = useInbox();
  const markAsRead    = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const deleteMessage = useDeleteMessage();
  const toggleStar    = useToggleStar();

  const [selectedItem, setSelectedItem] = useState<InboxMessage | null>(null);
  const [filter, setFilter]             = useState<FilterTab>('all');
  const [composeOpen, setComposeOpen]   = useState(false);

  const msgs = (messages as InboxMessage[]);
  const unreadCount = msgs.filter((m) => !m.is_read).length;

  const filtered = msgs.filter((m) => {
    if (filter === 'unread')  return !m.is_read;
    if (filter === 'starred') return !!m.is_starred;
    return true;
  });

  const handleSelect = async (item: InboxMessage) => {
    setSelectedItem(item);
    if (!item.is_read) {
      try { await markAsRead.mutateAsync(item.id); } catch { /* ignore */ }
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const ok = await confirm({ title: 'ลบข้อความ', description: 'ลบข้อความนี้?', variant: 'destructive' });
    if (!ok) return;
    try {
      await deleteMessage.mutateAsync(id);
      if (selectedItem?.id === id) setSelectedItem(null);
      toast({ title: 'ลบสำเร็จ' });
    } catch (e: any) {
      toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead.mutateAsync();
      toast({ title: 'ทำเครื่องหมายอ่านทั้งหมดแล้ว' });
    } catch (e: any) {
      toast({ title: 'ผิดพลาด', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <PageShell
      breadcrumbs={[{ label: 'กล่องข้อความ', isCurrent: true }]}
      title="กล่องข้อความ"
      actions={
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={markAllAsRead.isPending}>
              <CheckCheck className="h-4 w-4 mr-1" />
              อ่านทั้งหมด
            </Button>
          )}
          <Button size="sm" onClick={() => setComposeOpen(true)}>
            <PenSquare className="h-4 w-4 mr-1" />
            เขียนข้อความ
          </Button>
          <Button variant="outline" size="icon" onClick={() => { refetch(); fetch(getApiUrl('/notification-dispatch.php?secret=flowstack-cron-2026')).catch(() => {}); }} title="รีเฟรชและดึงการแจ้งเตือน" disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ทั้งหมด</CardDescription>
            <CardTitle className="text-2xl">{msgs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ยังไม่ได้อ่าน</CardDescription>
            <CardTitle className="text-2xl text-primary">{unreadCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ticket</CardDescription>
            <CardTitle className="text-2xl">{msgs.filter((m) => m.type === 'ticket').length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ข้อความ</CardDescription>
            <CardTitle className="text-2xl">{msgs.filter((m) => m.type === 'message').length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => { setFilter(v as FilterTab); setSelectedItem(null); }}>
        <TabsList>
          <TabsTrigger value="all">
            ทั้งหมด {msgs.length > 0 && <Badge variant="secondary" className="ml-1">{msgs.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="unread">
            ยังไม่อ่าน {unreadCount > 0 && <Badge variant="destructive" className="ml-1">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="starred">
            ติดดาว {msgs.filter(m => m.is_starred).length > 0 && <Badge variant="secondary" className="ml-1">{msgs.filter(m => m.is_starred).length}</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>{filter === 'unread' ? 'อ่านครบทุกข้อความแล้ว' : filter === 'starred' ? 'ยังไม่มีข้อความที่ติดดาว' : 'กล่องข้อความว่างเปล่า'}</p>
            <Button className="mt-4" size="sm" onClick={() => setComposeOpen(true)}>
              <PenSquare className="h-4 w-4 mr-1" />เขียนข้อความใหม่
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {/* List */}
          <div className="md:col-span-1 space-y-2 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
            {filtered.map((item) => (
              <Card
                key={item.id}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  selectedItem?.id === item.id ? 'border-primary ring-1 ring-primary' : '',
                  !item.is_read ? 'bg-muted/30' : ''
                )}
                onClick={() => handleSelect(item)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <button
                      className="mt-0.5 focus:outline-none shrink-0"
                      title={item.is_starred ? 'เลิกติดดาว' : 'ติดดาว'}
                      onClick={(e) => { e.stopPropagation(); toggleStar.mutate({ id: item.id, is_starred: item.is_starred ? 0 : 1 }); }}
                    >
                      {item.is_starred
                        ? <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        : <StarOff className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    {item.is_read
                      ? <MailOpen className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      : <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <Badge variant="secondary" className={cn('text-xs', TYPE_LABELS[item.type]?.color)}>
                          {TYPE_LABELS[item.type]?.label || item.type}
                        </Badge>
                        <Badge variant="outline" className={cn('text-xs', PRIORITY_LABELS[item.priority]?.color)}>
                          {PRIORITY_LABELS[item.priority]?.label || item.priority}
                        </Badge>
                        {!item.is_read && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className={cn('text-sm truncate', !item.is_read && 'font-semibold')}>{item.subject}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.sender_name}</p>
                      <p className="text-xs text-muted-foreground">{inboxFmt(item.created_at)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => handleDelete(item.id, e)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detail */}
          <div className="md:col-span-2">
            {selectedItem ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{selectedItem.subject}</CardTitle>
                      <CardDescription className="mt-1">
                        จาก: <span className="font-medium">{selectedItem.sender_name}</span>
                        {selectedItem.sender_email && ` (${selectedItem.sender_email})`}
                      </CardDescription>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="secondary" className={TYPE_LABELS[selectedItem.type]?.color}>
                          {TYPE_LABELS[selectedItem.type]?.label || selectedItem.type}
                        </Badge>
                        <Badge variant="outline" className={PRIORITY_LABELS[selectedItem.priority]?.color}>
                          {PRIORITY_LABELS[selectedItem.priority]?.label || selectedItem.priority}
                        </Badge>
                        {selectedItem.status && <Badge variant="outline">{selectedItem.status}</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        className="focus:outline-none"
                        title={selectedItem.is_starred ? 'เลิกติดดาว' : 'ติดดาว'}
                        onClick={() => toggleStar.mutate({ id: selectedItem.id, is_starred: selectedItem.is_starred ? 0 : 1 })}
                      >
                        {selectedItem.is_starred
                          ? <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                          : <StarOff className="h-5 w-5 text-muted-foreground" />}
                      </button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(selectedItem.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{inboxFmt(selectedItem.created_at)}</p>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {selectedItem.preview || <span className="text-muted-foreground italic">ไม่มีเนื้อหา</span>}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-20 text-center text-muted-foreground">
                  เลือกข้อความจากรายการด้านซ้ายเพื่อดูรายละเอียด
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} />
    </PageShell>
  );
}
