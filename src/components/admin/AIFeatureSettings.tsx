import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, MessageSquare, FileText, CreditCard, BarChart3, Save, Image, Video, UserSearch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import ModelCombobox from '@/components/ModelCombobox';

interface AIModel {
  id: string;
  provider_id: string;
  model_id: string;
  name: string;
  provider_name?: string;
}

interface FeatureSettings {
  ai_chat_model_id: string | null;
  ai_content_text_model_id: string | null;
  ai_content_image_model_id: string | null;
  ai_content_video_model_id: string | null;
  ai_cardscan_model_id: string | null;
  ai_analyst_model_id: string | null;
  ai_lead_model_id: string | null;
}

const FEATURES = [
  {
    key: 'ai_chat_model_id' as const,
    label: 'AI Chat',
    description: 'โมเดลสำหรับแชทผู้ช่วย AI',
    icon: MessageSquare,
  },
  {
    key: 'ai_content_text_model_id' as const,
    label: 'คอนเทนท์ข้อความ',
    description: 'โมเดลสำหรับสร้างบทความ แคปชั่น และเนื้อหาข้อความ',
    icon: FileText,
  },
  {
    key: 'ai_content_image_model_id' as const,
    label: 'คอนเทนท์ภาพ',
    description: 'โมเดลสำหรับสร้างเนื้อหาที่เกี่ยวกับภาพ (Image Brief / Alt Text)',
    icon: Image,
  },
  {
    key: 'ai_content_video_model_id' as const,
    label: 'คอนเทนท์วิดีโอ',
    description: 'โมเดลสำหรับสร้างสคริปต์และคำบรรยายวิดีโอ',
    icon: Video,
  },
  {
    key: 'ai_cardscan_model_id' as const,
    label: 'แสกนนามบัตร',
    description: 'โมเดลสำหรับอ่านและแปลงข้อมูลนามบัตร',
    icon: CreditCard,
  },
  {
    key: 'ai_analyst_model_id' as const,
    label: 'AI Analyst งานและโปรเจค',
    description: 'โมเดลสำหรับวิเคราะห์งานและโครงการ',
    icon: BarChart3,
  },
  {
    key: 'ai_lead_model_id' as const,
    label: 'ค้นหาลูกค้าใหม่ (Lead Generation)',
    description: 'โมเดลสำหรับค้นหา leads จากอินเทอร์เน็ต และสกัด/สรุปอีเมลเป็น lead',
    icon: UserSearch,
  },
];

export default function AIFeatureSettings() {
  const { toast } = useToast();
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [settings, setSettings] = useState<FeatureSettings>({
    ai_chat_model_id: null,
    ai_content_text_model_id: null,
    ai_content_image_model_id: null,
    ai_content_video_model_id: null,
    ai_cardscan_model_id: null,
    ai_analyst_model_id: null,
    ai_lead_model_id: null,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load all active models across providers
    apiFetch('/ai-models.php?active=1')
      .then((data: AIModel[]) => setModels(Array.isArray(data) ? data : []))
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));

    // Load current settings
    apiFetch('/ai-settings.php')
      .then((data: any) => {
        setSettings({
          ai_chat_model_id:          data.ai_chat_model_id          || null,
          ai_content_text_model_id:  data.ai_content_text_model_id  || null,
          ai_content_image_model_id: data.ai_content_image_model_id || null,
          ai_content_video_model_id: data.ai_content_video_model_id || null,
          ai_cardscan_model_id:      data.ai_cardscan_model_id      || null,
          ai_analyst_model_id:       data.ai_analyst_model_id       || null,
          ai_lead_model_id:          data.ai_lead_model_id          || null,
        });
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch('/ai-settings.php', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      toast({ title: 'บันทึกการตั้งค่า AI สำเร็จ' });
    } catch {
      toast({ title: 'เกิดข้อผิดพลาด', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">การตั้งค่าโมเดล AI ตามฟีเจอร์</h3>
        <p className="text-sm text-muted-foreground mt-1">
          เลือกโมเดล AI ที่ต้องการใช้งานสำหรับแต่ละฟีเจอร์ในระบบ (ถ้าไม่เลือกจะใช้โมเดลเริ่มต้น)
        </p>
      </div>

      {loadingModels ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>กำลังโหลดโมเดล...</span>
        </div>
      ) : models.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            ไม่พบโมเดล AI กรุณาตั้งค่า Provider และเพิ่มโมเดลก่อน
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURES.map(({ key, label, description, icon: Icon }) => (
            <Card key={key}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Icon className="w-4 h-4 text-primary" />
                  {label}
                </CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Label className="text-xs mb-1.5 block">โมเดลที่ใช้งาน</Label>
                <ModelCombobox
                  models={models}
                  value={settings[key] || '__default__'}
                  onChange={(val) =>
                    setSettings((prev) => ({ ...prev, [key]: val === '__default__' ? null : val }))
                  }
                  placeholder="ใช้โมเดลเริ่มต้น"
                  defaultValue="__default__"
                  defaultLabel="— ใช้โมเดลเริ่มต้น —"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          บันทึกการตั้งค่า
        </Button>
      </div>
    </div>
  );
}
