const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const META_PATH = path.join(__dirname, 'data', 'update-meta.json');
const JOBS_PATH = path.join(__dirname, 'data', 'jobs.json');

function fetch(url, options = {}, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, {
      method: options.method || 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Content-Type': 'application/json', ...options.headers },
      timeout: 15000,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const newUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetch(newUrl, options, redirectCount + 1).then(resolve, reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Load metadata ──
function loadMeta() {
  try {
    return JSON.parse(fs.readFileSync(META_PATH, 'utf-8'));
  } catch {
    return { lastUpdate: null };
  }
}

function saveMeta(date) {
  fs.writeFileSync(META_PATH, JSON.stringify({ lastUpdate: date, success: true }, null, 2), 'utf-8');
}

// ── DeepOffer ──
async function fetchDeepOffer(sinceDate) {
  console.log('[deepoffer] Fetching...');
  const jobs = [];
  let offset = 0;
  const pageSize = 20;
  let total = Infinity;
  let emptyCount = 0;
  const maxPages = 50;
  let pages = 0;

  while (offset < total && pages < maxPages) {
    try {
      const { status, data } = await fetch(`https://deepoffer.cn/api/v1/jobs?offset=${offset}&limit=${pageSize}`);
      if (status !== 200) { await sleep(2000); continue; }
      const json = JSON.parse(data);
      total = json.data.total;
      const items = json.data.items || [];
      if (items.length === 0) { emptyCount++; if (emptyCount >= 3) break; await sleep(1000); offset += pageSize; continue; }
      emptyCount = 0;

      for (const item of items) {
        const pubDate = item.update_date || '';
        // Stop if data is older than sinceDate
        if (sinceDate && pubDate && pubDate < sinceDate) { offset = total; break; }
        jobs.push({
          source: 'deepoffer', publishDate: pubDate,
          company: item.company_name || item.company || '',
          positions: item.positions || item.title || '',
          location: item.work_location || item.location || '',
          deadline: item.deadline || '',
          applyUrl: item.apply_url || '',
          announcementUrl: item.announcement_url || '',
          companyType: item.company_type || '',
          industry: item.industry || '',
          recruitmentType: item.recruitment_type || '',
        });
      }
      offset += pageSize;
      pages++;
      process.stdout.write(`\r[deepoffer] ${jobs.length} records`);
      await sleep(100);
    } catch (e) {
      console.error(`\n[deepoffer] Error:`, e.message);
      break; // certificate errors etc — stop immediately
    }
  }
  console.log(`\n[deepoffer] Done: ${jobs.length} records`);
  return jobs;
}

// ── 求职方舟 ──
async function fetchQiuzhifangzhou(daysBack) {
  console.log(`[qiuzhifangzhou] Fetching ${daysBack} days...`);
  const jobs = [];
  const today = new Date();

  for (let i = 0; i < daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    try {
      const { status, data } = await fetch('https://api.qiuzhifangzhou.com/api/campus/getCampusList', {
        method: 'POST',
        body: { dateList: [{ date: dateStr, md5: 'd41d8cd98f00b204e9800998ecf8427e' }] },
      });
      if (status !== 200) continue;
      const json = JSON.parse(data);
      for (const day of (json.campusList || [])) {
        for (const item of (day.datas || [])) {
          jobs.push({
            source: 'qiuzhifangzhou', publishDate: dateStr,
            company: item.company || '',
            positions: item.positions || '',
            location: item.locations || '',
            deadline: item.deadline || '',
            applyUrl: item.applyUrl || '',
            announcementUrl: item.noticeUrl || '',
            companyType: (item.typeTag || []).join(','),
            industry: item.industry || '',
            recruitmentType: item.batch || '',
          });
        }
      }
      process.stdout.write(`\r[qiuzhifangzhou] ${jobs.length} records (day ${i + 1}/${daysBack})`);
    } catch (e) { /* skip */ }
  }
  console.log(`\n[qiuzhifangzhou] Done: ${jobs.length} records`);
  return jobs;
}

// ── OfferStar (HTML) ──
async function fetchOfferstar() {
  console.log('[offerstar] Fetching HTML...');
  try {
    const { status, data: html } = await fetch('https://www.offerstar.cn/recruitment');
    if (status !== 200) { console.log('[offerstar] Failed:', status); return []; }

    const jobs = [];
    const regex = /\{\\?"_id\\?":\\?"[^"]+\\?",[\s\S]*?\}/g;
    for (const m of (html.match(regex) || [])) {
      try {
        const obj = JSON.parse(m.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
        if (obj._id && obj.company) {
          jobs.push({
            source: 'offerstar',
            publishDate: obj.createTime ? new Date(obj.createTime).toISOString().split('T')[0] : '',
            company: obj.company || '',
            positions: obj.positions || obj.title || '',
            location: (obj.normalizedWorkLocations || []).join(',') || obj.workLocation || '',
            deadline: obj.deadline || '',
            applyUrl: obj.referralMethod || '',
            announcementUrl: '',
            companyType: '',
            industry: obj.industry || '',
            recruitmentType: obj.channel || '',
          });
        }
      } catch {}
    }
    console.log(`[offerstar] Done: ${jobs.length} records`);
    return jobs;
  } catch (e) {
    console.error('[offerstar] Error:', e.message);
    return [];
  }
}

// ── Deduplicate ──
function deduplicate(existing, newJobs) {
  const seen = new Map();
  // Index existing by key
  for (const job of existing) {
    const key = `${job.company}|${job.positions}`.toLowerCase().replace(/\s+/g, '');
    seen.set(key, job);
  }
  // Merge new
  for (const job of newJobs) {
    const key = `${job.company}|${job.positions}`.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(key)) {
      seen.set(key, job);
    } else {
      const old = seen.get(key);
      if (!old.applyUrl && job.applyUrl) old.applyUrl = job.applyUrl;
      if (!old.announcementUrl && job.announcementUrl) old.announcementUrl = job.announcementUrl;
      if (!old.deadline && job.deadline) old.deadline = job.deadline;
      if (!old.location && job.location) old.location = job.location;
    }
  }
  return [...seen.values()];
}

// ── Process: normalize, remove expired, clean ──
const TYPE_MAP = {
  '26春招': '26春招', '26届春招': '26春招', '27春招': '27春招',
  '25春招': '25春招', '24春招': '24春招', '23春招': '23春招', '29春招': '29春招',
  '26秋招': '26秋招', '27秋招': '27秋招', '27届实习': '27实习',
  '27提前批': '27提前批', '26提前批': '26提前批',
  '日常实习': '日常实习', '暑期实习': '暑期实习',
  '提前批': '提前批', '补录': '补录', '实习': '日常实习', '校招': '校招', '专岗': '专岗',
};

function processData(jobs) {
  const today = new Date().toISOString().split('T')[0];

  for (const job of jobs) {
    job.recruitmentType = TYPE_MAP[(job.recruitmentType || '').trim()] || job.recruitmentType || '其他';
  }

  const filtered = jobs.filter(job => {
    const dl = (job.deadline || '').trim();
    if (!dl || dl === '尽快投递' || dl === '-') return true;
    return dl.replace(/\//g, '-') >= today;
  });

  for (const job of filtered) {
    let p = (job.positions || '').trim();
    p = p.replace(/[,，、;；\s]+$/, '');
    p = p.replace(/^本次共[计招聘]*\d+人[、，,]?\s*/, '');
    if (/^具体.*详见附件/.test(p)) p = '详见公告';
    if (p.length > 80) p = p.substring(0, 80) + '...';
    job.positions = p;
  }

  filtered.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
  filtered.forEach((job, i) => { job.id = i + 1; });
  return filtered;
}

// ── Main ──
async function main() {
  console.log('=== Campus Recruitment Incremental Update ===\n');

  const meta = loadMeta();
  const lastUpdate = meta.lastUpdate ? new Date(meta.lastUpdate) : null;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Calculate days to fetch
  let daysBack = 7; // default: 1 week
  if (lastUpdate) {
    const diffMs = now - lastUpdate;
    daysBack = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1, 2); // +1 day buffer, min 2
  }
  const sinceDate = lastUpdate ? lastUpdate.toISOString().split('T')[0] : null;
  console.log(`Last update: ${sinceDate || 'never'}`);
  console.log(`Fetching: ${daysBack} days back\n`);

  // Fetch new data
  const [deepoffer, qiuzhifangzhou, offerstar] = await Promise.all([
    fetchDeepOffer(sinceDate),
    fetchQiuzhifangzhou(daysBack),
    fetchOfferstar(),
  ]);

  const newJobs = [...deepoffer, ...qiuzhifangzhou, ...offerstar];
  console.log(`\nNew data: ${newJobs.length} records`);

  // Load existing data
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8')); } catch {}
  console.log(`Existing data: ${existing.length} records`);

  // Merge & dedup
  const merged = deduplicate(existing, newJobs);
  console.log(`After dedup: ${merged.length} records`);

  // Process: normalize, remove expired, clean
  const processed = processData(merged);
  console.log(`After cleanup: ${processed.length} records (removed ${merged.length - processed.length} expired)`);

  // Stats
  const typeStats = {};
  processed.forEach(j => { typeStats[j.recruitmentType] = (typeStats[j.recruitmentType] || 0) + 1; });
  console.log('\n=== 类型分布 ===');
  Object.entries(typeStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v + '\t' + k));

  // Save
  fs.writeFileSync(JOBS_PATH, JSON.stringify(processed, null, 2), 'utf-8');
  saveMeta(now.toISOString());
  console.log(`\nSaved: ${JOBS_PATH}`);
  console.log(`Next update will fetch from: ${todayStr}`);
}

main().catch(console.error);
