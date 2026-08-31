import PageShell from '@/components/PageShell';
import BrandContextTab from '@/components/content/tabs/BrandContextTab';
import BrandInstructionForm from '@/components/brand/BrandInstructionForm';
import BrandProductRefsForm from '@/components/brand/BrandProductRefsForm';
import ContentGoalForm from '@/components/brand/ContentGoalForm';
import ResearchProviderForm from '@/components/brand/ResearchProviderForm';

export default function BrandSettingPage() {
  return (
    <PageShell
      breadcrumbs={[{ label: 'การจัดการระบบ' }, { label: 'ตั้งค่าแบรนด์', isCurrent: true }]}
      title="ตั้งค่าแบรนด์"
      description="จัดการ Brand Brief คำสั่งหลัก และสินค้าอ้างอิงสำหรับ AI ทั้งระบบ"
    >
      <div className="space-y-8 max-w-3xl">
        <BrandContextTab />
        <BrandInstructionForm />
        <ContentGoalForm />
        <BrandProductRefsForm />
        <ResearchProviderForm />
      </div>
    </PageShell>
  );
}
