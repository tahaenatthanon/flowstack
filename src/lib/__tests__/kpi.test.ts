import { describe, it, expect } from 'vitest';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from '@/lib/labels';

describe('Label mappings', () => {
  it('PRIORITY_LABELS covers all expected priorities', () => {
    const expected = ['low', 'medium', 'high', 'critical'];
    expected.forEach(p => expect(PRIORITY_LABELS[p]).toBeDefined());
  });

  it('TASK_STATUS_LABELS covers all expected statuses', () => {
    const expected = ['pending', 'in-progress', 'completed'];
    expected.forEach(s => expect(TASK_STATUS_LABELS[s]).toBeDefined());
  });
});
