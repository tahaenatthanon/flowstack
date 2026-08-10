import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Briefcase } from 'lucide-react';
import ResourceWorkloadDashboard from '@/components/ResourceWorkloadDashboard';
import CrossProjectImpactView from '@/components/CrossProjectImpactView';
import { useState } from 'react';
import PageShell from '@/components/PageShell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const ResourceDashboard = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  return (
    <PageShell
      breadcrumbs={[{ label: 'Resource Management', isCurrent: true }]}
      title="Resource Management"
      description="ภาพรวม Workload และผลกระทบข้ามโปรเจกต์"
    >

      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="year">ปี</Label>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || currentYear)}
              className="w-full"
              min="2020"
              max="2030"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="startDate">วันที่เริ่มต้น</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label>&nbsp;</Label>
            <Button 
              variant="outline" 
              onClick={() => { setYear(currentYear); setStartDate(''); setEndDate(''); }}
              className="w-full"
            >
              ล้างตัวกรอง
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="workload" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2 text-xs sm:text-sm">
          <TabsTrigger value="workload" className="gap-1 sm:gap-2 px-2 sm:px-3">
            <Users className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">ภาระงาน</span>
          </TabsTrigger>
          <TabsTrigger value="impact" className="gap-1 sm:gap-2 px-2 sm:px-3">
            <Briefcase className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">ผลกระทบข้ามโปรเจกต์</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workload">
          <ResourceWorkloadDashboard year={year} startDate={startDate} endDate={endDate} />
        </TabsContent>

        <TabsContent value="impact">
          <CrossProjectImpactView activeOnly={false} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default ResourceDashboard;
