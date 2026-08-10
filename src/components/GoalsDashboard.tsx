import { useState, useEffect } from 'react';
import { DbGoal } from '@/types/project';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Target, TrendingUp, AlertTriangle, CheckCircle2, ChevronRight, Link2 } from 'lucide-react';

interface GoalsDashboardProps {
  goals: DbGoal[];
  onGoalClick?: (goal: DbGoal) => void;
  onAddGoal?: () => void;
}

export function GoalsDashboard({ goals, onGoalClick, onAddGoal }: GoalsDashboardProps) {
  const [activeGoals, setActiveGoals] = useState<DbGoal[]>([]);
  const [completedGoals, setCompletedGoals] = useState<DbGoal[]>([]);
  const [atRiskGoals, setAtRiskGoals] = useState<DbGoal[]>([]);

  useEffect(() => {
    // Filter goals by status
    setActiveGoals(goals.filter(g => g.status === 'active'));
    setCompletedGoals(goals.filter(g => g.status === 'completed'));
    setAtRiskGoals(goals.filter(g => g.status === 'at_risk'));
  }, [goals]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'at_risk': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />เสร็จสิ้น</Badge>;
      case 'at_risk':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />เสี่ยง</Badge>;
      default:
        return <Badge>กำลังดำเนินการ</Badge>;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-primary';
    if (progress >= 50) return 'bg-warning';
    return 'bg-destructive';
  };

  // Stats
  const totalGoals = goals.length;
  const completedCount = completedGoals.length;
  const avgProgress = goals.length > 0 
    ? Math.round(goals.reduce((sum, g) => sum + (g.progress_percentage || g.calculated_progress || 0), 0) / goals.length)
    : 0;

  // Root goals only (not child goals)
  const rootGoals = goals.filter(g => !g.parent_goal_id);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">เป้าหมายทั้งหมด</p>
                <p className="text-2xl font-bold">{totalGoals}</p>
              </div>
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">เสร็จสิ้น</p>
                <p className="text-2xl font-bold text-green-500">{completedCount}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">เสี่ยง</p>
                <p className="text-2xl font-bold text-red-500">{atRiskGoals.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">ความคืบหน้าเฉลี่ย</p>
                <p className="text-2xl font-bold">{avgProgress}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals List */}
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">ทั้งหมด ({rootGoals.length})</TabsTrigger>
            <TabsTrigger value="active">กำลังดำเนินการ ({activeGoals.length})</TabsTrigger>
            <TabsTrigger value="completed">เสร็จสิ้น ({completedGoals.length})</TabsTrigger>
            <TabsTrigger value="at_risk">เสี่ยง ({atRiskGoals.length})</TabsTrigger>
          </TabsList>
          
          {onAddGoal && (
            <Button onClick={onAddGoal}>
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มเป้าหมาย
            </Button>
          )}
        </div>

        <TabsContent value="all" className="space-y-4">
          {renderGoalsList(rootGoals)}
        </TabsContent>
        
        <TabsContent value="active" className="space-y-4">
          {renderGoalsList(activeGoals.filter(g => !g.parent_goal_id))}
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          {renderGoalsList(completedGoals.filter(g => !g.parent_goal_id))}
        </TabsContent>
        
        <TabsContent value="at_risk" className="space-y-4">
          {renderGoalsList(atRiskGoals.filter(g => !g.parent_goal_id))}
        </TabsContent>
      </Tabs>
    </div>
  );

  function renderGoalsList(goalsToRender: DbGoal[]) {
    if (goalsToRender.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>ไม่มีเป้าหมาย</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {goalsToRender.map(goal => (
          <Card 
            key={goal.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onGoalClick?.(goal)}
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusBadge(goal.status)}
                    <Badge variant="outline">{goal.goal_type}</Badge>
                    {goal.child_goal_count > 0 && (
                      <Badge variant="secondary">
                        <Link2 className="w-3 h-3 mr-1" />
                        {goal.child_goal_count} เป้าหมายย่อย
                      </Badge>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-lg mb-1">{goal.title}</h3>
                  {goal.description && (
                    <p className="text-sm text-muted-foreground mb-3">{goal.description}</p>
                  )}
                  
                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">ความคืบหน้า</span>
                      <span className="font-medium">
                        {goal.calculated_progress || goal.progress_percentage || 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${getProgressColor(goal.calculated_progress || goal.progress_percentage || 0)}`}
                        style={{ width: `${goal.calculated_progress || goal.progress_percentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    {goal.target_value && (
                      <span>
                        เป้าหมาย: {goal.current_value || 0} / {goal.target_value} {goal.unit}
                      </span>
                    )}
                    {goal.task_count > 0 && (
                      <span>{goal.task_count} งาน</span>
                    )}
                    {goal.end_date && (
                      <span>สิ้นสุด: {new Date(goal.end_date).toLocaleDateString('th-TH')}</span>
                    )}
                  </div>
                </div>
                
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>

              {/* Child Goals Preview */}
              {goal.child_goals && goal.child_goals.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">เป้าหมายย่อย</p>
                  <div className="space-y-2">
                    {goal.child_goals.slice(0, 3).map(child => (
                      <div key={child.id} className="flex items-center justify-between text-sm">
                        <span>{child.title}</span>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getProgressColor(child.progress_percentage || 0)}`}
                            style={{ width: `${child.progress_percentage || 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
}

export default GoalsDashboard;
