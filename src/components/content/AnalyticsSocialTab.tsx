import { Users, Heart, Radio, Percent, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SocialEngagementSummary } from './types';

/**
 * sub-tab "โซเชียล"
 *
 * "Engagement รวม" ใช้ข้อมูลจริงจากตาราง time-series `content_post_metrics`
 * (cron `content-metrics-sync`) ซึ่งครอบคลุมเฉพาะ Facebook/Instagram
 *
 * การ์ดที่เหลือ (followers/reach/rate) ยังไม่มีแหล่งข้อมูล — ระบบไม่มีตารางเก็บ
 * followers/reach/impressions จึงแสดงเป็น em dash ตรงไปตรงมา
 * ห้ามใส่ mock data หรือตัวเลข hardcode เพราะจะทำให้ผู้ใช้เข้าใจผิดว่ามีข้อมูลแล้ว
 */

const PLACEHOLDER_VALUE = '—';
const PLACEHOLDER_HINT = 'ยังไม่ได้เชื่อมต่อแหล่งข้อมูล';

interface Props {
  /** จาก `useContentAnalytics` — ส่งเป็น prop ตามแบบ AnalyticsContentTab (query เดียวต่อหน้า) */
  social?: SocialEngagementSummary;
  socialLoading?: boolean;
}

export function AnalyticsSocialTab({ social, socialLoading = false }: Props) {
  // ยังไม่ซิงก์เลย → "—" ไม่ใช่ 0 เพราะ 0 อ่านได้ว่า "ไม่มีคนมีปฏิสัมพันธ์"
  // ซึ่งต่างจาก "ยังไม่ได้วัด"
  const engagementValue = socialLoading
    ? 'กำลังโหลด...'
    : social?.has_data
      ? social.engagement.toLocaleString()
      : PLACEHOLDER_VALUE;

  const engagementHint = socialLoading
    ? null
    : social?.has_data
      ? `เฉพาะ Facebook/Instagram · ${social.posts.toLocaleString()} โพสต์ · `
        + `${social.views.toLocaleString()} วิว + ${social.likes.toLocaleString()} ไลก์`
      : 'เฉพาะ Facebook/Instagram — ยังไม่มีโพสต์ที่ซิงก์ข้อมูลแล้ว';

  const socialStatCards = [
    { key: 'followers',  label: 'ผู้ติดตามรวม',    value: PLACEHOLDER_VALUE, hint: PLACEHOLDER_HINT, icon: Users,   color: 'text-blue-600' },
    { key: 'engagement', label: 'Engagement รวม',  value: engagementValue,   hint: engagementHint,   icon: Heart,   color: 'text-pink-600' },
    { key: 'reach',      label: 'Reach รวม',       value: PLACEHOLDER_VALUE, hint: PLACEHOLDER_HINT, icon: Radio,   color: 'text-violet-600' },
    { key: 'rate',       label: 'Engagement Rate', value: PLACEHOLDER_VALUE, hint: PLACEHOLDER_HINT, icon: Percent, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {socialStatCards.map(card => {
          const Icon = card.icon;
          const isPlaceholder = card.value === PLACEHOLDER_VALUE;
          return (
            <Card key={card.key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${isPlaceholder ? 'text-muted-foreground' : ''}`}>
                  {card.value}
                </div>
                {card.hint && <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">ตัวเลขนี้ครอบคลุมอะไร</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="text-foreground">Engagement รวม</span> = วิว + ไลก์ ของโพสต์
            <span className="text-foreground"> เฉพาะ Facebook และ Instagram </span>
            ที่เผยแพร่ในช่วงวันที่ที่เลือก ดึงกลับจาก Graph API โดยงานซิงก์อัตโนมัติ
            (ไม่รวม TikTok, LINE OA, LinkedIn, X และเว็บไซต์ — แพลตฟอร์มเหล่านั้นยังไม่ได้เชื่อมต่อ)
            {social?.last_fetched_at && (
              <> · ซิงก์ล่าสุด {new Date(social.last_fetched_at).toLocaleString('th-TH')}</>
            )}
          </p>
          <p>
            <span className="text-foreground">ผู้ติดตามรวม, Reach รวม, Engagement Rate</span> ยังไม่มีตัวเลข
            เพราะเป็นเมตริกระดับเพจ (ไม่ใช่ระดับโพสต์) ระบบยังไม่มีตารางเก็บค่า followers/reach/impressions
            และยังไม่ได้เชื่อมต่อ OAuth เพื่อดึงข้อมูลระดับเพจ
          </p>
          <p>
            ถ้า Engagement รวม แสดง "—" หมายความว่ายังไม่มีโพสต์ Facebook/Instagram
            ที่ซิงก์ข้อมูลสำเร็จ — ไม่ได้หมายความว่าไม่มีคนมีปฏิสัมพันธ์
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
