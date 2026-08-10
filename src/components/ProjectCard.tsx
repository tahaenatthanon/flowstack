import { DbProject, DbTask } from '@/types/project';
import { calculateProjectReport, deriveProjectStatus, getProjectStatusColor, getStatusLabel } from '@/lib/projectUtils';
import ProgressBar from './ProgressBar';
import { Calendar, Users, ArrowRight, User, UserCheck, Pencil, Trash2, FileText } from 'lucide-react';
import { safeFmt } from '@/lib/dateUtils';

import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useProjectData';
import { Button } from '@/components/ui/button';

interface ProjectCardProps {
  project: DbProject;
  showEdit?: boolean;
  onEdit?: () => void;
  showDelete?: boolean;
  onDelete?: () => void;
  onReport?: () => void;
  className?: string;
  badge?: string;
}

const ProjectCard = ({ project, showEdit = false, onEdit, showDelete = false, onDelete, onReport, className, badge }: ProjectCardProps) => {
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks(project.id, true);
  const report = calculateProjectReport(project, tasks);
  const derivedStatus = deriveProjectStatus(project, report);

  const creatorName  = project.creator_name  || '-';
  const managerName  = project.manager_name  || null;

  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      className={`bg-card rounded-xl border p-4 sm:p-6 card-hover cursor-pointer group ${className ?? ''}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold font-heading group-hover:text-accent transition-colors line-clamp-1 flex items-center gap-1.5">
            {project.name}
            {badge && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 shrink-0">{badge}</span>}
          </h3>
          {project.company_name && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.company_name}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onReport && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onReport();
              }}
              title="สรุปรายงาน"
            >
              <FileText className="h-3.5 w-3.5" />
            </Button>
          )}
          {showDelete && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              title="ลบโครงการ"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {showEdit && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(event) => {
                event.stopPropagation();
                onEdit();
              }}
              title="แก้ไขโครงการ"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <span className={`status-badge ${getProjectStatusColor(derivedStatus)}`}>
            {getStatusLabel(derivedStatus)}
          </span>
        </div>
      </div>

      <div className="mb-4">
        <ProgressBar percentage={report.completionPercentage} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-y-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {safeFmt(project.start_date, 'd MMM')} - {safeFmt(project.end_date, 'd MMM yy')}
          </span>
          {tasks.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {[...new Set(tasks.map(t => t.assignee).filter(Boolean))].length} คน
            </span>
          )}
        </div>
        {/* Creator & Manager */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1" title="ผู้สร้าง">
            <User className="w-3 h-3 shrink-0" />
            {creatorName}
          </span>
          {managerName && (
            <span className="flex items-center gap-1" title="ผู้รับผิดชอบ">
              <UserCheck className="w-3 h-3 shrink-0 text-primary/70" />
              <span className="text-primary/80 font-medium">{managerName}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span>{report.daysUsed}/{report.totalDays} วัน</span>
          {report.extensionDays > 0 && (
            <span className="text-warning">(+{report.extensionDays})</span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <div className="flex gap-4 text-xs">
          <span className="text-success">✓ {report.completedTasks.length}</span>
          <span className="text-info">● {report.inProgressTasks.length}</span>
          <span className="text-muted-foreground">○ {report.pendingTasks.length}</span>
          {report.overdueTasks.length > 0 && (
            <span className="text-destructive">! {report.overdueTasks.length}</span>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
      </div>
    </div>
  );
};

export default ProjectCard;
