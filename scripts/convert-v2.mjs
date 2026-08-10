// Line-based PageShell conversion - safer approach
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PAGES_DIR = join(import.meta.dirname, '..', 'src', 'pages');

const CONFIG = [
  ['AdminPage.tsx',           null, 'จัดการระบบ'],
  ['AutomationPage.tsx',      null, 'ระบบอัตโนมัติ'],
  ['BudgetPage.tsx',          null, 'งบประมาณ'],
  ['CompaniesPage.tsx',       null, 'จัดการบริษัท'],
  ['GoalsPage.tsx',           null, 'เป้าหมาย & OKR'],
  ['ImpactOSPage.tsx',        null, 'ImpactOS'],
  ['InboxPage.tsx',           null, 'กล่องข้อความ'],
  ['MarketingPage.tsx',       null, 'Marketing'],
  ['ProfilePage.tsx',         null, 'โปรไฟล์ของฉัน'],
  ['QuotationsPage.tsx',      null, 'ใบเสนอราคา'],
  ['SalesPage.tsx',           null, 'ไปป์ไลน์การขาย'],
  ['SupportPage.tsx',         null, 'Helpdesk'],
];

for (const [filename, parentCrumb, pageLabel] of CONFIG) {
  const filePath = join(PAGES_DIR, filename);
  let content = readFileSync(filePath, 'utf8');
  if (content.includes('import PageShell')) continue;

  const lines = content.split('\n');

  // Step 1: Insert PageShell import
  let importIdx = -1;
  const importPatterns = [
    "import { useToast } from '@/hooks/use-toast';",
    "import { useConfirm } from '@/hooks/useConfirm';",
    "import { useAuth } from '@/hooks/useAuth';",
    "import { cn } from '@/lib/utils';",
    "import { apiFetch } from '@/lib/api';",
    "import { useQueryClient } from '@tanstack/react-query';",
    "import { useQuery, useMutation } from '@tanstack/react-query';",
  ];
  for (let i = 0; i < lines.length; i++) {
    for (const pat of importPatterns) {
      if (lines[i].trim() === pat.trim()) { importIdx = i; break; }
    }
    if (importIdx >= 0) break;
  }
  if (importIdx >= 0) {
    lines[importIdx] = `import PageShell from '@/components/PageShell';\n${lines[importIdx]}`;
  } else {
    console.log(`  NO IMPORT SLOT: ${filename}`);
    continue;
  }

  // Step 2: Find outer wrapper div opening
  let outerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*<div className="p-4 sm:p-6 lg:p-8 space-y-[46]">/.test(lines[i])) {
      outerIdx = i;
      break;
    }
  }
  if (outerIdx < 0) { console.log(`  NO OUTER DIV: ${filename}`); continue; }

  // Step 3: Find h1 line
  let h1Idx = -1;
  for (let i = outerIdx; i < Math.min(outerIdx + 10, lines.length); i++) {
    if (lines[i].includes('<h1 className="text-2xl font-bold font-heading">')) {
      h1Idx = i;
      break;
    }
  }
  if (h1Idx < 0) { console.log(`  NO H1: ${filename}`); continue; }

  // Extract title from h1
  const h1Match = lines[h1Idx].match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (!h1Match) { console.log(`  NO H1 TEXT: ${filename}`); continue; }
  const title = h1Match[1].trim();

  // Step 4: Find description p (may not exist)
  let descIdx = -1;
  let desc = '';
  for (let i = h1Idx + 1; i < Math.min(h1Idx + 5, lines.length); i++) {
    const m = lines[i].match(/<p className="text-sm text-muted-foreground">([^<]*)<\/p>/);
    if (m) { descIdx = i; desc = m[1].trim(); break; }
  }

  // Step 5: Find the actions div opening or end of header
  let actionsOpenIdx = -1;
  for (let i = (descIdx >= 0 ? descIdx : h1Idx); i < Math.min(h1Idx + 15, lines.length); i++) {
    if (/<div className="(?:no-print )?flex items-center/.test(lines[i])) {
      actionsOpenIdx = i;
      break;
    }
  }

  // Step 6: Find the closing of the header (</div>\n</div> for header content div and header flex div)
  // Track div depth to find matching closing tags
  let headerEndIdx = -1;
  let divDepth = 0;
  // Start from the header flex container div (two lines above h1Idx typically)
  const headerStartLine = lines.slice(outerIdx, outerIdx + 5).findIndex(l => /flex items-center justify-between/.test(l));
  const headerDivStart = outerIdx + headerStartLine;

  for (let i = headerDivStart; i < lines.length && i < headerDivStart + 50; i++) {
    const openCount = (lines[i].match(/<div/g) || []).length;
    const closeCount = (lines[i].match(/<\/div>/g) || []).length;
    divDepth += openCount - closeCount;
    if (divDepth <= 0 && i > headerDivStart) {
      headerEndIdx = i;
      break;
    }
  }

  if (headerEndIdx < 0) { console.log(`  NO HEADER END: ${filename}`); continue; }

  // Step 7: Extract actions content (between actions div opening and first closing </div>)
  let actionsContent = '';
  if (actionsOpenIdx >= 0 && actionsOpenIdx < headerEndIdx) {
    // Actions content: everything from the div opening to the matching close
    let actionsDepth = 0;
    let actionsEndIdx = -1;
    for (let i = actionsOpenIdx; i <= headerEndIdx; i++) {
      actionsDepth += (lines[i].match(/<div/g) || []).length;
      actionsDepth -= (lines[i].match(/<\/div>/g) || []).length;
      if (actionsDepth <= 0 && i > actionsOpenIdx) {
        actionsEndIdx = i;
        break;
      }
    }
    if (actionsEndIdx > actionsOpenIdx + 1) {
      // Extract inner content (skip opening and closing div tags)
      const innerLines = lines.slice(actionsOpenIdx + 1, actionsEndIdx);
      actionsContent = innerLines.map(l => l.replace(/^\s+/, '')).join('\n').trim();
    } else if (actionsEndIdx === actionsOpenIdx + 1) {
      // Self-closing or single-line content
      actionsContent = lines[actionsOpenIdx].replace(/.*<div className="[^"]*">/, '').replace(/<\/div>.*/, '').trim();
    }
  }

  // Step 8: Build PageShell opening
  let pageShellOpen = `${lines[outerIdx].match(/^(\s*)/)[1]}<PageShell\n`;
  if (parentCrumb) {
    pageShellOpen += `      breadcrumbs={[{ label: '${parentCrumb}', href: '/#/${parentCrumb.toLowerCase().replace(/\s+/g, '-')}' }, { label: '${pageLabel}', isCurrent: true }]}\n`;
  } else {
    pageShellOpen += `      breadcrumbs={[{ label: '${pageLabel}', isCurrent: true }]}\n`;
  }
  pageShellOpen += `      title="${title}"\n`;
  if (desc) pageShellOpen += `      description="${desc}"\n`;
  if (actionsContent) {
    pageShellOpen += `      actions={<>${actionsContent}</>}\n`;
  }
  pageShellOpen += `    >`;

  // Step 9: Apply edits
  // Remove outer div through header end
  const indent = lines[outerIdx].match(/^(\s*)/)[1];
  lines.splice(outerIdx, headerEndIdx - outerIdx + 1, pageShellOpen);

  // Step 10: Find and replace the matching closing </div>
  // The outer div's closing tag should be at the same indent level before "  );"
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] === `${indent}</div>` && i + 1 < lines.length && lines[i + 1].trim() === ');') {
      lines[i] = `${indent}</PageShell>`;
      break;
    }
  }

  writeFileSync(filePath, lines.join('\n'), 'utf8');
  console.log(`DONE: ${filename}`);
}

console.log('\nVerify with pnpm build');
