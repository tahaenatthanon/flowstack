export const TASK_TYPE_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  work:    { bg: '#f3f4f6', border: '#9ca3af', text: '#374151', label: 'งานปกติ' },
  task:    { bg: '#f3f4f6', border: '#9ca3af', text: '#374151', label: 'งานปกติ' },
  meeting: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', label: 'ประชุม' },
  holiday: { bg: '#dcfce7', border: '#16a34a', text: '#14532d', label: 'วันหยุด' },
  leave:   { bg: '#fef9c3', border: '#ca8a04', text: '#713f12', label: 'ลาหยุด' },
  onsite:  { bg: '#f3e8ff', border: '#9333ea', text: '#581c87', label: 'งานลูกค้า (Onsite)' },
  ot:           { bg: '#ffedd5', border: '#ea580c', text: '#7c2d12', label: 'งานล่วงเวลา (OT)' },
  weekend_work: { bg: '#ccfbf1', border: '#14b8a6', text: '#115e59', label: 'งานวันหยุด (Weekend)' },
  research:     { bg: '#ede9fe', border: '#8b5cf6', text: '#4c1d95', label: 'วิจัย' },
  interrupt:    { bg: '#ffe4e6', border: '#f43f5e', text: '#881337', label: 'งานแทรก' },
};

export function getTaskTypeCfg(taskType?: string) {
  return TASK_TYPE_CONFIG[taskType ?? ''] ?? TASK_TYPE_CONFIG['work'];
}
