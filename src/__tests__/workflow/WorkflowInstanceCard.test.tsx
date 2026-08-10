import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { WorkflowInstanceCard } from '@/components/workflow/WorkflowInstanceCard';
import { ConfirmProvider } from '@/hooks/useConfirm';
import * as api from '@/lib/api';

vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ConfirmProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ConfirmProvider>
    </QueryClientProvider>
  );
}

describe('WorkflowInstanceCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('State A: shows ผูก Workflow when instance is null', async () => {
    vi.mocked(api.apiFetch).mockImplementation((url: string) => {
      if (url.includes('workflow-instances')) return Promise.resolve(null);
      // definitions call returns one definition
      return Promise.resolve([{ id: 'def-1', name: 'Workflow A', entity_type: 'project', definition: { nodes: [], edges: [] }, is_template: 0, created_by: null, created_at: '', updated_at: '', tenant_id: '' }]);
    });
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
