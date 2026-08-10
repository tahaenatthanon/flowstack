import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIGatewaySettings } from '@/hooks/useContent';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Image, Video, Bot, Settings2, Rss, Loader2 } from 'lucide-react';
import ChannelManagementSection from './ChannelManagementSection';

export default function AISettingsTab() {
  const navigate = useNavigate();

  // ── AI Models from Admin Settings (read-only) ─────────────────────────────
  const { data: gwSettings } = useAIGatewaySettings();

  const MODEL_INFO: Array<{
    icon: React.ElementType; iconColor: string; bgColor: string;
    label: string; sub: string;
    nameProp: 'content_text_model_name' | 'content_image_model_name' | 'content_video_model_name';
  }> = [
    { icon: FileText, iconColor: 'text-blue-600',   bgColor: 'bg-blue-100 dark:bg-blue-950',    label: 'คอนเทนท์ข้อความ', sub: 'แผนคอนเทนต์ · แคปชั่น · บทความ', nameProp: 'content_text_model_name'  },
    { icon: Image,    iconColor: 'text-violet-600', bgColor: 'bg-violet-100 dark:bg-violet-950', label: 'คอนเทนท์ภาพ',     sub: 'Image Brief · Alt Text',        nameProp: 'content_image_model_name' },
    { icon: Video,    iconColor: 'text-red-600',    bgColor: 'bg-red-100 dark:bg-red-950',       label: 'คอนเทนท์วิดีโอ',  sub: 'สคริปต์ · คำบรรยาย',            nameProp: 'content_video_model_name' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Active AI Models (read-only) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />AI ที่ใช้งานอยู่
            </CardTitle>
            <a href="#/admin" className="text-xs text-primary hover:underline flex items-center gap-1">
              <Settings2 className="h-3 w-3" />เปลี่ยนที่ Admin › AI Settings
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-1">โมเดลที่กำหนดไว้ใน Admin › AI Settings › ตั้งค่าโมเดล AI ตามฟีเจอร์ สร้างคอนเทนท์</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Provider banner */}
          {gwSettings?.provider_display_name ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-xs flex-wrap">
              <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
              <span className="font-medium text-green-800 dark:text-green-300">{gwSettings.provider_display_name}</span>
              {gwSettings.provider_base_url && (
                <span className="font-mono text-green-600 dark:text-green-500 truncate">{gwSettings.provider_base_url}</span>
              )}
              {gwSettings.model_name && (
                <><span className="text-green-600">·</span><span className="text-green-700 dark:text-green-400">Default: {gwSettings.model_name}</span></>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              ⚠ ยังไม่ได้ตั้งค่า AI Provider — <a href="#/admin" className="underline font-medium">ไปที่ Admin › AI Settings</a>
            </div>
          )}
          {/* Per-feature model rows */}
          <div className="space-y-1.5">
            {MODEL_INFO.map(({ icon: Icon, iconColor, bgColor, label, sub, nameProp }) => {
              const modelName = gwSettings?.[nameProp] ?? null;
              const fallback  = gwSettings?.model_name ?? null;
              return (
                <div key={nameProp} className="flex items-center gap-3 p-2.5 border rounded-lg bg-background">
                  <div className={`p-1.5 rounded-lg shrink-0 ${bgColor}`}><Icon className={`h-3.5 w-3.5 ${iconColor}`} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{sub}</p>
                  </div>
                  {modelName
                    ? <span className="text-xs font-medium bg-muted px-2 py-0.5 rounded truncate max-w-[180px]">{modelName}</span>
                    : fallback
                      ? <span className="text-xs text-muted-foreground">default: {fallback}</span>
                      : <span className="text-xs text-muted-foreground italic">— ไม่ได้กำหนด —</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Brand Setting link ── */}
      <div className="rounded-lg border border-dashed p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">คำสั่งหลัก และสินค้าอ้างอิง</p>
          <p className="text-xs text-muted-foreground mt-0.5">จัดการ Global Instruction และ Product References ได้ที่ ตั้งค่าแบรนด์</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/brand-setting')}>
          ไปที่ตั้งค่าแบรนด์ →
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Rss className="h-4 w-4 text-green-600" />ช่องทางเผยแพร่</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelManagementSection />
        </CardContent>
      </Card>
    </div>
  );
}
