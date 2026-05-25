const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data', 'jobs.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

console.log('原始记录:', data.length);

// ── 1. Normalize recruitmentType ──
const TYPE_MAP = {
  '26春招': '26春招',
  '26届春招': '26春招',
  '27春招': '27春招',
  '25春招': '25春招',
  '24春招': '24春招',
  '23春招': '23春招',
  '29春招': '29春招',
  '26秋招': '26秋招',
  '27秋招': '27秋招',
  '27届实习': '27实习',
  '27提前批': '27提前批',
  '26提前批': '26提前批',
  '日常实习': '日常实习',
  '暑期实习': '暑期实习',
  '提前批': '提前批',
  '补录': '补录',
  '实习': '日常实习',
  '校招': '校招',
  '专岗': '专岗',
};

for (const job of data) {
  const raw = (job.recruitmentType || '').trim();
  job.recruitmentType = TYPE_MAP[raw] || raw || '其他';
}

// ── 2. Remove expired jobs ──
const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const before = data.length;
const filtered = data.filter(job => {
  const dl = (job.deadline || '').trim();
  // Keep if: no deadline, "尽快投递", or deadline >= today
  if (!dl || dl === '尽快投递' || dl === '-') return true;
  // Normalize date format
  const normalized = dl.replace(/\//g, '-');
  return normalized >= today;
});
console.log('过期删除:', before - filtered.length);
console.log('剩余记录:', filtered.length);

// ── 3. Clean up positions ──
for (const job of filtered) {
  let p = (job.positions || '').trim();
  // Remove trailing punctuation
  p = p.replace(/[,，、;；\s]+$/, '');
  // Remove leading descriptions like "本次共计招聘110人、"
  p = p.replace(/^本次共[计招聘]*\d+人[、，,]?\s*/, '');
  // If positions look like "具体详见附件...", set to generic
  if (/^具体.*详见附件/.test(p)) p = '详见公告';
  // Truncate extremely long position strings
  if (p.length > 80) p = p.substring(0, 80) + '...';
  job.positions = p;
}

// ── 4. Re-assign IDs ──
filtered.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
filtered.forEach((job, i) => { job.id = i + 1; });

// ── 5. Stats ──
const typeStats = {};
filtered.forEach(j => { typeStats[j.recruitmentType] = (typeStats[j.recruitmentType] || 0) + 1; });
console.log('\n=== 类型分布 ===');
Object.entries(typeStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v + '\t' + k));

fs.writeFileSync(dataPath, JSON.stringify(filtered, null, 2), 'utf-8');
console.log('\n已保存:', dataPath);
