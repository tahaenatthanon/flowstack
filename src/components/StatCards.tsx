import { ProjectReport } from '@/types/project';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Calendar, ListTodo } from 'lucide-react';

interface StatCardsProps {
  report: ProjectReport;
}

const StatCards = ({ report }: StatCardsProps) => {
  const stats = [
    {
      label: 'ความคืบหน้า',
      value: `${report.completionPercentage}%`,
      icon: TrendingUp,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      label: 'วันที่ใช้ไป',
      value: `${report.daysUsed} วัน`,
      subtitle: `จาก ${report.totalDays} วัน`,
      icon: Calendar,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      label: 'วันคงเหลือ',
      value: `${report.daysRemaining} วัน`,
      icon: Clock,
      color: report.daysRemaining < 10 ? 'text-destructive' : 'text-warning',
      bgColor: report.daysRemaining < 10 ? 'bg-destructive/10' : 'bg-warning/10',
    },
    {
      label: 'งานเสร็จแล้ว',
      value: `${report.completedTasks.length}`,
      subtitle: `จาก ${report.completedTasks.length + report.inProgressTasks.length + report.pendingTasks.length + report.overdueTasks.length + report.cancelledTasks.length} งาน`,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'กำลังดำเนินการ',
      value: `${report.inProgressTasks.length}`,
      icon: ListTodo,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      label: 'เลยกำหนด',
      value: `${report.overdueTasks.length}`,
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="stat-card card-hover p-3 sm:p-5">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stat.color}`} />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-heading">{stat.value}</p>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
          {stat.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{stat.subtitle}</p>
          )}
        </div>
      ))}
    </div>
  );
};

export default StatCards;
