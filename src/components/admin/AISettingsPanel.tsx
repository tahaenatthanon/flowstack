import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Search, Eye, EyeOff, CheckCircle2, AlertCircle, Wifi, WifiOff, Settings2, List, Cpu, RefreshCw, MessageSquare, FileText, CreditCard, BarChart3, Save, Image, Video, Sparkles, UserSearch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { apiFetch } from '@/lib/api';
import ModelCombobox from '@/components/ModelCombobox';

interface AIProvider {
  id: string;
  name: string;
  display_name: string;
  description: string;
  api_base_url: string;
  icon: string;
  is_active: number;
  has_api_key: number;
  model_count: number;
  created_at: string;
  updated_at: string;
}

interface AIModel {
  id: string;
  provider_id: string;
  model_id: string;
  name: string;
  description: string;
  context_window: number;
  max_output_tokens: number;
  input_price_per_1k: number;
  output_price_per_1k: number;
  supports_vision: number;
  supports_streaming: number;
  supports_function_calling: number;
  supports_tool_calling: number;
  status: string;
  features: Record<string, unknown>;
  provider_name?: string;
}

interface AIConnectionSettings {
  ai_active_provider_id: string | null;
  ai_default_model_id: string | null;
  provider_name?: string;
  provider_display_name?: string;
  provider_base_url?: string;
  provider_has_key?: number;
  model_name?: string;
  model_identifier?: string;
  ai_chat_model_id?: string | null;
  ai_chat_context_prompt?: string | null;
  ai_content_text_model_id?: string | null;
  ai_content_image_model_id?: string | null;
  ai_content_video_model_id?: string | null;
  ai_cardscan_model_id?: string | null;
  ai_analyst_model_id?: string | null;
  ai_lead_model_id?: string | null;
  ai_content_timeout?: number;
  ai_content_max_tokens?: number;
}

type ActiveTab = 'connection' | 'providers' | 'models' | 'features';

interface FeatureSettings {
  ai_chat_model_id: string | null;
  ai_content_text_model_id: string | null;
  ai_content_image_model_id: string | null;
  ai_content_video_model_id: string | null;
  ai_cardscan_model_id: string | null;
  ai_analyst_model_id: string | null;
  ai_lead_model_id: string | null;
}

const AI_FEATURES = [
  { key: 'ai_chat_model_id'           as const, label: 'AI Chat',                   description: 'โมเดลสำหรับแชทผู้ช่วย AI',                       icon: MessageSquare },
  { key: 'ai_content_text_model_id'   as const, label: 'คอนเทนท์ข้อความ',          description: 'โมเดลสำหรับสร้างบทความ แคปชั่น และเนื้อหาข้อความ',  icon: FileText },
  { key: 'ai_content_image_model_id'  as const, label: 'คอนเทนท์ภาพ',              description: 'โมเดลสำหรับสร้างเนื้อหาที่เกี่ยวกับภาพ (Image Brief / Alt Text)', icon: Image },
  { key: 'ai_content_video_model_id'  as const, label: 'คอนเทนท์วิดีโอ',           description: 'โมเดลสำหรับสร้างสคริปต์และคำบรรยายวิดีโอ',          icon: Video },
  { key: 'ai_cardscan_model_id'       as const, label: 'แสกนนามบัตร',               description: 'โมเดลสำหรับอ่านและแปลงข้อมูลนามบัตร (Vision)',     icon: CreditCard },
  { key: 'ai_analyst_model_id'        as const, label: 'AI Analyst งานและโปรเจค',   description: 'โมเดลสำหรับวิเคราะห์งานและโครงการ',                  icon: BarChart3 },
  { key: 'ai_lead_model_id'           as const, label: 'ค้นหาลูกค้าใหม่ (Lead Generation)', description: 'โมเดลสำหรับค้นหา leads จากอินเทอร์เน็ต และสกัด/สรุปอีเมลเป็น lead', icon: UserSearch },
];

function ProviderIcon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, string> = { kilo: '⚡', openrouter: '🌐', direct: '🔗' };
  const emoji = icons[name?.toLowerCase()] ?? '🤖';
  return <span className={className}>{emoji}</span>;
}

export default function AISettingsPanel() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [allModelsForProvider, setAllModelsForProvider] = useState<AIModel[]>([]);
  const [connectionSettings, setConnectionSettings] = useState<AIConnectionSettings>({ ai_active_provider_id: null, ai_default_model_id: null });
  const [loading, setLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Partial<AIProvider> | null>(null);
  const [editingModel, setEditingModel] = useState<Partial<AIModel> | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('connection');
  const [syncingModels, setSyncingModels] = useState(false);
  // Feature model settings
  const [featureSettings, setFeatureSettings] = useState<FeatureSettings>({
    ai_chat_model_id: null, ai_content_text_model_id: null, ai_content_image_model_id: null, ai_content_video_model_id: null, ai_cardscan_model_id: null, ai_analyst_model_id: null, ai_lead_model_id: null,
  });
  const [allModels, setAllModels] = useState<AIModel[]>([]);
  const [savingFeatures, setSavingFeatures] = useState(false);
  const [chatContextPrompt, setChatContextPrompt] = useState('');
  const [contentTimeout, setContentTimeout] = useState(300);
  const [contentMaxTokens, setContentMaxTokens] = useState(8192);
  // Per-feature selected gateway (provider_id)
  const [featureGateways, setFeatureGateways] = useState<Record<string, string | null>>({
    ai_chat_model_id: null, ai_content_text_model_id: null, ai_content_image_model_id: null, ai_content_video_model_id: null, ai_cardscan_model_id: null, ai_analyst_model_id: null, ai_lead_model_id: null,
  });
  // Connection tab state
  const [selectedConnectionProvider, setSelectedConnectionProvider] = useState<AIProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [fetchingKey, setFetchingKey] = useState(false);
  const [selectedDefaultModel, setSelectedDefaultModel] = useState<string>('');

  useEffect(() => {
    loadProviders();
    loadConnectionSettings();
    loadAllModels();
  }, []);

  const loadAllModels = async () => {
    try {
      const data = await apiFetch<{ models: AIModel[] }>('/ai-models.php');
      setAllModels(data.models || []);
    } catch { setAllModels([]); }
  };

  // When allModels + featureSettings both available, infer featureGateways from saved model ids
  useEffect(() => {
    if (allModels.length === 0) return;
    setFeatureGateways(prev => {
      const next = { ...prev };
      for (const { key } of AI_FEATURES) {
        if (!next[key]) {
          const modelId = featureSettings[key];
          if (modelId) {
            const found = allModels.find(m => m.id === modelId);
            if (found) next[key] = found.provider_id;
          }
        }
      }
      return next;
    });
  }, [allModels, featureSettings]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ providers: AIProvider[] }>('/ai-providers.php');
      setProviders(data.providers || []);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลดข้อมูล provider', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadConnectionSettings = async () => {
    try {
      const data = await apiFetch<AIConnectionSettings>('/ai-settings.php');
      setConnectionSettings(data);
    } catch { /* non-critical */ }
  };

  const loadModelsForProvider = async (providerId: string) => {
    try {
      setLoading(true);
      const data = await apiFetch<{ models: AIModel[] }>(`/ai-models.php?provider=${providerId}`);
      setModels(data.models || []);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถโหลด models', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const loadModelsForConnection = useCallback(async (providerId: string) => {
    try {
      const data = await apiFetch<{ models: AIModel[] }>(`/ai-models.php?provider=${providerId}`);
      setAllModelsForProvider(data.models || []);
    } catch { setAllModelsForProvider([]); }
  }, []);

  // When connection provider is selected, load its models and fetch existing API key
  useEffect(() => {
    if (selectedConnectionProvider) {
      loadModelsForConnection(selectedConnectionProvider.id);
      setApiKeyInput('');
      setTestResult(null);
      if (selectedConnectionProvider.has_api_key) {
        setFetchingKey(true);
        apiFetch<{ api_key: string }>(`/ai-providers.php?action=get-api-key&id=${selectedConnectionProvider.id}`)
          .then(data => setApiKeyInput(data.api_key || ''))
          .catch(() => {})
          .finally(() => setFetchingKey(false));
      }
    }
  }, [selectedConnectionProvider, loadModelsForConnection]);

  // Set active connection provider on initial load only (not on every provider refresh)
  useEffect(() => {
    if (selectedConnectionProvider) return; // already selected — don't override user's choice
    if (connectionSettings.ai_active_provider_id && providers.length > 0) {
      const active = providers.find(p => p.id === connectionSettings.ai_active_provider_id);
      if (active) setSelectedConnectionProvider(active);
    }
  }, [providers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync form fields when connectionSettings loads (only once on first load)
  useEffect(() => {
    if (!connectionSettings.ai_active_provider_id) return;
    if (connectionSettings.ai_default_model_id) setSelectedDefaultModel(connectionSettings.ai_default_model_id);
    const fs: FeatureSettings = {
      ai_chat_model_id:          connectionSettings.ai_chat_model_id          ?? null,
      ai_content_text_model_id:  connectionSettings.ai_content_text_model_id  ?? null,
      ai_content_image_model_id: connectionSettings.ai_content_image_model_id ?? null,
      ai_content_video_model_id: connectionSettings.ai_content_video_model_id ?? null,
      ai_cardscan_model_id:      connectionSettings.ai_cardscan_model_id      ?? null,
      ai_analyst_model_id:       connectionSettings.ai_analyst_model_id       ?? null,
      ai_lead_model_id:          connectionSettings.ai_lead_model_id          ?? null,
    };
    setFeatureSettings(fs);
    setChatContextPrompt(connectionSettings.ai_chat_context_prompt ?? '');
    setContentTimeout(connectionSettings.ai_content_timeout ?? 300);
    setContentMaxTokens(connectionSettings.ai_content_max_tokens ?? 8192);
  }, [connectionSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectConnectionProvider = (provider: AIProvider) => {
    setSelectedConnectionProvider(provider);
    setTestResult(null);
    setSelectedDefaultModel('');
  };

  const handleSaveApiKey = async () => {
    if (!selectedConnectionProvider) return;
    try {
      await apiFetch(`/ai-providers.php?action=set-api-key&id=${selectedConnectionProvider.id}`, {
        method: 'PUT',
        body: JSON.stringify({ api_key: apiKeyInput }),
      });
      toast({ title: 'บันทึก API Key สำเร็จ' });
      setApiKeyInput('');
      loadProviders();
      setTestResult(null);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึก API key', variant: 'destructive' });
    }
  };

  const handleFetchApiKey = async () => {
    if (!selectedConnectionProvider) return;
    setFetchingKey(true);
    try {
      const data = await apiFetch<{ api_key: string }>(`/ai-providers.php?action=get-api-key&id=${selectedConnectionProvider.id}`);
      setApiKeyInput(data.api_key || '');
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถดึง API key', variant: 'destructive' });
    } finally {
      setFetchingKey(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedConnectionProvider) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const result = await apiFetch<{ success: boolean; message: string; model_count?: number }>(
        `/ai-providers.php?action=test&id=${selectedConnectionProvider.id}`,
        { method: 'POST' }
      );
      if (result.success) {
        setTestResult({ success: true, message: `${result.message}${result.model_count ? ` (${result.model_count} models)` : ''}` });
      } else {
        setTestResult({ success: false, message: result.message || 'การเชื่อมต่อล้มเหลว' });
      }
    } catch (err: unknown) {
      setTestResult({ success: false, message: (err instanceof Error ? err.message : null) || 'ไม่สามารถเชื่อมต่อได้' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveConnectionSettings = async () => {
    setSavingSettings(true);
    try {
      if (apiKeyInput && selectedConnectionProvider) {
        await apiFetch(`/ai-providers.php?action=set-api-key&id=${selectedConnectionProvider.id}`, {
          method: 'PUT',
          body: JSON.stringify({ api_key: apiKeyInput }),
        });
        setApiKeyInput('');
      }
      await apiFetch('/ai-settings.php', {
        method: 'PUT',
        body: JSON.stringify({
          ai_active_provider_id: selectedConnectionProvider?.id ?? null,
          ai_default_model_id: selectedDefaultModel || null,
        }),
      });
      toast({ title: 'บันทึกการตั้งค่าสำเร็จ', description: `ใช้งาน ${selectedConnectionProvider?.display_name ?? '-'} แล้ว` });
      loadConnectionSettings();
      loadProviders();
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกการตั้งค่า', variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveFeatures = async () => {
    setSavingFeatures(true);
    try {
      await apiFetch('/ai-settings.php', {
        method: 'PUT',
        body: JSON.stringify({
          ...featureSettings,
          ai_chat_context_prompt: chatContextPrompt.trim() || null,
          ai_content_timeout: contentTimeout,
          ai_content_max_tokens: contentMaxTokens,
        }),
      });
      toast({ title: 'บันทึกการตั้งค่าฟีเจอร์ AI สำเร็จ' });
      loadConnectionSettings();
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleSelectProvider = (provider: AIProvider) => {
    setSelectedProvider(provider);
    loadModelsForProvider(provider.id);
  };

  const handleSaveProvider = async () => {
    try {
      if (!editingProvider?.display_name) {
        toast({ title: 'กรุณากรอกชื่อ provider', variant: 'destructive' });
        return;
      }
      const url = editingProvider.id ? `/ai-providers.php?id=${editingProvider.id}` : '/ai-providers.php';
      const method = editingProvider.id ? 'PUT' : 'POST';
      await apiFetch(url, { method, body: JSON.stringify(editingProvider) });
      toast({ title: 'บันทึกสำเร็จ' });
      setIsProviderDialogOpen(false);
      setEditingProvider(null);
      loadProviders();
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  const handleSaveModel = async () => {
    try {
      if (!editingModel?.name || !editingModel?.provider_id) {
        toast({ title: 'กรุณากรอกข้อมูลให้ครบ', variant: 'destructive' });
        return;
      }
      const url = editingModel.id ? `/ai-models.php?id=${editingModel.id}` : '/ai-models.php';
      const method = editingModel.id ? 'PUT' : 'POST';
      await apiFetch(url, { method, body: JSON.stringify(editingModel) });
      toast({ title: 'บันทึกสำเร็จ' });
      setIsModelDialogOpen(false);
      setEditingModel(null);
      if (selectedProvider) loadModelsForProvider(selectedProvider.id);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    const ok = await confirm({ title: 'ลบ Model', description: 'ต้องการลบ model นี้?', variant: 'destructive' });
    if (!ok) return;
    try {
      await apiFetch(`/ai-models.php?id=${modelId}`, { method: 'DELETE' });
      toast({ title: 'ลบสำเร็จ' });
      if (selectedProvider) loadModelsForProvider(selectedProvider.id);
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    }
  };

  const syncModelsForProvider = async (provider: AIProvider, onDone?: () => void) => {
    setSyncingModels(true);
    try {
      const result = await apiFetch<{ success: boolean; message: string; added: number; updated: number; total: number }>(
        `/ai-providers.php?action=sync-models&id=${provider.id}`,
        { method: 'POST' }
      );
      const syncedCount = (result as any).synced ?? result.total ?? result.added ?? 0;
      toast({ title: 'ซิงค์โมเดลสำเร็จ', description: result.message || `พบ ${syncedCount} โมเดล` });
      onDone?.();
      loadProviders();
      loadAllModels();
    } catch (err: unknown) {
      toast({
        title: 'ซิงค์โมเดลล้มเหลว',
        description: (err instanceof Error ? err.message : null) || 'ไม่สามารถดึงโมเดลจาก provider ได้',
        variant: 'destructive',
      });
    } finally {
      setSyncingModels(false);
    }
  };

  const handleSyncModels = () => {
    if (!selectedProvider) return;
    syncModelsForProvider(selectedProvider, () => loadModelsForProvider(selectedProvider.id));
  };

  const handleSyncConnectionModels = () => {
    if (!selectedConnectionProvider) return;
    syncModelsForProvider(selectedConnectionProvider, () => loadModelsForConnection(selectedConnectionProvider.id));
  };

  const filteredProviders = useMemo(
    () => providers.filter(p =>
      p.display_name.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase())
    ),
    [providers, search]
  );

  const activeProviderId = connectionSettings.ai_active_provider_id;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b overflow-x-auto">
        {([
          { key: 'connection' as ActiveTab, label: 'การเชื่อมต่อ', Icon: Settings2 },
          { key: 'providers' as ActiveTab, label: 'AI Providers', Icon: List },
          { key: 'models' as ActiveTab, label: `AI Models${selectedProvider ? ` — ${selectedProvider.display_name} (${models.length})` : ''}`, Icon: Cpu },
          { key: 'features' as ActiveTab, label: 'ตั้งค่าตามฟีเจอร์', Icon: Save },
        ]).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 font-medium text-sm border-b-2 whitespace-nowrap transition-colors ${
              activeTab === key ? 'border-blue-500 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ CONNECTION TAB ═══════════════════ */}
      {activeTab === 'connection' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>เลือกวิธีเชื่อมต่อ AI</CardTitle>
              <CardDescription>เลือก provider ที่ต้องการใช้งานและกำหนด API Key</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {providers.filter(p => p.is_active).map(provider => {
                    const isSelected = selectedConnectionProvider?.id === provider.id;
                    const isCurrent = activeProviderId === provider.id;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => handleSelectConnectionProvider(provider)}
                        className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:shadow-md ${
                          isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-border hover:border-blue-300'
                        }`}
                      >
                        {isCurrent && (
                          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3" /> ใช้งานอยู่
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <ProviderIcon name={provider.name} className="text-2xl" />
                          <span className="font-semibold text-sm">{provider.display_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{provider.description || provider.api_base_url}</p>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">{provider.model_count} models</Badge>
                          {provider.has_api_key
                            ? <Badge className="text-xs bg-green-600"><Wifi className="h-2.5 w-2.5 mr-1" />มี API Key</Badge>
                            : <Badge variant="secondary" className="text-xs"><WifiOff className="h-2.5 w-2.5 mr-1" />ยังไม่ตั้งค่า</Badge>
                          }
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedConnectionProvider && (
                <div className="rounded-xl border bg-muted/30 p-5 space-y-5">
                  <div className="flex items-center gap-2">
                    <ProviderIcon name={selectedConnectionProvider.name} className="text-xl" />
                    <h3 className="font-semibold">{selectedConnectionProvider.display_name} — Configuration</h3>
                  </div>

                  <div className="space-y-2">
                    <Label>API Base URL</Label>
                    <Input value={selectedConnectionProvider.api_base_url || '-'} readOnly className="bg-muted font-mono text-sm" />
                    <p className="text-xs text-muted-foreground">แก้ไขได้ในแท็บ "AI Providers"</p>
                  </div>

                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          placeholder={fetchingKey ? 'กำลังโหลด API Key...' : selectedConnectionProvider.has_api_key ? 'sk-...' : 'sk-...'}
                          value={apiKeyInput}
                          onChange={e => setApiKeyInput(e.target.value)}
                          className="pr-10 font-mono text-sm"
                        />
                        {apiKeyInput && (
                          <button type="button" onClick={() => setShowApiKey(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                      {fetchingKey ? (
                        <Button variant="outline" size="sm" disabled className="shrink-0 gap-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังโหลด
                        </Button>
                      ) : apiKeyInput ? (
                        <Button variant="outline" size="sm" onClick={handleSaveApiKey} className="shrink-0">บันทึก Key</Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Model เริ่มต้น</Label>
                      {selectedConnectionProvider.has_api_key && allModelsForProvider.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleSyncConnectionModels} disabled={syncingModels} className="gap-1.5 h-7 text-xs px-2">
                          {syncingModels ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          รีเฟรช
                        </Button>
                      )}
                    </div>
                    {allModelsForProvider.length === 0 ? (
                      <div className="space-y-2">
                        {selectedConnectionProvider.has_api_key ? (
                          <Button variant="outline" size="sm" onClick={handleSyncConnectionModels} disabled={syncingModels} className="gap-2">
                            {syncingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            ดึงโมเดลจาก {selectedConnectionProvider.display_name}
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">บันทึก API Key ก่อน แล้วกดดึงโมเดล</p>
                        )}
                      </div>
                    ) : (
                      <ModelCombobox
                        models={allModelsForProvider}
                        value={selectedDefaultModel}
                        onChange={setSelectedDefaultModel}
                        placeholder="เลือก model เริ่มต้น..."
                      />
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Button variant="outline" onClick={handleTestConnection}
                      disabled={testingConnection || !selectedConnectionProvider.has_api_key} className="gap-2 w-full sm:w-auto">
                      {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                      ทดสอบการเชื่อมต่อ
                    </Button>
                    {testResult && (
                      <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
                        {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                        {testResult.message}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveConnectionSettings} disabled={savingSettings || !selectedConnectionProvider} className="gap-2">
                  {savingSettings && <Loader2 className="h-4 w-4 animate-spin" />}
                  บันทึกการตั้งค่า
                </Button>
              </div>
            </CardContent>
          </Card>

          {activeProviderId && (
            <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="font-medium">ใช้งานอยู่:</span>
                  <Badge className="bg-green-600">{connectionSettings.provider_display_name ?? connectionSettings.provider_name}</Badge>
                  {connectionSettings.model_name && (
                    <><span className="text-muted-foreground">•</span><span>Model: <span className="font-medium">{connectionSettings.model_name}</span></span></>
                  )}
                  {connectionSettings.provider_base_url && (
                    <><span className="text-muted-foreground">•</span><span className="font-mono text-xs text-muted-foreground">{connectionSettings.provider_base_url}</span></>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════════ PROVIDERS TAB ═══════════════════ */}
      {activeTab === 'providers' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>AI Providers</CardTitle>
              <CardDescription>จัดการ AI service providers (Kilo Gateway, OpenRouter, etc.)</CardDescription>
            </div>
            <Button onClick={() => { setEditingProvider({ is_active: 1 }); setIsProviderDialogOpen(true); }} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />เพิ่ม Provider
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <Input placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : filteredProviders.length === 0 ? (
                <p className="text-sm text-center text-muted-foreground py-6">ไม่พบ provider</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อ</TableHead>
                        <TableHead>Display Name</TableHead>
                        <TableHead className="hidden md:table-cell">Base URL</TableHead>
                        <TableHead className="hidden md:table-cell">Models</TableHead>
                        <TableHead className="hidden sm:table-cell">API Key</TableHead>
                        <TableHead className="hidden sm:table-cell">สถานะ</TableHead>
                        <TableHead className="text-right">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProviders.map(provider => (
                        <TableRow key={provider.id} onClick={() => { handleSelectProvider(provider); setActiveTab('models'); }} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              <ProviderIcon name={provider.name} />
                              {provider.name}
                              {activeProviderId === provider.id && <Badge className="text-xs bg-green-600 ml-1">Active</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>{provider.display_name}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground max-w-[200px] truncate">{provider.api_base_url || '-'}</TableCell>
                          <TableCell className="hidden md:table-cell"><Badge variant="outline">{provider.model_count}</Badge></TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {provider.has_api_key
                              ? <Badge className="text-xs bg-green-600"><Wifi className="h-2.5 w-2.5 mr-1" />ตั้งค่าแล้ว</Badge>
                              : <Badge variant="secondary" className="text-xs"><WifiOff className="h-2.5 w-2.5 mr-1" />ยังไม่ตั้งค่า</Badge>
                            }
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant={provider.is_active ? 'default' : 'secondary'}>{provider.is_active ? 'Active' : 'Inactive'}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" className="h-8 w-8"
                              onClick={e => { e.stopPropagation(); setEditingProvider(provider); setIsProviderDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ MODELS TAB — provider picker ═══════════════════ */}
      {activeTab === 'models' && !selectedProvider && (
        <Card>
          <CardHeader>
            <CardTitle>AI Models</CardTitle>
            <CardDescription>เลือก provider เพื่อดูและจัดการโมเดล</CardDescription>
          </CardHeader>
          <CardContent>
            {providers.filter(p => p.is_active).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">ไม่พบ provider — เพิ่มใน AI Providers ก่อน</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {providers.filter(p => p.is_active).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProvider(p)}
                    className="flex items-center gap-3 rounded-xl border-2 p-4 text-left hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <ProviderIcon name={p.name} className="text-2xl" />
                    <div>
                      <div className="font-semibold text-sm">{p.display_name}</div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs">{p.model_count} models</Badge>
                        {p.has_api_key
                          ? <Badge className="text-xs bg-green-600"><Wifi className="h-2.5 w-2.5 mr-1" />มี Key</Badge>
                          : <Badge variant="secondary" className="text-xs"><WifiOff className="h-2.5 w-2.5 mr-1" />ไม่มี Key</Badge>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ MODELS TAB ═══════════════════ */}
      {activeTab === 'models' && selectedProvider && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>AI Models — {selectedProvider.display_name}</CardTitle>
              <CardDescription>จัดการ models สำหรับ {selectedProvider.display_name}</CardDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={handleSyncModels}
                disabled={syncingModels || !selectedProvider.has_api_key}
                className="gap-2"
                title={!selectedProvider.has_api_key ? 'ตั้งค่า API Key ก่อนซิงค์' : 'ดึงรายชื่อโมเดลทั้งหมดจาก provider'}
              >
                {syncingModels ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                ซิงค์โมเดล
              </Button>
              <Button onClick={() => { setEditingModel({ provider_id: selectedProvider.id }); setIsModelDialogOpen(true); }} className="gap-2">
                <Plus className="h-4 w-4" />เพิ่ม Model
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : models.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground py-6">ไม่พบ models</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model Name</TableHead>
                      <TableHead className="hidden md:table-cell">Model ID</TableHead>
                      <TableHead className="hidden lg:table-cell">Context</TableHead>
                      <TableHead className="hidden md:table-cell">Pricing</TableHead>
                      <TableHead className="hidden md:table-cell">Features</TableHead>
                      <TableHead className="text-right">จัดการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.map(model => (
                      <TableRow key={model.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{model.name}</div>
                          <div className="text-xs text-muted-foreground">{model.description?.substring(0, 60)}</div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {connectionSettings.ai_default_model_id === model.id && (
                              <Badge className="text-xs bg-blue-600">Default</Badge>
                            )}
                            {(model.input_price_per_1k ?? 1) === 0 && (model.output_price_per_1k ?? 1) === 0 && (
                              <Badge variant="secondary" className="text-xs gap-0.5">
                                <Sparkles className="h-2.5 w-2.5" />
                                ฟรี
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm font-mono">{model.model_id}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{model.context_window.toLocaleString()}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {(model.input_price_per_1k ?? -1) === 0 && (model.output_price_per_1k ?? -1) === 0 ? (
                            <Badge variant="secondary" className="text-xs gap-0.5">
                              <Sparkles className="h-2.5 w-2.5" />
                              ฟรี
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              ${Number(model.input_price_per_1k ?? 0).toFixed(4)} / ${Number(model.output_price_per_1k ?? 0).toFixed(4)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex gap-1 flex-wrap">
                            {model.supports_vision ? <Badge variant="outline" className="text-xs">Vision</Badge> : null}
                            {model.supports_streaming ? <Badge variant="outline" className="text-xs">Stream</Badge> : null}
                            {model.supports_function_calling ? <Badge variant="outline" className="text-xs">Func</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingModel(model); setIsModelDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteModel(model.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ FEATURES TAB ═══════════════════ */}
      {activeTab === 'features' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-semibold">ตั้งค่าโมเดล AI ตามฟีเจอร์</h3>
            <p className="text-sm text-muted-foreground mt-1">
              เลือกโมเดลเฉพาะสำหรับแต่ละฟีเจอร์ ถ้าไม่เลือกจะใช้โมเดลเริ่มต้นจากแท็บ "การเชื่อมต่อ"
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">บริบท AI Chat (Custom Context)</CardTitle>
              <CardDescription>
                กำหนดแนวทางการตอบ, โทนภาษา, โฟกัสงาน และข้อกำหนดเฉพาะองค์กรสำหรับผู้ช่วย AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="ai_chat_context_prompt" className="text-xs text-muted-foreground">ข้อความบริบทเพิ่มเติม</Label>
              <Textarea
                id="ai_chat_context_prompt"
                rows={6}
                className="mt-1"
                placeholder="ตัวอย่าง: ตอบแบบกระชับ, เน้นตัวเลข KPI, ให้สรุป actionable items 3 ข้อท้ายทุกครั้ง..."
                value={chatContextPrompt}
                onChange={(e) => setChatContextPrompt(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">พารามิเตอร์การสร้างคอนเทนท์</CardTitle>
              <CardDescription>
                กำหนดค่า timeout และจำนวนข้อความสูงสุดสำหรับ AI content generation (บทความ, caption, image brief, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="ai_content_timeout" className="text-xs text-muted-foreground">
                    Timeout (วินาที)
                  </Label>
                  <Input
                    id="ai_content_timeout"
                    type="number"
                    min={30}
                    max={600}
                    value={contentTimeout}
                    onChange={(e) => setContentTimeout(Math.max(30, Math.min(600, parseInt(e.target.value) || 300)))}
                  />
                  <p className="text-xs text-muted-foreground">
                    ระยะเวลาเชื่อมต่อสูงสุด 30-600 วินาที (ค่าเริ่มต้น 300)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai_content_max_tokens" className="text-xs text-muted-foreground">
                    Max Output Tokens
                  </Label>
                  <Input
                    id="ai_content_max_tokens"
                    type="number"
                    min={256}
                    max={8192}
                    value={contentMaxTokens}
                    onChange={(e) => setContentMaxTokens(Math.max(256, Math.min(8192, parseInt(e.target.value) || 8192)))}
                  />
                  <p className="text-xs text-muted-foreground">
                    จำนวน token สูงสุดที่ AI สร้าง 256-8192 (ค่าเริ่มต้น 8192)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {providers.filter(p => p.is_active).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                ยังไม่มี Provider — กรุณาเพิ่ม Provider และซิงค์โมเดลในแท็บ "AI Providers" ก่อน
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {AI_FEATURES.map(({ key, label, description, icon: Icon }) => {
                const selectedGatewayId = featureGateways[key] || null;
                const modelsForGateway = selectedGatewayId
                  ? allModels.filter(m => m.provider_id === selectedGatewayId)
                  : [];
                const activeProviders = providers.filter(p => p.is_active);
                return (
                  <Card key={key}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary" />
                        {label}
                      </CardTitle>
                      <CardDescription className="text-xs">{description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Step 1: Gateway */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">1. เลือก Gateway</label>
                        <Select
                          value={selectedGatewayId || '__none__'}
                          onValueChange={(val) => {
                            const gw = val === '__none__' ? null : val;
                            setFeatureGateways(prev => ({ ...prev, [key]: gw }));
                            // reset model when gateway changes
                            setFeatureSettings(prev => ({ ...prev, [key]: null }));
                          }}
                        >
                          <SelectTrigger className="w-full text-sm">
                            <SelectValue placeholder="เลือก Gateway..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— ใช้ Gateway เริ่มต้น —</SelectItem>
                            {activeProviders.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <span className="flex items-center gap-2">
                                  <ProviderIcon name={p.name} />
                                  {p.display_name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Step 2: Model */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">2. เลือก Model</label>
                        <ModelCombobox
                          models={modelsForGateway}
                          value={featureSettings[key] || '__default__'}
                          onChange={(val) =>
                            setFeatureSettings(prev => ({ ...prev, [key]: val === '__default__' ? null : val }))
                          }
                          placeholder={selectedGatewayId ? 'เลือก Model...' : 'เลือก Gateway ก่อน'}
                          disabled={!selectedGatewayId}
                          defaultValue="__default__"
                          defaultLabel="— ใช้โมเดลเริ่มต้น —"
                          emptyMessage="ไม่พบโมเดล — ซิงค์โมเดลในแท็บ AI Models ก่อน"
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSaveFeatures} disabled={savingFeatures} className="gap-2">
              {savingFeatures ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกการตั้งค่า
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════ PROVIDER DIALOG ═══════════════════ */}
      <Dialog open={isProviderDialogOpen} onOpenChange={(v) => { setIsProviderDialogOpen(v); if (!v) setEditingProvider(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProvider?.id ? 'แก้ไข Provider' : 'เพิ่ม Provider ใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>ชื่อ (Name)</Label>
              <Input placeholder="e.g., openrouter, kilo" value={editingProvider?.name || ''} onChange={e => setEditingProvider({ ...editingProvider, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input placeholder="e.g., OpenRouter, Kilo Gateway" value={editingProvider?.display_name || ''} onChange={e => setEditingProvider({ ...editingProvider, display_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>API Base URL</Label>
              <Input placeholder="https://openrouter.ai/api/v1" value={editingProvider?.api_base_url || ''} onChange={e => setEditingProvider({ ...editingProvider, api_base_url: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="รายละเอียดเกี่ยว provider" value={editingProvider?.description || ''} onChange={e => setEditingProvider({ ...editingProvider, description: e.target.value })} className="min-h-24" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(editingProvider?.is_active ?? 1) === 1} onCheckedChange={v => setEditingProvider({ ...editingProvider, is_active: v ? 1 : 0 })} />
              <Label>เปิดใช้งาน</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsProviderDialogOpen(false); setEditingProvider(null); }}>ยกเลิก</Button>
            <Button onClick={handleSaveProvider}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ MODEL DIALOG ═══════════════════ */}
      <Dialog open={isModelDialogOpen} onOpenChange={(v) => { setIsModelDialogOpen(v); if (!v) setEditingModel(null); }}>
        <DialogContent className="sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingModel?.id ? 'แก้ไข Model' : 'เพิ่ม Model ใหม่'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Model Name</Label>
              <Input placeholder="e.g., GPT-4 Turbo" value={editingModel?.name || ''} onChange={e => setEditingModel({ ...editingModel, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Model ID (API identifier)</Label>
              <Input placeholder="e.g., gpt-4-turbo" value={editingModel?.model_id || ''} onChange={e => setEditingModel({ ...editingModel, model_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="รายละเอียด model" value={editingModel?.description || ''} onChange={e => setEditingModel({ ...editingModel, description: e.target.value })} className="min-h-20" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Context Window</Label>
                <Input type="number" value={editingModel?.context_window || 4000} onChange={e => setEditingModel({ ...editingModel, context_window: parseInt(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Max Output Tokens</Label>
                <Input type="number" value={editingModel?.max_output_tokens || 2000} onChange={e => setEditingModel({ ...editingModel, max_output_tokens: parseInt(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Input Price (per 1K tokens)</Label>
                <Input type="number" step="0.0001" value={editingModel?.input_price_per_1k || 0} onChange={e => setEditingModel({ ...editingModel, input_price_per_1k: parseFloat(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Output Price (per 1K tokens)</Label>
                <Input type="number" step="0.0001" value={editingModel?.output_price_per_1k || 0} onChange={e => setEditingModel({ ...editingModel, output_price_per_1k: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Features</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={(editingModel?.supports_vision ?? 0) === 1} onCheckedChange={v => setEditingModel({ ...editingModel, supports_vision: v ? 1 : 0 })} />
                  <Label className="font-normal">Vision</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={(editingModel?.supports_streaming ?? 1) === 1} onCheckedChange={v => setEditingModel({ ...editingModel, supports_streaming: v ? 1 : 0 })} />
                  <Label className="font-normal">Streaming</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={(editingModel?.supports_function_calling ?? 0) === 1} onCheckedChange={v => setEditingModel({ ...editingModel, supports_function_calling: v ? 1 : 0 })} />
                  <Label className="font-normal">Function Calling</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={(editingModel?.supports_tool_calling ?? 0) === 1} onCheckedChange={v => setEditingModel({ ...editingModel, supports_tool_calling: v ? 1 : 0 })} />
                  <Label className="font-normal">Tool Calling</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsModelDialogOpen(false); setEditingModel(null); }}>ยกเลิก</Button>
            <Button onClick={handleSaveModel}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
