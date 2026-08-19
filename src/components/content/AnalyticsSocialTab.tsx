import { Users, Heart, Radio, Percent, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * sub-tab "โซเชียล" — โครงหน้าจริงแต่ยังไม่มีแหล่งข้อมูล
 *
 * ระบบยังไม่มีตารางเก็บ followers/reach/impressions และไม่มี ingestion จาก
 * แพลตฟอร์มใด ๆ จึงแสดงค่าเป็น em dash ตรงไปตรงมา — ห้ามใส่ mock data หรือ
 * ตัวเลข hardcode เพราะจะทำให้ผู้ใช้เข้าใจผิดว่ามีข้อมูลแล้ว
 */

const PLACEHOLDER_VALUE = '—';
const PLACEHOLDER_HINT = 'ยังไม่ได้เชื่อมต่อแหล่งข้อมูล';

const SOCIAL_STAT_CARDS = [
  { key: 'followers',  label: 'ผู้ติดตามรวม',   icon: Users,   color: 'text-blue-600' },
  { key: 'engagement', label: 'Engagement รวม', icon: Heart,   color: 'text-pink-600' },
  { key: 'reach',      label: 'Reach รวม',      icon: Radio,   color: 'text-violet-600' },
  { key: 'rate',       label: 'Engagement Rate', icon: Percent, color: 'text-amber-600' },
];

export function AnalyticsSocialTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SOCIAL_STAT_CARDS.map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">{PLACEHOLDER_VALUE}</div>
                <p className="mt-1 text-xs text-muted-foreground">{PLACEHOLDER_HINT}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">ทำไมยังไม่มีตัวเลข</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            เมตริกกลุ่มโซเชียล (ผู้ติดตาม, Reach, Impressions) ต้องดึงจาก API ของแพลตฟอร์มโดยตรง
            เช่น Facebook Graph API, Instagram Graph API และ TikTok API หรือกรอกข้อมูลย้อนหลังเข้าระบบเอง
          </p>
          <p>
            ปัจจุบันระบบยังไม่มีตารางเก็บค่า followers/reach/impressions และยังไม่ได้เชื่อมต่อ
            OAuth หรือ cron sync กับแพลตฟอร์มใด ๆ จึงยังไม่มีตัวเลขให้แสดง
          </p>
          <p className="text-foreground">
            หน้านี้เตรียมโครงไว้ก่อน และจะเปิดใช้งานจริงในเฟสถัดไปเมื่อเชื่อมต่อแหล่งข้อมูลเรียบร้อยแล้ว
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
