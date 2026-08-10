# Workflow: Link Existing Records — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to link any existing Project, Opportunity, or Support Ticket to a Workflow definition — both in bulk from WorkflowPage and contextually from each entity's detail page.

**Architecture:** Extend `workflow-instances.php` with GET-unlinked and DELETE-cancel endpoints; create a reusable `WorkflowInstanceCard` component that renders 3 states (no instance / active / completed); update WorkflowPage with a bulk-link dialog; replace the navigate-only Workflow buttons in 3 detail pages with the new card.

**Tech Stack:** PHP/MariaDB backend, React 18 + TypeScript, TanStack React Query, shadcn-ui, Vitest + React Testing Library

---

## File Map

| Action | File |
|--------|------|
| Modify | `api/workflow-instances.php` |
| Create | `src/components/workflow/WorkflowInstanceCard.tsx` |
| Create | `src/__tests__/workflow/WorkflowInstanceCard.test.tsx` |
| Modify | `src/pages/WorkflowPage.tsx` |
| Modify | `src/pages/ProjectDetail.tsx` |
| Modify | `src/pages/SalesDetailPage.tsx` |
| Modify | `src/pages/SupportPage.tsx` |

---

## Task 1: Backend — GET unlinked + DELETE cancel

**Files:**
- Modify: `api/workflow-instances.php`

- [ ] **Step 1.1 — Add GET `?unlinked=1` handler**

  In `api/workflow-instances.php`, add this block **before** the existing `if ($method === 'GET')` block:

  ```php
  if ($method === 'GET' && isset($_GET['unlinked'])) {
      $entity_type = $_GET['entity_type'] ?? null;
      if (!$entity_type) jsonError('entity_type required', 400);

      switch ($entity_type) {
          case 'project':
              $stmt = $db->prepare('
                  SELECT p.id, p.name, p.status, COALESCE(c.name, \'\') as company_name
                  FROM projects p
                  LEFT JOIN companies c ON p.company_id = c.id
                  LEFT JOIN workflow_instances wi
                    ON wi.entity_id = p.id AND wi.entity_type = \'project\' AND wi.status = \'active\'
                  WHERE p.tenant_id = ? AND p.deleted_at IS NULL AND wi.id IS NULL
                  ORDER BY p.name
              ');
              $stmt->execute([$user['tenant_id']]);
              break;
          case 'opportunity':
              $stmt = $db->prepare('
                  SELECT so.id, so.name, so.stage AS status, COALESCE(c.name, \'\') as company_name
                  FROM sales_opportunities so
                  LEFT JOIN companies c ON so.company_id = c.id
                  LEFT JOIN workflow_instances wi
                    ON wi.entity_id = so.id AND wi.entity_type = \'opportunity\' AND wi.status = \'active\'
                  WHERE so.tenant_id = ? AND wi.id IS NULL
                  ORDER BY so.name
              ');
              $stmt->execute([$user['tenant_id']]);
              break;
          case 'support_ticket':
              $stmt = $db->prepare('
                  SELECT st.id, st.title AS name, st.status, COALESCE(c.name, \'\') as company_name
                  FROM support_tickets st
                  LEFT JOIN companies c ON st.company_id = c.id
                  LEFT JOIN workflow_instances wi
                    ON wi.entity_id = st.id AND wi.entity_type = \'support_ticket\' AND wi.status = \'active\'
                  WHERE st.tenant_id = ? AND wi.id IS NULL
                  ORDER BY st.title
              ');
              $stmt->execute([$user['tenant_id']]);
              break;
          default:
              jsonError('Invalid entity_type', 400);
      }
      jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
  }
  ```

- [ ] **Step 1.2 — Add DELETE `?id=X` handler**

  Add this block **before** the final `jsonError('Method not allowed', 405)` line:

  ```php
  if ($method === 'DELETE' && $id) {
      $db->prepare("UPDATE workflow_instances SET status='cancelled', completed_at=NOW(), updated_at=NOW() WHERE id=? AND tenant_id=?")
         ->execute([$id, $user['tenant_id']]);
      jsonResponse(['ok' => true]);
  }
  ```

- [ ] **Step 1.3 — Verify GET unlinked via mysql**

  ```bash
  mysql -u root flowstack -e "
  SELECT p.id, p.name, p.status
  FROM projects p
  LEFT JOIN workflow_instances wi ON wi.entity_id = p.id AND wi.entity_type='project' AND wi.status='active'
  WHERE p.tenant_id='tenant-default' AND p.deleted_at IS NULL AND wi.id IS NULL
  LIMIT 5;"
  ```

  Expected: list of projects without an active workflow instance.

- [ ] **Step 1.4 — Verify DELETE cancel via mysql**

  ```bash
  # Pick any active instance id from:
  mysql -u root flowstack -e "SELECT id FROM workflow_instances WHERE status='active' LIMIT 1;"
  # Then simulate cancel:
  mysql -u root flowstack -e "UPDATE workflow_instances SET status='cancelled', completed_at=NOW() WHERE id='<id>';"
  mysql -u root flowstack -e "SELECT id, status, completed_at FROM workflow_instances WHERE status='cancelled' LIMIT 3;"
  # Revert the test cancel:
  mysql -u root flowstack -e "UPDATE workflow_instances SET status='active', completed_at=NULL WHERE status='cancelled' AND completed_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE);"
  ```

- [ ] **Step 1.5 — Commit**

  ```bash
  git add api/workflow-instances.php
  git commit -m "feat(workflow): add GET unlinked and DELETE cancel endpoints"
  ```

---

## Task 2: WorkflowInstanceCard component

**Files:**
- Create: `src/components/workflow/WorkflowInstanceCard.tsx`
- Create: `src/__tests__/workflow/WorkflowInstanceCard.test.tsx`

- [ ] **Step 2.1 — Write failing tests**

  Create `src/__tests__/workflow/WorkflowInstanceCard.test.tsx`:

  ```tsx
  import { render, screen } from '@testing-library/react';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { MemoryRouter } from 'react-router-dom';
  import { vi } from 'vitest';
  import { WorkflowInstanceCard } from '@/components/workflow/WorkflowInstanceCard';
  import * as api from '@/lib/api';

  vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

  function wrap(ui: React.ReactElement) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>
    );
  }

  describe('WorkflowInstanceCard', () => {
    beforeEach(() => vi.clearAllMocks());

    it('State A: shows ผูก Workflow when instance is null', async () => {
      vi.mocked(api.apiFetch).mockResolvedValue(null);
      wrap(<WorkflowInstanceCard entityType="project" entityId="p1" />);
      expect(await screen.findByText(/ผูก Workflow/)).toBeInTheDocument();
    });

    it('State B: shows definition name and step progress when active', async () => {
      vi.mocked(api.apiFetch).mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definition_name: 'Workflow Test',
        current_step_id: 'step2',
        definition: {
          nodes: [
            { id: 'step1', type: 'stage', data: { label: 'Alpha', nodeType: 'stage' } },
            { id: 'step2', type: 'stage', data: { label: 'Beta', nodeType: 'stage' } },
          ],
          edges: [],
        },
        step_logs: [],
      });
      wrap(<WorkflowInstanceCard entityType="project" entityId="p1" />);
      expect(await screen.findByText('Workflow Test')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });

    it('State C: shows เสร็จสิ้น badge when completed', async () => {
      vi.mocked(api.apiFetch).mockResolvedValue({
        id: 'inst-1',
        status: 'completed',
        definition_name: 'Workflow Done',
        current_step_id: null,
        definition: { nodes: [], edges: [] },
        step_logs: [],
      });
      wrap(<WorkflowInstanceCard entityType="project" entityId="p1" />);
      expect(await screen.findByText(/เสร็จสิ้น/)).toBeInTheDocument();
    });
  });
  ```

- [ ] **Step 2.2 — Run tests, confirm they fail**

  ```bash
  pnpm test src/__tests__/workflow/WorkflowInstanceCard.test.tsx --reporter=verbose 2>&1 | tail -20
  ```

  Expected: `Cannot find module '@/components/workflow/WorkflowInstanceCard'`

- [ ] **Step 2.3 — Create WorkflowInstanceCard component**

  Create `src/components/workflow/WorkflowInstanceCard.tsx`:

  ```tsx
  import { useState } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
  import { GitBranch, ChevronRight, CheckCircle2, Loader2, Link, X } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { apiFetch } from '@/lib/api';
  import { useToast } from '@/hooks/use-toast';
  import { useConfirm } from '@/hooks/useConfirm';
  import type { WorkflowDefinition, WorkflowEntityType } from '@/types/workflow';

  interface Props {
    entityType: WorkflowEntityType;
    entityId: string;
  }

  export function WorkflowInstanceCard({ entityType, entityId }: Props) {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const qc = useQueryClient();
    const [selectedDefId, setSelectedDefId] = useState('');

    const { data: instance, isLoading } = useQuery({
      queryKey: ['workflow-instance', entityType, entityId],
      queryFn: () => apiFetch<any>(`/workflow-instances.php?entity_type=${entityType}&entity_id=${entityId}`),
    });

    const { data: definitions = [] } = useQuery<WorkflowDefinition[]>({
      queryKey: ['workflow-definitions', entityType],
      queryFn: () => apiFetch(`/workflows.php?entity_type=${entityType}`),
      enabled: instance === null,
    });

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ['workflow-instance', entityType, entityId] });
      qc.invalidateQueries({ queryKey: ['workflow-global-analytics'] });
    };

    const linkMutation = useMutation({
      mutationFn: () => apiFetch('/workflow-instances.php', {
        method: 'POST',
        body: JSON.stringify({ workflow_definition_id: selectedDefId, entity_type: entityType, entity_id: entityId }),
      }),
      onSuccess: () => { invalidate(); toast({ title: 'ผูก Workflow เรียบร้อย' }); },
      onError: () => toast({ title: 'ผูกไม่สำเร็จ', variant: 'destructive' }),
    });

    const cancelMutation = useMutation({
      mutationFn: (instanceId: string) => apiFetch(`/workflow-instances.php?id=${instanceId}`, { method: 'DELETE' }),
      onSuccess: () => { invalidate(); toast({ title: 'ยกเลิก Workflow แล้ว' }); },
      onError: () => toast({ title: 'ยกเลิกไม่สำเร็จ', variant: 'destructive' }),
    });

    const advanceMutation = useMutation({
      mutationFn: (payload: { instance_id: string; step_id: string; next_step_id: string | null }) =>
        apiFetch('/workflow-instances.php?action=advance', { method: 'POST', body: JSON.stringify(payload) }),
      onSuccess: () => { invalidate(); toast({ title: 'ขยับขั้นตอนเรียบร้อย' }); },
      onError: () => toast({ title: 'ไม่สามารถ advance ได้', variant: 'destructive' }),
    });

    if (isLoading) return (
      <div className="rounded-xl border p-3 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด Workflow...
      </div>
    );

    // ── State A: no instance ──────────────────────────────────────────────
    if (!instance) return (
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <GitBranch className="h-4 w-4 text-slate-400" />
          Workflow
        </div>
        <p className="text-xs text-muted-foreground">ยังไม่มี workflow ผูกอยู่</p>
        {definitions.length > 0 && (
          <div className="flex items-center gap-2">
            <Select value={selectedDefId} onValueChange={setSelectedDefId}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="เลือก workflow..." />
              </SelectTrigger>
              <SelectContent>
                {definitions.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs shrink-0"
              disabled={!selectedDefId || linkMutation.isPending}
              onClick={() => linkMutation.mutate()}>
              {linkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link className="h-3 w-3 mr-1" />}
              ผูก Workflow
            </Button>
          </div>
        )}
        {definitions.length === 0 && (
          <p className="text-xs text-muted-foreground">ยังไม่มี workflow definition สำหรับ {entityType}</p>
        )}
      </div>
    );

    const stages = (instance.definition?.nodes ?? []).filter((n: any) => n.type === 'stage');
    const currentStepId: string | null = instance.current_step_id ?? null;
    const currentIdx = stages.findIndex((n: any) => n.id === currentStepId);
    const nextStage = currentIdx >= 0 && currentIdx < stages.length - 1 ? stages[currentIdx + 1] : null;

    // ── State C: completed ────────────────────────────────────────────────
    if (instance.status === 'completed') return (
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">{instance.definition_name}</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✅ เสร็จสิ้น</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {stages.map((stage: any, i: number) => (
            <div key={stage.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />}
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 border border-green-300 text-green-700">
                <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />{stage.data.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    );

    // ── State B: active ───────────────────────────────────────────────────
    return (
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-slate-700">{instance.definition_name}</span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">กำลังดำเนินการ</span>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {stages.map((stage: any, i: number) => {
            const done = currentIdx >= 0 && i < currentIdx;
            const current = stage.id === currentStepId;
            return (
              <div key={stage.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />}
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  done    ? 'bg-green-100 border-green-300 text-green-700' :
                  current ? 'bg-blue-100 border-blue-400 text-blue-700 ring-1 ring-blue-400' :
                            'bg-white border-slate-200 text-slate-400'
                }`}>
                  {done && <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5" />}
                  {stage.data.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pt-1">
          {currentStepId && (
            <Button size="sm" className="h-7 text-xs"
              disabled={advanceMutation.isPending}
              onClick={() => advanceMutation.mutate({ instance_id: instance.id, step_id: currentStepId, next_step_id: nextStage?.id ?? null })}>
              {advanceMutation.isPending
                ? <Loader2 className="h-3 w-3 animate-spin mr-1" />
                : <ChevronRight className="h-3 w-3 mr-1" />}
              {nextStage ? `→ ${nextStage.data.label}` : 'ปิด Workflow'}
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => navigate(`/workflow?entity=${entityType}&entity_id=${entityId}`)}>
            <GitBranch className="h-3 w-3 mr-1" /> ดู BPM
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
            disabled={cancelMutation.isPending}
            onClick={async () => {
              const ok = await confirm({ title: 'ยกเลิก Workflow?', description: 'ประวัติขั้นตอนจะยังคงอยู่ แต่จะไม่สามารถ advance ต่อได้', confirmLabel: 'ยกเลิก Workflow', variant: 'destructive' });
              if (ok) cancelMutation.mutate(instance.id);
            }}>
            {cancelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
            ยกเลิก
          </Button>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2.4 — Run tests, confirm they pass**

  ```bash
  pnpm test src/__tests__/workflow/WorkflowInstanceCard.test.tsx --reporter=verbose 2>&1 | tail -20
  ```

  Expected: 3 tests PASS.

- [ ] **Step 2.5 — TypeScript check**

  ```bash
  npx tsc --noEmit --skipLibCheck 2>&1 | head -20
  ```

  Expected: no output (clean).

- [ ] **Step 2.6 — Commit**

  ```bash
  git add src/components/workflow/WorkflowInstanceCard.tsx src/__tests__/workflow/WorkflowInstanceCard.test.tsx
  git commit -m "feat(workflow): add WorkflowInstanceCard component with 3 states"
  ```

---

## Task 3: WorkflowPage — Bulk Link Dialog + Cancel in InstanceView

**Files:**
- Modify: `src/pages/WorkflowPage.tsx`

- [ ] **Step 3.1 — Add LinkDialog component + ผูกรายการ button**

  In `src/pages/WorkflowPage.tsx`, add these imports at the top:

  ```tsx
  import { useEffect, useState, useCallback } from 'react';
  // (replace the existing `import { useState, useCallback } from 'react';`)
  import { Plus, Save, GitBranch, Loader2, ChevronRight, CheckCircle2, BarChart3, Link, Search, X as XIcon } from 'lucide-react';
  // (replace existing lucide import line)
  import { Checkbox } from '@/components/ui/checkbox';
  import { useConfirm } from '@/hooks/useConfirm';
  ```

  Then add the `LinkDialog` component **before** the `export default function WorkflowPage()` line:

  ```tsx
  interface UnlinkedRecord { id: string; name: string; status: string; company_name: string; }

  function LinkDialog({ definitionId, entityType, definitionName, onClose }: {
    definitionId: string; entityType: WorkflowEntityType; definitionName: string; onClose: () => void;
  }) {
    const { toast } = useToast();
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const { data: unlinked = [], isLoading } = useQuery<UnlinkedRecord[]>({
      queryKey: ['workflow-unlinked', entityType],
      queryFn: () => apiFetch(`/workflow-instances.php?entity_type=${entityType}&unlinked=1`),
    });

    const filtered = unlinked.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

    const toggle = (id: string) => setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

    const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id)));

    const linkMutation = useMutation({
      mutationFn: async () => {
        const ids = [...selected];
        const errors: string[] = [];
        for (const entityId of ids) {
          try {
            await apiFetch('/workflow-instances.php', {
              method: 'POST',
              body: JSON.stringify({ workflow_definition_id: definitionId, entity_type: entityType, entity_id: entityId }),
            });
          } catch { errors.push(entityId); }
        }
        return { total: ids.length, errors };
      },
      onSuccess: ({ total, errors }) => {
        qc.invalidateQueries({ queryKey: ['workflow-unlinked', entityType] });
        qc.invalidateQueries({ queryKey: ['workflow-global-analytics'] });
        if (errors.length === 0) {
          toast({ title: `ผูก ${total} รายการเรียบร้อย` });
          onClose();
        } else {
          toast({ title: `ผูก ${total - errors.length}/${total} รายการ`, description: `ล้มเหลว ${errors.length} รายการ`, variant: 'destructive' });
          qc.invalidateQueries({ queryKey: ['workflow-unlinked', entityType] });
          setSelected(new Set());
        }
      },
    });

    return (
      <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>ผูกรายการกับ {definitionName}</DialogTitle>
          </DialogHeader>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="ค้นหา..." className="pl-8 h-8 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {isLoading && <div className="text-center py-6 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />กำลังโหลด...</div>}
          {!isLoading && filtered.length === 0 && <p className="text-center py-6 text-sm text-muted-foreground">ไม่มีรายการที่ยังไม่ผูก Workflow</p>}
          {!isLoading && filtered.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="w-8 px-3 py-2">
                      <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                    </th>
                    <th className="text-left px-3 py-2 font-medium">ชื่อ</th>
                    <th className="text-left px-3 py-2 font-medium">สถานะ</th>
                    <th className="text-left px-3 py-2 font-medium">บริษัท</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-t hover:bg-muted/50 cursor-pointer" onClick={() => toggle(r.id)}>
                      <td className="px-3 py-2">
                        <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} onClick={e => e.stopPropagation()} />
                      </td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.status}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.company_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button disabled={selected.size === 0 || linkMutation.isPending} onClick={() => linkMutation.mutate()}>
              {linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link className="h-4 w-4 mr-2" />}
              ผูก ({selected.size} รายการ)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  ```

- [ ] **Step 3.2 — Add state + button + dialog rendering in WorkflowPage**

  Inside `export default function WorkflowPage()`, after the existing state declarations, add:

  ```tsx
  const [showLink, setShowLink] = useState(false);
  const { confirm } = useConfirm();
  ```

  In the toolbar section (inside `activeTab === 'editor'` block), add the "ผูกรายการ" button after the Save button:

  ```tsx
  {selectedDefId && selectedDef && (
    <Button size="sm" variant="outline" onClick={() => setShowLink(true)}>
      <Link size={14} className="mr-1" /> ผูกรายการ
    </Button>
  )}
  ```

  After the closing `</Dialog>` of the create dialog, add:

  ```tsx
  {showLink && selectedDef && (
    <LinkDialog
      definitionId={selectedDefId}
      entityType={selectedDef.entity_type}
      definitionName={selectedDef.name}
      onClose={() => setShowLink(false)}
    />
  )}
  ```

- [ ] **Step 3.3 — Add cancel button to InstanceView**

  `cancelMutation` must go in the **outer `WorkflowPage` body** (same level as `advanceMutation`), alongside the `const { confirm } = useConfirm();` already added in Step 3.2:

  ```tsx
  const cancelInstanceMutation = useMutation({
    mutationFn: (instanceId: string) => apiFetch(`/workflow-instances.php?id=${instanceId}`, { method: 'DELETE' }),
    onSuccess: () => { refetchInstance(); toast({ title: 'ยกเลิก Workflow แล้ว' }); },
    onError: () => toast({ title: 'ยกเลิกไม่สำเร็จ', variant: 'destructive' }),
  });
  ```

  `InstanceView` is an inner function that closes over the outer scope, so it automatically has access to `cancelInstanceMutation`, `confirm`, and `toast`.

  In the `InstanceView` return JSX, add the cancel button to the right of the advance button row:

  ```tsx
  {inst.status !== 'completed' && currentStepId && (
    <div className="mt-3 flex gap-2 items-center">
      <button
        onClick={() => advanceMutation.mutate({ instance_id: inst.id, step_id: currentStepId, next_step_id: nextStage?.id ?? null })}
        disabled={advanceMutation.isPending}
        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
      >
        {advanceMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
        {nextStage ? `ไปขั้นตอน: ${nextStage.data.label}` : 'ปิด Workflow'}
      </button>
      <button
        onClick={async () => {
          const ok = await confirm({ title: 'ยกเลิก Workflow?', description: 'ประวัติขั้นตอนจะยังคงอยู่', confirmLabel: 'ยกเลิก Workflow', variant: 'destructive' });
          if (ok) cancelInstanceMutation.mutate(inst.id);
        }}
        disabled={cancelMutation.isPending}
        className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 flex items-center gap-1 ml-auto"
      >
        {cancelInstanceMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <XIcon size={12} />}
        ยกเลิก Workflow
      </button>
    </div>
  )}
  ```

- [ ] **Step 3.4 — TypeScript check**

  ```bash
  npx tsc --noEmit --skipLibCheck 2>&1 | head -20
  ```

  Expected: no output.

- [ ] **Step 3.5 — Commit**

  ```bash
  git add src/pages/WorkflowPage.tsx
  git commit -m "feat(workflow): add bulk link dialog and cancel button to WorkflowPage"
  ```

---

## Task 4: Detail pages — replace Workflow buttons with WorkflowInstanceCard

**Files:**
- Modify: `src/pages/ProjectDetail.tsx`
- Modify: `src/pages/SalesDetailPage.tsx`
- Modify: `src/pages/SupportPage.tsx`

- [ ] **Step 4.1 — ProjectDetail: replace Workflow button**

  In `src/pages/ProjectDetail.tsx`:

  Add import at top:
  ```tsx
  import { WorkflowInstanceCard } from '@/components/workflow/WorkflowInstanceCard';
  ```

  Find and **replace** this block (around line 349):
  ```tsx
  <Button variant="outline" size="sm" onClick={() => navigate(`/workflow?entity=project&entity_id=${project.id}`)} className="text-xs sm:text-sm px-2 sm:px-3">
    <GitBranch className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />Workflow
  </Button>
  ```

  Add `<WorkflowInstanceCard>` **below** the header/toolbar section — place it just before the description+progress card (around line 356):
  ```tsx
  <WorkflowInstanceCard entityType="project" entityId={project.id} />
  ```

  Remove the old `<Button>` navigate block entirely.

- [ ] **Step 4.2 — SalesDetailPage: replace Workflow button**

  In `src/pages/SalesDetailPage.tsx`:

  Add import at top:
  ```tsx
  import { WorkflowInstanceCard } from '@/components/workflow/WorkflowInstanceCard';
  ```

  Find and **replace** this block (around line 481):
  ```tsx
  <Button variant="outline" size="sm" onClick={() => navigate(`/workflow?entity=opportunity&entity_id=${opportunity.opportunity_id}`)}>
    <GitBranch className="h-4 w-4 mr-2" />
    Workflow
  </Button>
  ```

  Add `<WorkflowInstanceCard>` in the sidebar or below the header buttons — place it as a separate card after the existing info cards:
  ```tsx
  <WorkflowInstanceCard entityType="opportunity" entityId={opportunity.opportunity_id} />
  ```

  Remove the old `<Button>` navigate block.

- [ ] **Step 4.3 — SupportPage: replace Workflow button**

  In `src/pages/SupportPage.tsx`:

  Add import at top:
  ```tsx
  import { WorkflowInstanceCard } from '@/components/workflow/WorkflowInstanceCard';
  ```

  Find and **replace** the GitBranch icon button block (around line 290):
  ```tsx
  <Button size="icon" variant="ghost" className="h-7 w-7"
    onClick={() => navigate(`/workflow?entity=support_ticket&entity_id=${ticketId}`)}
    title="ดู Workflow"
  >
    <GitBranch className="h-3.5 w-3.5" />
  </Button>
  ```

  Add `<WorkflowInstanceCard>` inside `TicketDetailDialog` content, just before the closing section (near the attachments area):
  ```tsx
  <WorkflowInstanceCard entityType="support_ticket" entityId={ticketId} />
  ```

  Remove the old `<Button size="icon">` block.

- [ ] **Step 4.4 — TypeScript check**

  ```bash
  npx tsc --noEmit --skipLibCheck 2>&1 | head -20
  ```

  Expected: no output.

- [ ] **Step 4.5 — Run all tests**

  ```bash
  pnpm test 2>&1 | tail -15
  ```

  Expected: all existing tests pass + 3 new WorkflowInstanceCard tests pass.

- [ ] **Step 4.6 — Commit**

  ```bash
  git add src/pages/ProjectDetail.tsx src/pages/SalesDetailPage.tsx src/pages/SupportPage.tsx
  git commit -m "feat(workflow): integrate WorkflowInstanceCard into ProjectDetail, SalesDetail, SupportPage"
  ```

---

## Done ✓

All 4 tasks complete. Verify end-to-end:
1. Open WorkflowPage → select a definition → click "ผูกรายการ" → table of unlinked records appears → select some → click ผูก → toast success
2. Open a project/opportunity/ticket detail → WorkflowInstanceCard shows State A (no instance) or State B (active) depending on DB state
3. In State B: advance step works, cancel with confirm works
4. Global bottleneck tab still shows correct counts
