import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { usePublishChannels, useSavePublishChannel, useDeletePublishChannel } from '@/hooks/useContent';
import type { PublishChannel } from '@/components/content/types';
import { PLATFORM_MAP } from '@/components/content/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Rss, Loader2, Wifi } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { PlatformIcon } from '@/components/content/PlatformIcon';
import { getPlatformColors } from '@/lib/platformConfig';

export default function ChannelManagementSection() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [dialog, setDialog]   = useState(false);
  const [editing, setEditing] = useState<PublishChannel | null>(null);
  const blankCreds: Record<string,string> = {};
  const [form, setForm] = useState<{
    name: string; platform: string; endpoint_url: string;
    credentials: Record<string,string>;
  }>({ name: '', platform: 'wordpress', endpoint_url: '', credentials: blankCreds });

  const { data: channels = [], isLoading } = usePublishChannels();
  const saveMut = useSavePublishChannel();
  const delMut = useDeletePublishChannel();
  const [testing, setTesting] = useState<Record<string, boolean>>({});

  const testConnection = async (ch: PublishChannel) => {
    setTesting(p => ({ ...p, [ch.id]: true }));
    try {
      const res: any = await apiFetch('/brand-content.php?action=test-channel', {
        method: 'POST',
        body: JSON.stringify({ channel_id: ch.id }),
      });
      toast({
        title: res.ok ? `✓ ${ch.name} — เชื่อมต่อสำเร็จ` : `✗ ${ch.name} — เชื่อมต่อล้มเหลว`,
        description: res.message,
        variant: res.ok ? 'default' : 'destructive',
      });
    } catch (e: any) {
      toast({ title: 'ทดสอบไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(p => ({ ...p, [ch.id]: false }));
    }
  };

  const credFields: Record<string, Array<{ key: string; label: string; type?: string; hint?: string }>> = {
    wordpress: [{ key: 'username', label: 'Username' }, { key: 'app_password', label: 'App Password', type: 'password' }],
    wix:       [{ key: 'api_key', label: 'API Key', type: 'password' }, { key: 'site_id', label: 'Site ID' }],
    facebook:  [{ key: 'page_id', label: 'Page ID' }, { key: 'access_token', label: 'Access Token', type: 'password' }],
    lineoa:    [{ key: 'channel_access_token', label: 'Channel Access Token', type: 'password' }],
    linkedin:  [{ key: 'access_token', label: 'Access Token (OAuth2)', type: 'password' }, { key: 'author_urn', label: 'Author URN', hint: 'เช่น urn:li:person:xxxxxxxx' }],
    instagram: [],
    tiktok:    [],
    twitter:   [],
    custom:       [],
    lotusdomino:  [],
  };

  const LOTUS_URL = 'https://www.ktnbs.com/transform.nsf/ParseJSONString';

  const openCreate = () => { setEditing(null); setForm({ name: '', platform: 'wordpress', endpoint_url: '', credentials: {} }); setDialog(true); };
  const openEdit   = (ch: PublishChannel) => { setEditing(ch); setForm({ name: ch.name, platform: ch.platform, endpoint_url: ch.endpoint_url, credentials: {} }); setDialog(true); };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2"><Rss className="h-4 w-4 text-green-600" />Publish Channels</h3>
          <p className="text-xs text-muted-foreground mt-0.5">เชื่อมต่อแพลตฟอร์มสำหรับเผยแพร่คอนเทนต์</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openCreate}><Plus className="h-3.5 w-3.5" />เพิ่มช่องทาง</Button>
      </div>
      {isLoading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : channels.length === 0 ? (
          <div className="text-center py-8 border rounded-lg border-dashed text-muted-foreground"><Rss className="h-8 w-8 mx-auto mb-2 opacity-30" /><p className="text-sm">ยังไม่มีช่องทาง</p></div>
        ) : (
          <div className="space-y-2">
            {channels.map(ch => {
              const pc = getPlatformColors(ch.platform);
              return (
                <div key={ch.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                    style={{ backgroundColor: pc.bg, color: pc.text }}
                    title={PLATFORM_MAP[ch.platform]?.label ?? ch.platform}
                  >
                    <PlatformIcon platform={ch.platform} size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ch.name}</p>
                    {ch.endpoint_url && <p className="text-xs text-muted-foreground truncate">{ch.endpoint_url}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => testConnection(ch)} disabled={testing[ch.id]} title="ทดสอบการเชื่อมต่อ">
                      {testing[ch.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">ทดสอบ</span>
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(ch)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:text-destructive" onClick={async () => { if (await confirm({ title: 'ลบช่องทาง', description: 'ลบช่องทาง?', variant: 'destructive' })) delMut.mutate(ch.id, { onSuccess: () => toast({ title: 'ลบช่องทางแล้ว' }), onError: (e: any) => toast({ title: 'ลบไม่สำเร็จ', description: e?.message, variant: 'destructive' }) }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      <Dialog open={dialog} onOpenChange={open => { setDialog(open); if (!open) setEditing(null); }}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขช่องทาง' : 'เพิ่มช่องทางใหม่'}</DialogTitle>
            <DialogDescription>ตั้งค่าการเชื่อมต่อสำหรับเผยแพร่คอนเทนต์</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>ชื่อช่องทาง <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น Blog หลัก" />
              </div>
              <div className="space-y-1.5">
                <Label>แพลตฟอร์ม</Label>
                <Select value={form.platform} onValueChange={v => setForm(f => ({ ...f, platform: v, credentials: {}, endpoint_url: v === 'lotusdomino' && !f.endpoint_url ? LOTUS_URL : f.endpoint_url }))}>
                  <SelectTrigger>
                    <SelectValue>
                      {form.platform && (() => {
                        const pc = getPlatformColors(form.platform);
                        return (
                          <span className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded" style={{ backgroundColor: pc.bg, color: pc.text }}>
                              <PlatformIcon platform={form.platform} size={13} />
                            </span>
                            <span>{PLATFORM_MAP[form.platform]?.label ?? form.platform}</span>
                          </span>
                        );
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLATFORM_MAP).map(([k, v]) => {
                      const pc = getPlatformColors(k);
                      return (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded shrink-0" style={{ backgroundColor: pc.bg, color: pc.text }}>
                              <PlatformIcon platform={k} size={13} />
                            </span>
                            {v.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(form.platform === 'wordpress' || form.platform === 'wix' || form.platform === 'custom' || form.platform === 'instagram' || form.platform === 'tiktok' || form.platform === 'twitter' || form.platform === 'lotusdomino') && (
              <div className="space-y-1.5">
                <Label>Endpoint / Webhook URL</Label>
                <Input value={form.endpoint_url} onChange={e => setForm(f => ({ ...f, endpoint_url: e.target.value }))} placeholder={
                  form.platform === 'wordpress' ? 'https://yoursite.com' :
                  form.platform === 'wix' ? '' :
                  form.platform === 'lotusdomino' ? LOTUS_URL :
                  form.platform === 'instagram' || form.platform === 'tiktok' || form.platform === 'twitter'
                    ? 'https://hook.n8n.io/... หรือ Zapier webhook URL'
                    : 'https://api.yoursite.com/posts'
                } />
                {(form.platform === 'instagram' || form.platform === 'tiktok' || form.platform === 'twitter') && (
                  <p className="text-[11px] text-muted-foreground">ใช้ n8n / Zapier webhook เพื่อโพสต์ไปยัง {PLATFORM_MAP[form.platform]?.label} โดยอัตโนมัติ</p>
                )}
                {form.platform === 'lotusdomino' && (
                  <p className="text-[11px] text-muted-foreground">ส่ง JSON array ไปยัง Lotus Domino Agent — ฟิลด์: Date, Tags, AttachPhoto, Title, Body, Excerpt, Slug, SEOTitle, MetaDescription</p>
                )}
              </div>
            )}
            {credFields[form.platform]?.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label} {editing && <span className="text-xs text-muted-foreground font-normal">(เว้นว่างเพื่อไม่เปลี่ยน)</span>}</Label>
                <Input type={field.type ?? 'text'} value={form.credentials[field.key] ?? ''} onChange={e => setForm(f => ({ ...f, credentials: { ...f.credentials, [field.key]: e.target.value } }))} />
                {field.hint && <p className="text-[11px] text-muted-foreground">{field.hint}</p>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>ยกเลิก</Button>
            <Button disabled={saveMut.isPending || !form.name} onClick={() => saveMut.mutate({ ...form, id: editing?.id }, { onSuccess: () => { toast({ title: 'บันทึกช่องทางแล้ว' }); setDialog(false); }, onError: (e: any) => toast({ title: 'เกิดข้อผิดพลาด', description: e.message, variant: 'destructive' }) })}>
              {saveMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />กำลังบันทึก...</> : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
