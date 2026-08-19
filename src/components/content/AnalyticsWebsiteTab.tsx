import { Globe, Users, Eye, Percent, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * sub-tab "เว็บไซต์" — โครงหน้าจริงแต่ยังไม่มีแหล่งข้อมูล
 *
 * ระบบยังไม่มี integration กับ Google Analytics 4 / Search Console และไม่มี
 * ตารางเก็บ traffic/sessions/pageviews จึงแสดงค่าเป็น em dash ตรงไปตรงมา —
 * ห้ามใส่ mock data หรือตัวเลข hardcode
 */

const PLACEHOLDER_VALUE = '—';
const PLACEHOLDER_HINT = 'ยังไม่ได้เชื่อมต่อแหล่งข้อมูล';

const WEBSITE_STAT_CARDS = [
  { key: 'traffic',    label: 'Traffic รวม',     icon: Globe,   color: 'text-blue-600' },
  { key: 'visitors',   label: 'ผู้เข้าชม',        icon: Users,   color: 'text-teal-600' },
  { key: 'pageviews',  label: 'Page Views',      icon: Eye,     color: 'text-cyan-600' },
  { key: 'conversion', label: 'Conversion Rate', icon: Percent, color: 'text-amber-600' },
];

export function AnalyticsWebsiteTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {WEBSITE_STAT_CARDS.map(card => {
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
            เมตริกกลุ่มเว็บไซต์ (Traffic, ผู้เข้าชม, Page Views, Conversion Rate) ต้องดึงจาก
            Google Analytics 4 และ Google Search Console
          </p>
          <p>
            ปัจจุบันระบบยังไม่มี integration กับสองบริการนี้ และยังไม่มีตารางเก็บข้อมูล traffic
            จึงยังไม่มีตัวเลขให้แสดง
          </p>
          <p className="text-foreground">
            หน้านี้เตรียมโครงไว้ก่อน และจะเปิดใช้งานจริงในเฟสถัดไปเมื่อเชื่อมต่อแหล่งข้อมูลเรียบร้อยแล้ว
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
