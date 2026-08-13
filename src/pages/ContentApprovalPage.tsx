import PageShell from '@/components/PageShell';
import ContentApprovalTab from '@/components/content/tabs/ContentApprovalTab';

export default function ContentApprovalPage() {
  return (
    <PageShell
      breadcrumbs={[
        { label: 'การตลาด', href: '/marketing' },
        { label: 'คอนเทนต์โซเชียล' },
        { label: 'รายการอนุมัติ', isCurrent: true },
      ]}
      title="รายการอนุมัติ"
      description="ตรวจสอบและอนุมัติเนื้อหาก่อนเผยแพร่"
    >
      <ContentApprovalTab />
    </PageShell>
  );
}

