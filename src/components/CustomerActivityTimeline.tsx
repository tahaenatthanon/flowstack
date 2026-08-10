import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, APP_URL } from '@/lib/api';

import { CUSTOMER_ACTIVITY_LABELS } from '@/lib/labels';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, MousePointerClick, Send, AlertCircle, UserPlus, Megaphone, Activity, Copy } from 'lucide-react';
import { copyToClipboard } from '@/components/content/views/CopyButton';

interface CustomerActivity {
  id: string;
  customer_id: string;
  activity_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string | null;
}

interface Props {
  customerId: string;
}



const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  email_sent:     { label: CUSTOMER_ACTIVITY_LABELS.email_sent,     icon: Send,           color: 'bg-blue-100 text-blue-700' },
  email_opened:   { label: CUSTOMER_ACTIVITY_LABELS.email_opened,   icon: Mail,           color: 'bg-green-100 text-green-700' },
  email_clicked:  { label: CUSTOMER_ACTIVITY_LABELS.email_clicked,  icon: MousePointerClick, color: 'bg-purple-100 text-purple-700' },
  email_replied:  { label: CUSTOMER_ACTIVITY_LABELS.email_replied,  icon: Mail,           color: 'bg-teal-100 text-teal-700' },
  email_bounced:  { label: CUSTOMER_ACTIVITY_LABELS.email_bounced,  icon: AlertCircle,    color: 'bg-red-100 text-red-700' },
  campaign_created: { label: CUSTOMER_ACTIVITY_LABELS.campaign_created, icon: Megaphone,      color: 'bg-orange-100 text-orange-700' },
  group_added:    { label: CUSTOMER_ACTIVITY_LABELS.group_added,    icon: UserPlus,       color: 'bg-indigo-100 text-indigo-700' },
  survey_sent:    { label: CUSTOMER_ACTIVITY_LABELS.survey_sent,    icon: Send,           color: 'bg-cyan-100 text-cyan-700' },
};

export default function CustomerActivityTimeline({ customerId }: Props) {
  const [typeFilter, setTypeFilter] = useState<string>('__none__');

  const { data, isLoading } = useQuery({
    queryKey: ['customer-activities', customerId, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ customer_id: customerId, limit: '100' });
      if (typeFilter && typeFilter !== '__none__') params.set('type', typeFilter);
      return apiFetch<{ activities: CustomerActivity[]; total: number }>(
        `/customer-activities.php?${params.toString()}`
      );
    },
    enabled: !!customerId,
  });

  const activities = data?.activities ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            ประวัติกิจกรรม
            {data?.total != null && (
              <Badge variant="secondary" className="ml-1">{data.total}</Badge>
            )}
          </CardTitle>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="ทุกประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">ทุกประเภท</SelectItem>
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">กำลังโหลด...</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีกิจกรรม</p>
        ) : (
          <ScrollArea className="h-80">
            <div className="space-y-3">
              {activities.map((act) => {
                const cfg = TYPE_CONFIG[act.activity_type] ?? {
                  label: act.activity_type,
                  icon: Activity,
                  color: 'bg-gray-100 text-gray-700',
                };
                const Icon = cfg.icon;
                return (
                  <div key={act.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`rounded-full p-1.5 shrink-0 ${cfg.color}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cfg.label}</p>
                      {act.details && typeof act.details === 'object' && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {act.details.subject as string || act.details.campaign_name as string || ''}
                        </p>
                      )}
                      {act.activity_type === 'survey_sent' && act.details?.token && (
                        <div className="flex items-center gap-2 mt-2">
                          <a href={`${APP_URL}/#/survey/public/${act.details.token}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">ดูแบบสำรวจ</a>
                          <button type="button" onClick={() => copyToClipboard(`${APP_URL}/#/survey/public/${act.details.token}`)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <Copy className="h-3 w-3" /> คัดลอกลิงก์
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(act.created_at).toLocaleDateString('th-TH', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
