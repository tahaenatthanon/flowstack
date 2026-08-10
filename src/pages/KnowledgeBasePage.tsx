import PageShell from '@/components/PageShell';
import KnowledgeBaseContent from '@/components/brand/KnowledgeBaseContent';

export default function KnowledgeBasePage() {
  return (
    <PageShell
      breadcrumbs={[{ label: 'ศูนย์ช่วยเหลือ', href: '/support' }, { label: 'ฐานความรู้', isCurrent: true }]}
      title="ฐานความรู้"
      description="บทความและคู่มือการใช้งาน"
    >
      <KnowledgeBaseContent />
    </PageShell>
  );
}
