import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, Send, Eye, EyeOff, CheckCircle2, AlertCircle, MessageSquare, Plus, Trash2, Users, User, Bell, Link, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

// Wrapper function that uses centralized API config
const apiCall = apiFetch;

interface SmtpConfig {
  mail_provider: string;
  mail_host: string;
  mail_port: string;
  mail_encryption: string;
  mail_smtp_auth: string;   // '1' = require auth, '0' = no auth (internal relay)
  mail_username: string;
  mail_password: string;
  mail_from_address: string;
  mail_from_name: string;
}

const DEFAULT: SmtpConfig = {
  mail_provider: 'custom',
  mail_host: '',
  mail_port: '587',
  mail_encryption: 'tls',
  mail_smtp_auth: '1',
  mail_username: '',
  mail_password: '',
  mail_from_address: '',
  mail_from_name: 'Flowstack',
};

const PRESETS: Record<string, { label: string; host: string; port: string; encryption: string; smtp_auth?: string }> = {
  custom:   { label: 'กำหนดเอง',            host: '',                                                port: '587',  encryption: 'tls'                  },
  gmail:    { label: 'Gmail',               host: 'smtp.gmail.com',                                  port: '587',  encryption: 'tls'                  },
  outlook:  { label: 'Outlook / Office365', host: 'smtp.office365.com',                              port: '587',  encryption: 'tls'                  },
  smtp2go:  { label: 'SMTP2GO',             host: 'mail.smtp2go.com',                                port: '2525', encryption: 'tls'                  },
  sendgrid: { label: 'SendGrid',            host: 'smtp.sendgrid.net',                               port: '587',  encryption: 'tls'                  },
  ses:      { label: 'AWS SES',             host: 'email-smtp.ap-southeast-1.amazonaws.com',         port: '587',  encryption: 'tls'                  },
  domino:   { label: 'HCL Domino',          host: '',                                                port: '25',   encryption: 'none', smtp_auth: '0' },
};

function detectPreset(host: string): string {
  for (const [key, p] of Object.entries(PRESETS)) {
    if (key !== 'custom' && key !== 'domino' && p.host && p.host === host) return key;
  }
  if (host.toLowerCase().includes('domino') || host.toLowerCase().includes('notes')) return 'domino';
  return 'custom';
}

export default function SmtpSettingsForm() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SmtpConfig>(DEFAULT);
  const [provider, setProvider] = useState('custom');
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  interface LineTarget { id: string; name: string; type: 'group' | 'user'; discovered_at?: string }
  interface TgTarget   { id: string; name: string; type: 'group' | 'channel' | 'user' }

  // App public URL for webhook display
  const [appPublicUrl, setAppPublicUrl] = useState('');

  // Line Notification state
  const [lineToken, setLineToken] = useState('');
  const [lineTokenSet, setLineTokenSet] = useState(false);
  const [lineSecret, setLineSecret] = useState('');
  const [lineSecretSet, setLineSecretSet] = useState(false);
  const [lineTargets, setLineTargets] = useState<LineTarget[]>([]);
  const [lineDiscoveredGroups, setLineDiscoveredGroups] = useState<LineTarget[]>([]);
  const [newTargetId, setNewTargetId] = useState('');
  const [newTargetName, setNewTargetName] = useState('');
  const [newTargetType, setNewTargetType] = useState<'group' | 'user'>('group');
  const [isSavingLine, setIsSavingLine] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [lineTestResult, setLineTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isLookingUpLine, setIsLookingUpLine] = useState(false);
  const lineDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Telegram Notification state
  const [tgToken, setTgToken] = useState('');
  const [tgTokenSet, setTgTokenSet] = useState(false);
  const [tgTargets, setTgTargets] = useState<TgTarget[]>([]);
  const [newTgId, setNewTgId] = useState('');
  const [newTgName, setNewTgName] = useState('');
  const [newTgType, setNewTgType] = useState<'group' | 'channel' | 'user'>('group');
  const [isSavingTg, setIsSavingTg] = useState(false);
  const [testingTgId, setTestingTgId] = useState<string | null>(null);
  const [tgTestResult, setTgTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isLookingUpTg, setIsLookingUpTg] = useState(false);
  const tgDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Auto-lookup LINE group name when group ID is typed
  useEffect(() => {
    if (lineDebounceRef.current) clearTimeout(lineDebounceRef.current);
    const id = newTargetId.trim();
    if (newTargetType !== 'group' || id.length < 30) { setIsLookingUpLine(false); return; }
    lineDebounceRef.current = setTimeout(async () => {
      setIsLookingUpLine(true);
      try {
        const res = await apiCall(`/mail-settings.php?action=line-group-info&group_id=${encodeURIComponent(id)}`);
        if (res?.groupName) setNewTargetName(res.groupName);
      } catch { /* ไม่แสดง error — user กรอกเองได้ */ }
      finally { setIsLookingUpLine(false); }
    }, 600);
  }, [newTargetId, newTargetType]);

  // Auto-lookup Telegram chat name when chat ID is typed
  useEffect(() => {
    if (tgDebounceRef.current) clearTimeout(tgDebounceRef.current);
    const id = newTgId.trim();
    if (newTgType === 'user' || !id) { setIsLookingUpTg(false); return; }
    tgDebounceRef.current = setTimeout(async () => {
      setIsLookingUpTg(true);
      try {
        const res = await apiCall(`/mail-settings.php?action=telegram-chat-info&chat_id=${encodeURIComponent(id)}`);
        if (res?.title) setNewTgName(res.title);
      } catch { /* ไม่แสดง error */ }
      finally { setIsLookingUpTg(false); }
    }, 600);
  }, [newTgId, newTgType]);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await apiCall('/mail-settings.php');
      const merged = { ...DEFAULT, ...data };
      setHasStoredPassword(!!merged.mail_password);
      setConfig(merged);
      const savedProvider = merged.mail_provider || detectPreset(merged.mail_host);
      setProvider(savedProvider);
      // Line settings
      setAppPublicUrl(data.app_public_url ?? '');
      setLineTokenSet(!!data.line_channel_access_token_set);
      setLineToken(data.line_channel_access_token ?? '');
      setLineSecretSet(!!data.line_channel_secret_set);
      setLineSecret(data.line_channel_secret ?? '');
      setLineTargets(Array.isArray(data.line_targets) ? data.line_targets : []);
      setLineDiscoveredGroups(Array.isArray(data.line_discovered_groups) ? data.line_discovered_groups : []);
      setTgTokenSet(!!data.telegram_bot_token_set);
      setTgToken(data.telegram_bot_token ?? '');
      setTgTargets(Array.isArray(data.telegram_targets) ? data.telegram_targets : []);
    } catch (e: any) {
      toast({ title: 'โหลดการตั้งค่าไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const set = (key: keyof SmtpConfig, value: string) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const handleProviderChange = (key: string) => {
    setProvider(key);
    const p = PRESETS[key];
    if (!p) return;
    setConfig(prev => ({
      ...prev,
      mail_provider:   key,
      // custom = ไม่แตะ host; provider อื่น = set host ตาม preset (domino = '' ให้กรอกเอง)
      ...(key !== 'custom' ? { mail_host: p.host } : {}),
      mail_port:       p.port,
      mail_encryption: p.encryption,
      // apply smtp_auth ถ้า preset กำหนดไว้
      ...(p.smtp_auth !== undefined ? { mail_smtp_auth: p.smtp_auth } : {}),
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiCall('/mail-settings.php', { method: 'PUT', body: JSON.stringify(config) });
      toast({ title: 'บันทึกการตั้งค่า SMTP สำเร็จ' });
    } catch (e: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      toast({ title: 'กรุณากรอกอีเมลสำหรับทดสอบ', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      // โหลดค่าล่าสุดจาก DB ก่อนทดสอบเสมอ เพื่อให้แน่ใจว่าใช้ค่าที่บันทึกไว้จริง
      const freshData = await apiCall('/mail-settings.php');
      const freshConfig: SmtpConfig = { ...DEFAULT, ...freshData };
      setConfig(freshConfig);
      setHasStoredPassword(!!freshConfig.mail_password);
      setProvider(freshConfig.mail_provider || detectPreset(freshConfig.mail_host));

      const res = await apiCall('/mail-settings.php?action=test', {
        method: 'POST',
        body: JSON.stringify({ to_email: testEmail, ...freshConfig }),
      });
      setTestResult({ ok: true, message: res?.message || 'ส่งสำเร็จ' });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const addTarget = () => {
    const id = newTargetId.trim();
    if (!id) return;
    if (lineTargets.find(t => t.id === id)) { toast({ title: 'ID นี้มีอยู่แล้ว', variant: 'destructive' }); return; }
    setLineTargets(prev => [...prev, { id, name: newTargetName.trim() || id, type: newTargetType }]);
    setNewTargetId(''); setNewTargetName('');
  };

  const removeTarget = (id: string) => setLineTargets(prev => prev.filter(t => t.id !== id));

  const addDiscoveredGroup = (g: LineTarget) => {
    if (lineTargets.find(t => t.id === g.id)) { toast({ title: 'Group นี้มีอยู่ใน Target แล้ว' }); return; }
    setLineTargets(prev => [...prev, g]);
  };

  const handleSaveLine = async () => {
    setIsSavingLine(true);
    try {
      await apiCall('/mail-settings.php', { method: 'PUT', body: JSON.stringify({ line_channel_access_token: lineToken, line_channel_secret: lineSecret, line_targets: lineTargets }) });
      toast({ title: 'บันทึกการตั้งค่า Line สำเร็จ' });
      setLineTokenSet(!!lineToken);
    } catch (e: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingLine(false);
    }
  };

  const handleTestLine = async (targetId?: string) => {
    setTestingId(targetId ?? '__all__');
    setLineTestResult(null);
    try {
      const res = await apiCall('/mail-settings.php?action=test-line', { method: 'POST', body: JSON.stringify(targetId ? { target_id: targetId } : {}) });
      const isOk = res?.ok !== false;
      let msg = res?.message || 'ส่งสำเร็จ';
      if (!isOk && Array.isArray(res?.results)) {
        const details = res.results.filter((r: any) => !r.ok).map((r: any) => r.error ? `${r.name}: ${r.error}` : r.name).join('\n');
        if (details) msg += '\n' + details;
      }
      setLineTestResult({ ok: isOk, message: msg });
    } catch (e: any) {
      setLineTestResult({ ok: false, message: e.message });
    } finally {
      setTestingId(null);
    }
  };

  const addTgTarget = () => {
    const id = newTgId.trim();
    if (!id) return;
    if (tgTargets.find(t => t.id === id)) { toast({ title: 'ID นี้มีอยู่แล้ว', variant: 'destructive' }); return; }
    setTgTargets(prev => [...prev, { id, name: newTgName.trim() || id, type: newTgType }]);
    setNewTgId(''); setNewTgName('');
  };

  const removeTgTarget = (id: string) => setTgTargets(prev => prev.filter(t => t.id !== id));

  const handleSaveTg = async () => {
    setIsSavingTg(true);
    try {
      await apiCall('/mail-settings.php', { method: 'PUT', body: JSON.stringify({ telegram_bot_token: tgToken, telegram_targets: tgTargets }) });
      toast({ title: 'บันทึกการตั้งค่า Telegram สำเร็จ' });
      setTgTokenSet(!!tgToken);
    } catch (e: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setIsSavingTg(false);
    }
  };

  const handleTestTg = async (targetId?: string) => {
    setTestingTgId(targetId ?? '__all__');
    setTgTestResult(null);
    try {
      const res = await apiCall('/mail-settings.php?action=test-telegram', { method: 'POST', body: JSON.stringify(targetId ? { target_id: targetId } : {}) });
      const isOk = res?.ok !== false;
      let msg = res?.message || 'ส่งสำเร็จ';
      if (!isOk && Array.isArray(res?.results)) {
        const details = res.results.filter((r: any) => !r.ok).map((r: any) => r.error ? `${r.name}: ${r.error}` : r.name).join('\n');
        if (details) msg += '\n' + details;
      }
      setTgTestResult({ ok: isOk, message: msg });
    } catch (e: any) {
      setTgTestResult({ ok: false, message: e.message });
    } finally {
      setTestingTgId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* SMTP Provider Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ตั้งค่า SMTP</CardTitle>
          <CardDescription>กำหนดค่า SMTP Server สำหรับส่งอีเมลแคมเปญ Marketing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider selector */}
          <div className="grid gap-2">
            <Label>SMTP Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue placeholder="เลือก Provider" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRESETS).map(([key, p]) => (
                  <SelectItem key={key} value={key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {provider === 'gmail' && (
              <p className="text-xs text-muted-foreground">Gmail ต้องเปิด 2FA และสร้าง <strong>App Password</strong> (Google Account → Security → App passwords)</p>
            )}
            {provider === 'domino' && (
              <p className="text-xs text-muted-foreground">HCL Domino: กรอก SMTP Host ของ server ในองค์กร เช่น <code className="bg-muted px-1 rounded">mail.company.com</code></p>
            )}
            {provider === 'smtp2go' && (
              <p className="text-xs text-muted-foreground">SMTP2GO: ใช้ username/password จาก dashboard ของ SMTP2GO (Sender Domains)</p>
            )}
          </div>

          <div className="border-t" />

          {/* Host + Port + Encryption */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 grid gap-2">
              <Label>SMTP Host *</Label>
              <Input
                value={config.mail_host}
                onChange={e => set('mail_host', e.target.value)}
                placeholder={provider === 'domino' ? 'เช่น mail.company.com หรือ 192.168.1.x' : PRESETS[provider]?.host || 'smtp.example.com'}
              />
            </div>
            <div className="grid gap-2">
              <Label>Port *</Label>
              <Input
                value={config.mail_port}
                onChange={e => set('mail_port', e.target.value)}
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Encryption</Label>
            <Select value={config.mail_encryption} onValueChange={v => set('mail_encryption', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tls">TLS (port 587 — แนะนำ)</SelectItem>
                <SelectItem value="ssl">SSL (port 465)</SelectItem>
                <SelectItem value="none">None (port 25 — ไม่แนะนำ)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* SMTP Auth toggle */}
          <div className="flex items-center gap-3 py-1">
            <Checkbox
              id="smtp-auth"
              checked={config.mail_smtp_auth !== '0'}
              onCheckedChange={v => set('mail_smtp_auth', v ? '1' : '0')}
            />
            <div>
              <label htmlFor="smtp-auth" className="text-sm font-medium cursor-pointer">
                ต้องการ Authentication (Username / Password)
              </label>
              <p className="text-xs text-muted-foreground">
                ปิดสำหรับ internal server ที่ relay โดย IP (เช่น HCL Domino ภายในองค์กร)
              </p>
            </div>
          </div>

          {/* Credentials — shown only when auth enabled */}
          {config.mail_smtp_auth !== '0' && (
          <div className="grid gap-2">
            <Label>Username / Email</Label>
            <Input
              value={config.mail_username}
              onChange={e => set('mail_username', e.target.value)}
              placeholder="your@gmail.com"
              autoComplete="off"
            />
          </div>
          )}

          {config.mail_smtp_auth !== '0' && (
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label>Password / App Password</Label>
              {hasStoredPassword && !config.mail_password && (
                <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">
                  มีรหัสผ่านบันทึกไว้แล้ว
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={config.mail_password}
                onChange={e => set('mail_password', e.target.value)}
                placeholder={hasStoredPassword && !config.mail_password ? 'เว้นว่างไว้เพื่อคงรหัสผ่านเดิม' : 'กรอก Password หรือ App Password'}
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {provider === 'gmail' && (
              <p className="text-xs text-muted-foreground">
                Gmail: ต้องใช้ <strong>App Password</strong> (เปิด 2FA → Google Account → Security → App passwords)
              </p>
            )}
          </div>
          )}

          <div className="border-t" />

          {/* Sender info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>ชื่อผู้ส่ง (From Name)</Label>
              <Input
                value={config.mail_from_name}
                onChange={e => set('mail_from_name', e.target.value)}
                placeholder="Flowstack"
              />
            </div>
            <div className="grid gap-2">
              <Label>อีเมลผู้ส่ง (From Address)</Label>
              <Input
                value={config.mail_from_address}
                onChange={e => set('mail_from_address', e.target.value)}
                placeholder="noreply@company.com"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            บันทึกการตั้งค่า
          </Button>
        </CardContent>
      </Card>

      {/* Test Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ทดสอบการส่งอีเมล</CardTitle>
          <CardDescription>ส่งอีเมลทดสอบเพื่อยืนยันว่าตั้งค่า SMTP ถูกต้อง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="อีเมลที่ต้องการรับการทดสอบ"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTest()}
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={isTesting} variant="outline">
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              ส่งทดสอบ
            </Button>
          </div>

          {testResult && (
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
              {testResult.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Notification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-600" />แจ้งเตือน LINE
          </CardTitle>
          <CardDescription>ส่งสรุปงานทีมไปยัง LINE Group หรือ User อัตโนมัติทุกเช้า</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Webhook URL */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Link className="h-3.5 w-3.5" />Public URL ของ Server <span className="text-muted-foreground font-normal text-xs">(สำหรับ Webhook)</span></Label>
            <div className="flex gap-2">
              <Input
                value={appPublicUrl}
                onChange={e => setAppPublicUrl(e.target.value)}
                placeholder="https://platform.ktnbs.com/flowstack"
                className="font-mono text-xs flex-1"
              />
              <Button size="sm" variant="outline" className="shrink-0" onClick={async () => {
                await apiCall('/mail-settings.php', { method: 'PUT', body: JSON.stringify({ app_public_url: appPublicUrl }) });
                toast({ title: 'บันทึก Public URL สำเร็จ' });
              }}>
                <Save className="h-3.5 w-3.5" />
              </Button>
            </div>
            {appPublicUrl && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-3 py-2.5 text-xs space-y-1">
                <p className="text-blue-700 dark:text-blue-300 font-medium">ลงทะเบียน URL นี้ใน LINE Developers Console → Messaging API → Webhook settings</p>
                <code className="block bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 px-2 py-1 rounded font-mono text-[11px] break-all select-all">
                  {appPublicUrl.replace(/\/$/, '')}/api/line-webhook.php
                </code>
              </div>
            )}
          </div>

          {/* Token */}
          <div className="grid gap-2">
            <Label>① LINE Channel Access Token <span className="text-destructive">*</span></Label>
            <Input
              value={lineToken}
              onChange={e => setLineToken(e.target.value)}
              placeholder="วาง Channel Access Token จาก LINE Developers Console"
              autoComplete="off"
              className="font-mono text-xs"
            />
            {lineTokenSet
              ? <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Token บันทึกไว้แล้ว</p>
              : <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />ยังไม่มี Token — กรุณากรอกและบันทึก</p>
            }
          </div>

          {/* Channel Secret */}
          <div className="grid gap-2">
            <Label>② Channel Secret <span className="text-muted-foreground text-xs font-normal">(สำหรับยืนยัน Webhook)</span></Label>
            <Input
              value={lineSecret}
              onChange={e => setLineSecret(e.target.value)}
              placeholder="Channel Secret จาก LINE Developers Console → Basic settings"
              autoComplete="off"
              className="font-mono text-xs"
            />
            {lineSecretSet
              ? <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Secret บันทึกไว้แล้ว — Webhook จะตรวจ Signature</p>
              : <p className="text-xs text-muted-foreground">ไม่บังคับ — ถ้าไม่กรอก Webhook จะรับ event โดยไม่ตรวจ Signature</p>
            }
          </div>

          <div className="border-t" />

          {/* Discovered groups from webhook */}
          {lineDiscoveredGroups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                <Label className="text-sm">กลุ่มที่พบจาก Webhook</Label>
                <span className="text-xs text-muted-foreground">({lineDiscoveredGroups.length} กลุ่ม)</span>
              </div>
              <div className="space-y-1.5">
                {lineDiscoveredGroups.map(g => {
                  const alreadyAdded = lineTargets.some(t => t.id === g.id);
                  return (
                    <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-green-50 dark:bg-green-950/20 text-sm">
                      <Users className="h-3.5 w-3.5 shrink-0 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{g.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground font-mono truncate">{g.id}</span>
                        {g.discovered_at && <span className="ml-2 text-[10px] text-muted-foreground">{g.discovered_at}</span>}
                      </div>
                      <Button size="sm" variant={alreadyAdded ? 'ghost' : 'outline'} className="h-6 text-xs shrink-0 gap-1"
                        disabled={alreadyAdded} onClick={() => addDiscoveredGroup(g)}>
                        {alreadyAdded ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Plus className="h-3 w-3" />}
                        {alreadyAdded ? 'เพิ่มแล้ว' : 'เพิ่มเป็น Target'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Target list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>③ Group ID / User ID ปลายทาง <span className="text-destructive">*</span></Label>
              <span className="text-xs text-muted-foreground">{lineTargets.length} รายการ</span>
            </div>
            {lineTargets.length > 0 && (
              <div className="space-y-1.5">
                {lineTargets.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-sm">
                    <span className="shrink-0 text-muted-foreground">
                      {t.type === 'group' ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono truncate">{t.id}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0"
                      disabled={testingId === t.id}
                      onClick={() => handleTestLine(t.id)}
                      title="ทดสอบส่งไปยัง target นี้">
                      {testingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 hover:text-destructive" onClick={() => removeTarget(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new target */}
            <div className="flex gap-2 flex-wrap pt-1">
              <Select value={newTargetType} onValueChange={v => setNewTargetType(v as 'group' | 'user')}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group"><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Group</span></SelectItem>
                  <SelectItem value="user"><span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />User</span></SelectItem>
                </SelectContent>
              </Select>
              <Input className="h-8 text-xs flex-1 min-w-32 font-mono" placeholder="Group ID หรือ User ID" value={newTargetId} onChange={e => setNewTargetId(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTarget()} />
              <div className="relative flex-1 min-w-24">
                <Input className="h-8 text-xs w-full pr-6" placeholder="ชื่อ (ดึงอัตโนมัติ)" value={newTargetName} onChange={e => setNewTargetName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTarget()} />
                {isLookingUpLine && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={addTarget} disabled={!newTargetId.trim()}>
                <Plus className="h-3.5 w-3.5" />เพิ่ม
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Group ID เริ่มต้นด้วย <code className="bg-muted px-1 rounded">C</code>, User ID เริ่มต้นด้วย <code className="bg-muted px-1 rounded">U</code> — รับได้จาก webhook event ของ LINE Bot</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSaveLine} disabled={isSavingLine} className="gap-1.5">
              {isSavingLine ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึก
            </Button>
            <Button onClick={() => handleTestLine()} disabled={testingId !== null || (!lineTokenSet && !lineToken) || lineTargets.length === 0} variant="outline" className="gap-1.5">
              {testingId === '__all__' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              ทดสอบทุก Target
            </Button>
          </div>

          {lineTestResult && (
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${lineTestResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
              {lineTestResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{lineTestResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Telegram Notification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <svg className="h-4 w-4 text-sky-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
            แจ้งเตือน Telegram
          </CardTitle>
          <CardDescription>ส่งสรุปงานทีมไปยัง Telegram Group หรือ Channel อัตโนมัติทุกเช้า</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Required keys info */}
          <div className="rounded-lg bg-muted/50 border px-3 py-2.5 text-xs space-y-1 text-muted-foreground">
            <p className="font-semibold text-foreground">Keys ที่จำเป็น (Telegram Bot API)</p>
            <p>① <code className="bg-background px-1 rounded">Bot Token</code> — ใช้ยืนยันตัวตน Bot เพื่อส่งข้อความ</p>
            <p>② <code className="bg-background px-1 rounded">Chat ID</code> — ID ปลายทาง (Group, Channel, หรือ User)</p>
            <p className="text-[11px]">รับ Bot Token ได้จาก <code className="bg-background px-1 rounded">@BotFather</code> → /newbot หรือ /mybots → API Token</p>
            <p className="text-[11px]">รับ Chat ID: เพิ่ม Bot เข้า Group/Channel แล้วดูจาก <code className="bg-background px-1 rounded">@userinfobot</code> หรือ Webhook update</p>
          </div>

          {/* Bot Token */}
          <div className="grid gap-2">
            <Label>① Telegram Bot Token <span className="text-destructive">*</span></Label>
            <Input
              value={tgToken}
              onChange={e => setTgToken(e.target.value)}
              placeholder="เช่น 7123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              autoComplete="off"
              className="font-mono text-xs"
            />
            {tgTokenSet
              ? <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Token บันทึกไว้แล้ว</p>
              : <p className="text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />ยังไม่มี Token — กรุณากรอกและบันทึก</p>
            }
          </div>

          <div className="border-t" />

          {/* Target list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>② Chat ID ปลายทาง <span className="text-destructive">*</span></Label>
              <span className="text-xs text-muted-foreground">{tgTargets.length} รายการ</span>
            </div>
            {tgTargets.length > 0 && (
              <div className="space-y-1.5">
                {tgTargets.map(t => (
                  <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 text-sm">
                    <span className="shrink-0 text-muted-foreground">
                      {t.type === 'channel' ? <Bell className="h-3.5 w-3.5" /> : t.type === 'user' ? <User className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono truncate">{t.id}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" disabled={testingTgId === t.id} onClick={() => handleTestTg(t.id)} title="ทดสอบส่ง">
                      {testingTgId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0 hover:text-destructive" onClick={() => removeTgTarget(t.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new target */}
            <div className="flex gap-2 flex-wrap pt-1">
              <Select value={newTgType} onValueChange={v => setNewTgType(v as 'group' | 'channel' | 'user')}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group"><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Group</span></SelectItem>
                  <SelectItem value="channel"><span className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Channel</span></SelectItem>
                  <SelectItem value="user"><span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />User</span></SelectItem>
                </SelectContent>
              </Select>
              <Input className="h-8 text-xs flex-1 min-w-32 font-mono" placeholder="-100xxxxxxxxxx หรือ @channel" value={newTgId} onChange={e => setNewTgId(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTgTarget()} />
              <div className="relative flex-1 min-w-24">
                <Input className="h-8 text-xs w-full pr-6" placeholder="ชื่อ (ดึงอัตโนมัติ)" value={newTgName} onChange={e => setNewTgName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTgTarget()} />
                {isLookingUpTg && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={addTgTarget} disabled={!newTgId.trim()}>
                <Plus className="h-3.5 w-3.5" />เพิ่ม
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Group/Channel ID เป็นตัวเลขลบ เช่น <code className="bg-muted px-1 rounded">-1001234567890</code> หรือ Username เช่น <code className="bg-muted px-1 rounded">@mychannel</code></p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleSaveTg} disabled={isSavingTg} className="gap-1.5">
              {isSavingTg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึก
            </Button>
            <Button onClick={() => handleTestTg()} disabled={testingTgId !== null || (!tgTokenSet && !tgToken) || tgTargets.length === 0} variant="outline" className="gap-1.5">
              {testingTgId === '__all__' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              ทดสอบทุก Target
            </Button>
          </div>

          {tgTestResult && (
            <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${tgTestResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
              {tgTestResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span>{tgTestResult.message}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
