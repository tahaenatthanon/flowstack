// Quick test harness for AI JSON-cleaning logic used in ChatWidget.tsx
const samples = [
  // Plain JSON
  '{"action":"query","sql":"SELECT * FROM projects LIMIT 3"}',
  // JSON inside code block
  '```json\n{\n  "action": "query",\n  "sql": "SELECT id, name FROM projects"\n}\n```',
  // JSON with surrounding explanation
  'I will run this:\n```json\n{ "action": "query", "sql": "SELECT * FROM tasks WHERE status=\'pending\'" }\n```\nLet me know.',
  // JSON with trailing comma
  '{ "action": "query", "sql": "SELECT 1", }',
  // JSON with unicode zero-width and NBSP
  '\u200B{\u00A0"action":"query","sql":"SELECT 2"}\u200B',
  // No JSON
  'Just a normal reply in Thai: รายงานสถานะโครงการล่าสุด',
  // Multi-line markdown fenced code without json tag
  '```\n{\n  "action": "query",\n  "sql": "SELECT * FROM users"\n}\n```'
];

function cleanAndParse(content) {
  try {
    let cleanContent = content.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .replace(/\n/g, '')
      .replace(/\r/g, '')
      .replace(/\t/g, '')
      .replace(/\u200b/gi, '')
      .replace(/\uFEFF/gi, '')
      .replace(/\u00A0/gi, '');

    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, reason: 'no-json', raw: cleanContent };

    const potentialJson = jsonMatch[0];
    const fixedJson = potentialJson.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    const parsed = JSON.parse(fixedJson);
    return { ok: true, parsed };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

for (const s of samples) {
  const res = cleanAndParse(s);
  console.log('---');
  console.log('Input:', s);
  console.log('Result:', res);
}

process.exit(0);
