const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

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

// ── DeepOffer ──
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchDeepOffer() {
  console.log('[deepoffer] Fetching...');
  const jobs = [];
  let offset = 0;
  const pageSize = 20; // API returns 20 per page regardless of limit param
  let total = Infinity;
  let emptyCount = 0;

  const maxPages = 100; // limit to ~2000 records to avoid timeout
  let pages = 0;
  while (offset < total && pages < maxPages) {
    try {
      const { status, data } = await fetch(`https://deepoffer.cn/api/v1/jobs?offset=${offset}&limit=${pageSize}`);
      if (status !== 200) { await sleep(2000); continue; }
      const json = JSON.parse(data);
      total = json.data.total;
      const items = json.data.items || [];
      if (items.length === 0) {
        emptyCount++;
        if (emptyCount >= 3) break; // stop after 3 consecutive empty responses
        await sleep(1000);
        offset += pageSize;
        continue;
      }
      emptyCount = 0;

      for (const item of items) {
        jobs.push({
          source: 'deepoffer',
          publishDate: item.update_date || '',
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
      process.stdout.write(`\r[deepoffer] ${jobs.length}/${total}`);
      await sleep(100); // rate limit
    } catch (e) {
      console.error(`\n[deepoffer] Error at offset ${offset}:`, e.message);
      await sleep(2000);
      offset += pageSize;
      pages++;
    }
  }
  console.log(`\n[deepoffer] Done: ${jobs.length} records`);
  return jobs;
}

// ── 求职方舟 ──
async function fetchQiuzhifangzhou() {
  console.log('[qiuzhifangzhou] Fetching...');
  const jobs = [];
  const today = new Date();

  for (let i = 0; i < 60; i++) {
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
      const list = json.campusList || [];

      for (const day of list) {
        for (const item of (day.datas || [])) {
          jobs.push({
            source: 'qiuzhifangzhou',
            publishDate: dateStr,
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
      process.stdout.write(`\r[qiuzhifangzhou] ${jobs.length} records (day ${i + 1}/60)`);
    } catch (e) {
      // skip failed days
    }
  }
  console.log(`\n[qiuzhifangzhou] Done: ${jobs.length} records`);
  return jobs;
}

// ── OfferStar (HTML 解析) ──
async function fetchOfferstar() {
  console.log('[offerstar] Fetching HTML...');
  try {
    const { status, data: html } = await fetch('https://www.offerstar.cn/recruitment');
    if (status !== 200) {
      console.log('[offerstar] Failed:', status);
      return [];
    }

    const jobs = [];
    const regex = /\{\\?"_id\\?":\\?"[^"]+\\?",[\s\S]*?\}/g;
    const matches = html.match(regex) || [];

    for (const m of matches) {
      try {
        const clean = m.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        const obj = JSON.parse(clean);
        if (obj._id && obj.company) {
          const publishDate = obj.createTime
            ? new Date(obj.createTime).toISOString().split('T')[0]
            : '';
          jobs.push({
            source: 'offerstar',
            publishDate,
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
      } catch (e) { /* skip */ }
    }
    console.log(`[offerstar] Done: ${jobs.length} records`);
    return jobs;
  } catch (e) {
    console.error('[offerstar] Error:', e.message);
    return [];
  }
}

// ── Merge & Deduplicate ──
function deduplicate(jobs) {
  const seen = new Map();
  for (const job of jobs) {
    const key = `${job.company}|${job.positions}`.toLowerCase().replace(/\s+/g, '');
    if (!seen.has(key)) {
      seen.set(key, job);
    } else {
      // merge: keep the one with more data
      const existing = seen.get(key);
      if (!existing.applyUrl && job.applyUrl) existing.applyUrl = job.applyUrl;
      if (!existing.announcementUrl && job.announcementUrl) existing.announcementUrl = job.announcementUrl;
      if (!existing.deadline && job.deadline) existing.deadline = job.deadline;
      if (!existing.location && job.location) existing.location = job.location;
    }
  }
  return [...seen.values()];
}

// ── Main ──
async function main() {
  console.log('=== Campus Recruitment Data Fetcher ===\n');

  const [deepoffer, qiuzhifangzhou, offerstar] = await Promise.all([
    fetchDeepOffer(),
    fetchQiuzhifangzhou(),
    fetchOfferstar(),
  ]);

  const allJobs = [...deepoffer, ...qiuzhifangzhou, ...offerstar];
  console.log(`\nTotal raw: ${allJobs.length}`);

  const deduped = deduplicate(allJobs);
  console.log(`After dedup: ${deduped.length}`);

  // Sort by publishDate desc
  deduped.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));

  // Add sequential id
  deduped.forEach((job, i) => { job.id = i + 1; });

  const outPath = path.join(__dirname, 'data', 'jobs.json');
  fs.writeFileSync(outPath, JSON.stringify(deduped, null, 2), 'utf-8');
  console.log(`\nSaved to ${outPath}`);
}

main().catch(console.error);
