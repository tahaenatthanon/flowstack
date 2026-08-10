import { useCrossProjectImpact } from '@/hooks/useProjectData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { th } from 'date-fns/locale';
import { Alert, AlertDescription } from '@/components/ui/alert';

function getDepTypeLabel(type: string): string {
  return type === 'blocks' ? 'บล็อกงาน' : 'รอขึ้นอยู่กับ';
}

interface CrossProjectImpactViewProps {
  activeOnly?: boolean;
}

const CrossProjectImpactView = ({ activeOnly = true }: CrossProjectImpactViewProps) => {
  const { data: impacts = [], isLoading } = useCrossProjectImpact(activeOnly);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          กำลังโหลดข้อมูล Impact...
        </CardContent>
      </Card>
    );
  }

  const activeImpacts = impacts.filter(i => i.is_active === 1);
  const resolvedImpacts = impacts.filter(i => i.is_active === 0);

  if (impacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-accent" />
            ผลกระทบข้ามโปรเจกต์
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="w-4 h-4 text-success" />
            <AlertDescription>
              ไม่มีงานที่ Block กันระหว่างโปรเจกต์ในขณะนี้
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-heading flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-accent" />
            ผลกระทบข้ามโปรเจกต์ (Cross-Project Impact)
          </h2>
          <p className="text-muted-foreground">งานที่ Block กันระหว่างโปรเจกต์</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Active: {activeImpacts.length}
          </Badge>
          {!activeOnly && resolvedImpacts.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              Resolved: {resolvedImpacts.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Active Impacts */}
      {activeImpacts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-warning flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            งานที่กำลัง Block อยู่ ({activeImpacts.length})
          </h3>
          {activeImpacts.map(impact => (
            <Card key={impact.dependency_id} className="border-warning/30">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="destructive" className="text-xs">
                          {getDepTypeLabel(impact.dependency_type)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {impact.created_at && isValid(parseISO(impact.created_at)) ? format(parseISO(impact.created_at), 'd MMM yyyy HH:mm', { locale: th }) : '-'}
                      </p>
                    </div>
                    <Badge className="gap-1 bg-warning/10 text-warning border-warning/30">
                      <GitBranch className="w-3 h-3" />
                      Cross-Project
                    </Badge>
                  </div>

                  {/* งานที่ถูก Block */}
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded bg-destructive/10">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-destructive mb-1">งานที่ถูก Block</p>
                        <p className="font-medium">{impact.task_title}</p>
                        <p className="text-sm text-muted-foreground">โปรเจกต์: {impact.task_project_name}</p>
                      </div>
                    </div>
                  </div>

                  {/* งานที่ Block (งานแทรก) */}
                  <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 rounded bg-warning/10">
                        <Clock className="w-4 h-4 text-warning" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-warning mb-1">งานที่ Block (งานแทรก)</p>
                        <p className="font-medium">{impact.depends_on_title}</p>
                        <p className="text-sm text-muted-foreground">
                          โปรเจกต์: {impact.depends_on_project_name} · ผู้รับผิดชอบ: {impact.assignee}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ผลกระทบ */}
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <p className="text-muted-foreground">
                      งาน <strong>{impact.task_title}</strong>{' '}
                      {impact.dependency_type === 'blocks' ? 'ถูกบล็อกโดย' : 'รอขึ้นอยู่กับ'}{' '}
                      <strong>{impact.depends_on_title}</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resolved Impacts */}
      {!activeOnly && resolvedImpacts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            งานที่แก้ไขแล้ว ({resolvedImpacts.length})
          </h3>
          {resolvedImpacts.map(impact => (
            <Card key={impact.dependency_id} className="opacity-60">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium line-through text-muted-foreground">
                        {impact.task_title} ← {impact.depends_on_title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {impact.task_project_name} ← {impact.depends_on_project_name}
                      </p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Resolved
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    แก้ไขเมื่อ: {impact.resolved_at ? format(parseISO(impact.resolved_at), 'd MMM yyyy HH:mm', { locale: th }) : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CrossProjectImpactView;
