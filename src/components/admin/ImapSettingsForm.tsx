import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Eye, EyeOff, CheckCircle2, AlertCircle, Inbox } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

interface ImapConfig {
  imap_host: string;
  imap_port: string;
  imap_encryption: string;
  imap_user: string;
  imap_password: string;
}

const DEFAULT: ImapConfig = {
  imap_host: '',
  imap_port: '993',
  imap_encryption: 'ssl',
  imap_user: '',
  imap_password: '',
};

const PRESETS: Record<string, { label: string; host: string; port: string; encryption: string }> = {
  custom:  { label: 'กำหนดเอง',            host: '',                  port: '993', encryption: 'ssl' },
  gmail:   { label: 'Gmail',               host: 'imap.gmail.com',    port: '993', encryption: 'ssl' },
  outlook: { label: 'Outlook / Office365', host: 'outlook.office365.com', port: '993', encryption: 'ssl' },
  yahoo:   { label: 'Yahoo Mail',          host: 'imap.mail.yahoo.com', port: '993', encryption: 'ssl' },
};

function detectPreset(host: string): string {
  for (const [key, p] of Object.entries(PRESETS)) {
    if (key !== 'custom' && p.host === host) return key;
  }
  return 'custom';
}

export default function ImapSettingsForm() {
  const { toast } = useToast();
  const [config, setConfig] = useState<ImapConfig>(DEFAULT);
  const [provider, setProvider] = useState('custom');
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/mail-settings.php');
      const merged: ImapConfig = {
        imap_host: data.imap_host ?? '',
        imap_port: data.imap_port ?? '993',
        imap_encryption: data.imap_encryption ?? 'ssl',
        imap_user: data.imap_user ?? '',
        imap_password: '',
      };
      setHasStoredPassword(!!data.imap_password_set);
      setConfig(merged);
      setProvider(detectPreset(merged.imap_host));
    } catch (e: any) {
      toast({ title: 'โหลดการตั้งค่าไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const set = (key: keyof ImapConfig, value: string) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const handleProviderChange = (key: string) => {
    setProvider(key);
    const p = PRESETS[key];
    if (!p) return;
    setConfig(prev => ({
      ...prev,
      ...(key !== 'custom' ? { imap_host: p.host } : {}),
      imap_port: p.port,
      imap_encryption: p.encryption,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiFetch('/mail-settings.php', { method: 'PUT', body: JSON.stringify(config) });
      toast({ title: 'บันทึกการตั้งค่า IMAP สำเร็จ' });
      setHasStoredPassword(prev => prev || !!config.imap_password);
      setConfig(prev => ({ ...prev, imap_password: '' }));
    } catch (e: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: e.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/mail-settings.php?action=test-imap', {
        method: 'POST',
        body: JSON.stringify(config),
      });
      setTestResult({ ok: true, message: res?.message || 'เชื่อมต่อสำเร็จ' });
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    } finally {
      setIsTesting(false);
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Inbox className="h-4 w-4 text-indigo-600" />ตั้งค่า IMAP (รับอีเมลเข้า)
        </CardTitle>
        <CardDescription>
          ดึงอีเมลจากกล่องจดหมายเพื่อสร้าง Lead อัตโนมัติ — ใช้การเชื่อมต่อแบบ socket
          ไม่ต้องเปิด PHP IMAP extension
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Provider selector */}
        <div className="grid gap-2">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger><SelectValue placeholder="เลือก Provider" /></SelectTrigger>
            <SelectContent>
              {Object.entries(PRESETS).map(([key, p]) => (
                <SelectItem key={key} value={key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {provider === 'gmail' && (
            <p className="text-xs text-muted-foreground">Gmail ต้องเปิด 2FA และใช้ <strong>App Password</strong> (ไม่ใช่รหัสผ่านปกติ)</p>
          )}
        </div>

        <div className="border-t" />

        {/* Host + Port */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 grid gap-2">
            <Label>IMAP Host *</Label>
            <Input
              value={config.imap_host}
              onChange={e => set('imap_host', e.target.value)}
              placeholder={PRESETS[provider]?.host || 'imap.example.com'}
            />
          </div>
          <div className="grid gap-2">
            <Label>Port *</Label>
            <Input value={config.imap_port} onChange={e => set('imap_port', e.target.value)} placeholder="993" />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Encryption</Label>
          <Select value={config.imap_encryption} onValueChange={v => set('imap_encryption', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ssl">SSL (port 993 — แนะนำ)</SelectItem>
              <SelectItem value="tls">STARTTLS (port 143)</SelectItem>
              <SelectItem value="none">None (port 143 — ไม่แนะนำ)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Username */}
        <div className="grid gap-2">
          <Label>Username / Email *</Label>
          <Input
            value={config.imap_user}
            onChange={e => set('imap_user', e.target.value)}
            placeholder="your@gmail.com"
            autoComplete="off"
          />
        </div>

        {/* Password */}
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Label>Password / App Password *</Label>
            {hasStoredPassword && !config.imap_password && (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">
                มีรหัสผ่านบันทึกไว้แล้ว
              </span>
            )}
          </div>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={config.imap_password}
              onChange={e => set('imap_password', e.target.value)}
              placeholder={hasStoredPassword && !config.imap_password ? 'เว้นว่างไว้เพื่อคงรหัสผ่านเดิม' : 'กรอก Password หรือ App Password'}
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
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกการตั้งค่า
          </Button>
          <Button onClick={handleTest} disabled={isTesting} variant="outline" className="gap-1.5">
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Inbox className="w-4 h-4" />}
            ทดสอบเชื่อมต่อ
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${testResult.ok ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
