import { useEffect, useState } from 'react';
import { Database, FlaskConical, Loader2, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useContentGlobalSettings, useSaveGlobalSettings, useTestResearchProvider } from '@/hooks/useContent';

export default function ResearchProviderForm() {
  const { toast } = useToast();
  const { data: settings } = useContentGlobalSettings();
  const saveMut = useSaveGlobalSettings();
  const testMut = useTestResearchProvider();
  const [provider, setProvider] = useState('none');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [locationCode, setLocationCode] = useState('2764');
  const [languageCode, setLanguageCode] = useState('th');
  const [cacheHours, setCacheHours] = useState('168');

  useEffect(() => {
    if (!settings) return;
    setProvider(settings.research_provider || 'none');
    setLogin(settings.research_api_login || '');
    setLocationCode(String(settings.research_location_code ?? 2764));
    setLanguageCode(settings.research_language_code || 'th');
    setCacheHours(String(settings.research_cache_hours ?? 168));
  }, [settings]);

  const handleSave = () => {
    const payload: Record<string, string | number> = {
      research_provider: provider,
      research_api_login: login.trim(),
      research_location_code: Math.max(1, Number(locationCode) || 2764),
      research_language_code: languageCode.trim() || 'th',
      research_cache_hours: Math.min(8760, Math.max(0, Number(cacheHours) || 0)),
    };
    if (password.trim()) payload.research_api_key = password.trim();

    saveMut.mutate(payload, {
      onSuccess: () => {
        setPassword('');
        toast({ title: 'บันทึกการตั้งค่า Research แล้ว' });
      },
      onError: (error: any) => toast({ title: 'บันทึกไม่สำเร็จ', description: error.message, variant: 'destructive' }),
    });
  };

  const hasStoredCredential = Boolean(settings?.has_research_key);
  const hasEnteredCredential = Boolean(login.trim() && password.trim());
  const canTestConnection = provider === 'ai' || (provider === 'dataforseo' && login.trim() !== '' && (hasStoredCredential || hasEnteredCredential));

  const handleTestConnection = () => {
    const isAi = provider === 'ai';
    testMut.mutate({
      provider,
      ...(isAi ? {} : { login: login.trim() }),
      ...(!isAi && password.trim() ? { password: password.trim() } : {}),
    }, {
      onSuccess: (result) => {
        if (result.ok) {
          toast({
            title: isAi ? 'เชื่อมต่อ AI Research สำเร็จ' : 'เชื่อมต่อ DataForSEO สำเร็จ',
            description: isAi
              ? (result.message || 'Research AI พร้อมใช้งาน')
              : (typeof result.balance_usd === 'number' ? `ยอดคงเหลือ ${result.balance_usd.toFixed(2)} USD` : result.message),
          });
          return;
        }

        toast({
          title: isAi ? 'เชื่อมต่อ AI Research ไม่สำเร็จ' : 'เชื่อมต่อ DataForSEO ไม่สำเร็จ',
          description: result.message,
          variant: 'destructive',
        });
      },
      onError: (error: any) => toast({
        title: isAi ? 'เชื่อมต่อ AI Research ไม่สำเร็จ' : 'เชื่อมต่อ DataForSEO ไม่สำเร็จ',
        description: error.message,
        variant: 'destructive',
      }),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4 text-emerald-600" /> แหล่งข้อมูล Research
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          ตั้งค่าแหล่งข้อมูลคำค้นหาและผลการค้นหาเพื่อใช้ใน flow คอนเทนต์เดิม
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span>ผู้ให้บริการ</span>
            <select value={provider} onChange={e => setProvider(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="none">ยังไม่ตั้งค่า</option>
              <option value="dataforseo">DataForSEO</option>
              <option value="ai">AI (Perplexity/Sonar)</option>
            </select>
          </label>
          {provider !== 'ai' && (
            <>
              <label className="space-y-1.5 text-sm">
                <span>DataForSEO Login</span>
                <Input value={login} onChange={e => setLogin(e.target.value)} placeholder="อีเมลสำหรับ DataForSEO" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span>Password {settings?.has_research_key ? '(ตั้งค่าแล้ว เว้นว่างเพื่อใช้ค่าเดิม)' : ''}</span>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="กรอก password ใหม่" autoComplete="new-password" />
              </label>
              <label className="space-y-1.5 text-sm">
                <span>รหัสพื้นที่ค้นหา</span>
                <Input type="number" min={1} value={locationCode} onChange={e => setLocationCode(e.target.value)} />
              </label>
            </>
          )}
          <label className="space-y-1.5 text-sm">
            <span>รหัสภาษา</span>
            <Input value={languageCode} onChange={e => setLanguageCode(e.target.value)} placeholder="th" />
          </label>
          <label className="space-y-1.5 text-sm">
            <span>อายุ Cache (ชั่วโมง)</span>
            <Input type="number" min={0} max={8760} value={cacheHours} onChange={e => setCacheHours(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" disabled={saveMut.isPending} onClick={handleSave}>
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึกการตั้งค่า
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={!canTestConnection || saveMut.isPending || testMut.isPending}
            onClick={handleTestConnection}
          >
            {testMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            ทดสอบการเชื่อมต่อ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
