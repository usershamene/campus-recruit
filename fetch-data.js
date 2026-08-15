const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { deduplicate, processData } = require('./lib/data-processing');

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

// ── Deduplicate / Process ──
// 以下核心逻辑已抽取至 lib/data-processing.js（可单测复用）：
//   deduplicate / isSOE / splitPositions / inferType / processData
// 通过顶部 require('./lib/data-processing') 引入。


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

  console.log('\n=== 抓取结果 ===');
  console.log(`求职方舟: ${qiuzhifangzhou.length} 条（${daysBack} 天）`);
  console.log(`OfferStar: ${offerstar.length} 条`);
  console.log(`DeepOffer: ${deepoffer.length} 条`);
  console.log(`本次抓取合计: ${qiuzhifangzhou.length + offerstar.length + deepoffer.length} 条`);

  const newJobs = [...deepoffer, ...qiuzhifangzhou, ...offerstar];

  // Load existing data
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8')); } catch {}
  const existingCount = existing.length;

  // Merge & dedup
  const merged = deduplicate(existing, newJobs);
  const addedCount = merged.length - existingCount;

  // Process: normalize, remove expired, clean
  const { processed, loginFiltered, expired } = processData(merged);
  const expiredCount = expired;

  console.log('\n=== 增量更新结果 ===');
  console.log(`原有数据: ${existingCount} 条`);
  console.log(`本次新增: ${addedCount} 条`);
  console.log(`登录墙过滤: ${loginFiltered} 条`);
  console.log(`过期移除: ${expiredCount} 条`);
  console.log(`最终总量: ${processed.length} 条`);

  // Stats
  const typeStats = {};
  processed.forEach(j => { typeStats[j.recruitmentType] = (typeStats[j.recruitmentType] || 0) + 1; });
  console.log('\n=== 类型分布 ===');
  Object.entries(typeStats).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(v + '\t' + k));

  // Save（同时输出压缩版 jobs.min.json 供前端优先加载，节省 ~35% 流量）
  fs.writeFileSync(JOBS_PATH, JSON.stringify(processed, null, 2), 'utf-8');
  fs.writeFileSync(path.join(__dirname, 'data', 'jobs.min.json'), JSON.stringify(processed), 'utf-8');
  saveMeta(now.toISOString());
  console.log(`\nSaved: ${JOBS_PATH} (+ jobs.min.json 压缩版)`);
  console.log(`Next update will fetch from: ${todayStr}`);

  // 识别所有缺少简介的公司（全量扫描，而非仅本次新增 —— 保证生成失败的公司可被重试）
  const profilesPath = path.join(__dirname, 'data', 'company-profiles.json');
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8')); } catch {}
  const allCompanies = [...new Set(processed.map(j => j.company))];
  const missingAll = allCompanies.filter(c => !profiles[c]);
  const pendingPath = path.join(__dirname, 'data', 'pending-profiles.json');
  if (missingAll.length > 0) {
    fs.writeFileSync(pendingPath, JSON.stringify(missingAll, null, 2), 'utf-8');
    console.log(`\n⚠ ${missingAll.length} companies still need profiles → data/pending-profiles.json`);
    console.log(`ACTION_REQUIRED: GENERATE_PROFILES`);
  } else {
    fs.writeFileSync(pendingPath, JSON.stringify([], null, 2), 'utf-8');
    console.log('\n✓ All companies have profiles');
  }

  // 记录生成失败的公司（供 generate-profiles.js / retry-failed.js 重试）
  const failuresPath = path.join(__dirname, 'data', 'profile-failures.json');
  let failures = [];
  try { failures = JSON.parse(fs.readFileSync(failuresPath, 'utf-8')); } catch {}
  // 清理已成功生成简介的失败记录
  failures = failures.filter(f => !profiles[f.name]);
  if (failures.length > 0) {
    fs.writeFileSync(failuresPath, JSON.stringify(failures, null, 2), 'utf-8');
    console.log(`ℹ ${failures.length} companies in failure list → data/profile-failures.json (retry with retry-failed.js)`);
  }
}

main().catch(console.error);
