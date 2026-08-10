import { SalesPipelineSummary } from '@/types/project';
import { useOpportunityMembers, useUsers } from '@/hooks/useProjectData';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProgressBar from '@/components/ProgressBar';
import { Calendar, Users, User, ArrowRight, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RenewalOpportunityDialog from '@/components/RenewalOpportunityDialog';

export function OpportunityCardInfo({ opportunity }: { opportunity: SalesPipelineSummary }) {
  const { data: members = [] } = useOpportunityMembers(opportunity.opportunity_id);

  // Get owner name (assigned_to)
  const ownerName = useMemo(() => {
    return opportunity.assigned_user_name || '-';
  }, [opportunity.assigned_user_name]);

  // Get member names
  const memberNames = useMemo(() => {
    return members.map((m: any) => m.display_name).slice(0, 3);
  }, [members]);

  if (members.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {ownerName}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <span className="flex items-center gap-1">
        <User className="w-3 h-3" />
        {ownerName}
      </span>
      {memberNames.length > 0 && (
        <span className="flex items-center gap-1 truncate">
          <Users className="w-3 h-3" />
          {memberNames.join(', ')}
          {members.length > 3 && ` +${members.length - 3}`}
        </span>
      )}
    </div>
  );
}

interface OpportunityCardProps {
  opportunity: SalesPipelineSummary;
  isAdmin?: boolean;
  onEdit?: (opp: SalesPipelineSummary) => void;
  onDelete?: (opp: SalesPipelineSummary) => void;
}

export default function OpportunityCard({ opportunity: opp, isAdmin, onEdit, onDelete }: OpportunityCardProps) {
  const navigate = useNavigate();
  const [showRenewal, setShowRenewal] = useState(false);
  const { data: members = [] } = useOpportunityMembers(opp.opportunity_id);
  
  const stageColors: Record<string, string> = {
    lead: 'bg-gray-100 text-gray-800',
    qualified: 'bg-blue-100 text-blue-800',
    proposal: 'bg-yellow-100 text-yellow-800',
    negotiation: 'bg-orange-100 text-orange-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
  };

  const memberNames = useMemo(() => {
    return members.map((m: any) => m.display_name).slice(0, 3);
  }, [members]);

  return (
    <>
    <Card
      className="bg-card rounded-xl border cursor-pointer hover:shadow-md transition-all card-hover group"
      onClick={() => navigate(`/sales/${opp.opportunity_id}`)}
    >
      <CardHeader className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base sm:text-lg font-semibold font-heading group-hover:text-accent transition-colors line-clamp-2">
            {opp.opportunity_name}
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            {opp.stage === 'won' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-violet-500 hover:text-violet-600"
                onClick={(event) => { event.stopPropagation(); setShowRenewal(true); }}
                title="สร้าง Renewal / Upsell"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
            {isAdmin && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(opp);
                }}
                title="ลบโอกาสการขาย"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(opp);
                }}
                title="แก้ไขโอกาสการขาย"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            <Badge className={`${stageColors[opp.stage]} border-0`}>
              {opp.stage}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-sm">
          {opp.company_name}
        </CardDescription>
        {opp.description && (
          <CardDescription className="text-sm line-clamp-2">
            {opp.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
        {/* Value and Probability */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">
            {Number(opp.value).toLocaleString('th-TH')} ฿
          </div>
          <div className="text-sm text-muted-foreground">
            {opp.probability}%
          </div>
        </div>

        {/* Progress bar for probability */}
        <ProgressBar percentage={opp.probability} />

        {/* Dates and Members */}
        <div className="flex flex-wrap items-center justify-between gap-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            {opp.expected_close_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(opp.expected_close_date).toLocaleDateString('th-TH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </span>
            )}
          </div>
        </div>

        {/* Owner and Members */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {opp.assigned_user_name || '-'}
          </span>
          {memberNames.length > 0 && (
            <span className="flex items-center gap-1 truncate">
              <Users className="w-3 h-3" />
              {memberNames.join(', ')}
              {members.length > 3 && ` +${members.length - 3}`}
            </span>
          )}
        </div>

        {/* Quotation count */}
        {opp.quotation_count > 0 && (
          <Badge variant="secondary" className="mt-2">
            {opp.quotation_count} ใบเสนอราคา
          </Badge>
        )}
      </CardContent>
    </Card>

    {showRenewal && (
      <RenewalOpportunityDialog
        source={{
          id:           opp.opportunity_id,
          name:         opp.opportunity_name,
          company_id:   opp.company_id,
          company_name: opp.company_name,
          value:        opp.value,
          assigned_to:  opp.assigned_user_id,
        }}
        onClose={() => setShowRenewal(false)}
      />
    )}
  </>
  );
}
