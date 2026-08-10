/**
 * Export utility functions for CSV and data export
 */

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV(data: any[], headers?: string[]): string {
  if (data.length === 0) return '';

  // Get headers from first object if not provided
  const keys = headers || Object.keys(data[0]);
  
  // Create header row
  const headerRow = keys.join(',');
  
  // Create data rows
  const dataRows = data.map(item => {
    return keys.map(key => {
      const value = item[key];
      // Handle values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',');
  });
  
  return [headerRow, ...dataRows].join('\n');
}

function getAllKeys(data: any[]): string[] {
  const keySet = new Set<string>();
  data.forEach((item) => {
    Object.keys(item || {}).forEach((key) => keySet.add(key));
  });
  return Array.from(keySet);
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export projects to CSV
 */
export function exportProjectsToCSV(projects: any[]): void {
  const data = projects.map(p => ({
    'ชื่อโปรเจกต์': p.name,
    'คำอธิบาย': p.description,
    'สถานะ': p.status,
    'วันเริ่มต้น': p.start_date,
    'วันสิ้นสุด': p.end_date,
    'บริษัท': p.company_name || '',
  }));
  
  const csv = convertToCSV(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `projects_${timestamp}.csv`);
}

/**
 * Export opportunities to CSV
 */
export function exportOpportunitiesToCSV(opportunities: any[]): void {
  const data = opportunities.map(o => ({
    'ชื่อโอกาส': o.opportunity_name,
    'บริษัท': o.company_name,
    'ขั้นตอน': o.stage,
    'มูลค่า': o.value || 0,
    'โอกาสปิดดีล': `${o.probability}%`,
    'วันที่คาดว่าจะปิด': o.expected_close_date || '',
    'ผู้รับผิดชอบ': o.assigned_user_name,
    'แหล่งที่มา': o.lead_source || '',
  }));
  
  const csv = convertToCSV(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `opportunities_${timestamp}.csv`);
}

/**
 * Export quotations to CSV
 */
export function exportQuotationsToCSV(quotations: any[]): void {
  const data = quotations.map(q => ({
    'เลขที่ใบเสนอราคา': q.quotation_number,
    'บริษัท': q.company_name,
    'วันที่ออก': q.issue_date,
    'ใช้ได้ถึง': q.valid_until,
    'ยอดรวม': q.total_amount,
    'ส่วนลด': q.discount,
    'ภาษี': q.tax,
    'ยอดสุทธิ': q.grand_total,
    'สถานะ': q.status,
  }));
  
  const csv = convertToCSV(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `quotations_${timestamp}.csv`);
}

/**
 * Export companies to CSV
 */
export function exportCompaniesToCSV(companies: any[]): void {
  const data = companies.map(c => ({
    'ชื่อบริษัท': c.name,
    'คำอธิบาย': c.description || '',
    'ที่อยู่': c.address || '',
    'เบอร์โทร': c.phone || '',
    'อีเมล': c.email || '',
    'เว็บไซต์': c.website || '',
    'เลขประจำตัวผู้เสียภาษี': c.tax_id || '',
    'สถานะ': Number(c.is_active) ? 'ใช้งาน' : 'ไม่ใช้งาน',
  }));
  
  const csv = convertToCSV(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `companies_${timestamp}.csv`);
}

/**
 * Export revenue report to CSV
 */
export function exportRevenueToCSV(projects: any[]): void {
  const data = projects.map(p => ({
    'ชื่อโปรเจกต์': p.name,
    'บริษัท': p.company_name || '',
    'สถานะโปรเจกต์': p.status,
    'วันเริ่มต้น': p.start_date,
    'วันสิ้นสุด': p.end_date,
  }));
  
  const csv = convertToCSV(data);
  const timestamp = new Date().toISOString().split('T')[0];
  downloadCSV(csv, `revenue_report_${timestamp}.csv`);
}

/**
 * Export tasks to CSV
 */
export function exportTasksToCSV(tasks: any[], projectName?: string): void {
  const data = tasks.map(t => ({ ...t }));
  const headers = getAllKeys(data);
  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = projectName 
    ? `tasks_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`
    : `tasks_${timestamp}.csv`;
  downloadCSV(csv, filename);
}

/**
 * Export task hours entries to CSV
 */
export function exportTaskHoursToCSV(entries: any[], projectName?: string): void {
  const data = entries.map(e => ({ ...e }));
  const headers = getAllKeys(data);
  const csv = convertToCSV(data, headers);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = projectName 
    ? `task_hours_${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.csv`
    : `task_hours_${timestamp}.csv`;
  downloadCSV(csv, filename);
}
