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
  // 春招系列 → 统一归入春招/补录
  '26春招': '春招', '26届春招': '春招', '27春招': '春招',
  '25春招': '春招', '24春招': '春招', '23春招': '春招', '29春招': '春招',
  // 秋招系列 → 统一归入秋招/提前批
  '26秋招': '秋招', '27秋招': '秋招', '27届实习': '日常实习',
  '27提前批': '提前批', '26提前批': '提前批',
  // 实习
  '日常实习': '日常实习', '暑期实习': '暑期实习',
  // 基础类型
  '提前批': '提前批', '补录': '补录', '实习': '日常实习', '校招': '校招', '专岗': '其他',
  '春招': '春招', '春招补录': '补录',
};

// ── 岗位名智能分隔 ──
function splitPositions(text) {
  if (!text) return text;
  // 如果已经有顿号分隔，直接返回
  if (/[、，,]/.test(text)) return text;

  // 先处理括号内的内容（避免误分隔）
  let result = text;
  const brackets = [];
  result = result.replace(/[（(][^）)]*[）)]/g, (m) => {
    brackets.push(m);
    return `__BR${brackets.length - 1}__`;
  });

  // 将空格替换为顿号
  result = result.replace(/\s+/g, '、');

  // 岗位后缀关键词（排除容易误匹配的：类、开发、测试、岗、管理）
  const suffixes = '工程师|经理|专员|助理|岗位|方向|管培生|培训生|研究员|设计师|分析师|实习生|教师|教练|顾问|主管|总监|副总|总裁|会计|出纳|审计|法务|律师|编辑|记者|运营|销售|客服|前台|秘书|文员|司机|保安|保洁|厨师|护士|医生|药师|技工|技师|工人|师傅|职类|业务|承做|人员|序列|咨询';
  // 在后缀后面添加顿号（如果后面紧跟中文或英文）
  const regex = new RegExp(`(${suffixes})(?=[一-龥a-zA-Z])`, 'g');
  result = result.replace(regex, '$1、');

  // 恢复括号内容
  result = result.replace(/__BR(\d+)__/g, (_, i) => brackets[parseInt(i)]);

  // 清理多余的顿号
  result = result.replace(/、+/g, '、').replace(/、$/, '');
  return result;
}

function inferType(job) {
  // 组合所有文本用于推断
  const text = [
    job.recruitmentType || '',
    job.company || '',
    job.positions || '',
    job.announcementUrl || '',
  ].join(' ');

  // 1. 明确标注的年份+类型 → 统一去掉届数
  if (/27秋招|27届秋招|27秋/.test(text)) return '秋招';
  if (/26秋招|26届秋招|26秋/.test(text)) return '秋招';
  if (/27提前批|27届提前批/.test(text)) return '提前批';
  if (/26提前批|26届提前批/.test(text)) return '提前批';
  if (/27实习|27届实习/.test(text)) return '日常实习';

  // 2. 秋招/提前批
  if (/秋招|秋季招聘|秋招提前批/.test(text)) return '秋招';
  if (/提前批|早鸟|SP\.SP|SSP/.test(text)) return '提前批';

  // 3. 实习
  if (/日常实习|日常实习/.test(text)) return '日常实习';
  if (/暑期实习|暑实习|Summer Intern/.test(text)) return '暑期实习';
  if (/实习|internship|实习生/.test(text)) return '日常实习';

  // 4. 春招相关
  if (/春招补录|春季补录/.test(text)) return '补录';
  if (/26春招|26届春招/.test(text)) return '春招';
  if (/27春招|27届春招/.test(text)) return '春招';
  if (/春招|春季招聘/.test(text)) return '春招';

  // 5. 补录
  if (/补录|扩招|追加招聘|第二批|第三批|第四批|第五批/.test(text)) return '补录';

  // 6. 校招兜底
  if (/校招|校园招聘|社会招聘|社招/.test(text)) {
    return /社会招聘|社招/.test(text) ? '其他' : '校招';
  }

  return '校招';
}

function processData(jobs) {
  const today = new Date().toISOString().split('T')[0];

  const cleaned = jobs.filter(job => {
    const fields = [job.company, job.positions, job.location, job.applyUrl, job.announcementUrl];
    const hasLoginWall = fields.some(f => f && /登录后可见/.test(f));
    if (hasLoginWall) {
      console.log(`  [filtered] ${job.company} / ${job.source}`);
      return false;
    }
    return true;
  });
  const loginWallCount = jobs.length - cleaned.length;

  for (const job of cleaned) {
    const rawType = (job.recruitmentType || '').trim();
    // 先用 TYPE_MAP 规范化数据源提供的类型
    job.recruitmentType = TYPE_MAP[rawType] || rawType;
    // 修正年份标记错误的春招（24春招/25春招/26春招等 → 春招）
    if (/^2\d春招$/.test(job.recruitmentType)) {
      job.recruitmentType = '春招';
    }
    // 如果数据源类型不明确或为空，从标题/岗位名推断
    if (!rawType || !TYPE_MAP[rawType]) {
      job.recruitmentType = inferType(job);
    }
    // 如果数据源类型是"春招"但文本中也能推断出更具体的类型，用推断的
    // （例如标题写了"秋招提前批"但 recruitmentType 只写了"春招"）
    if (rawType && TYPE_MAP[rawType]) {
      const inferred = inferType(job);
      // 如果推断结果比数据源类型更具体（不是"校招"兜底），优先使用
      if (inferred !== '校招' && inferred !== rawType) {
        job.recruitmentType = inferred;
      }
    }
  }

  const filtered = cleaned.filter(job => {
    const dl = (job.deadline || '').trim();
    if (!dl || dl === '尽快投递' || dl === '-') return true;
    return dl.replace(/\//g, '-') >= today;
  });

  for (const job of filtered) {
    let p = (job.positions || '').trim();
    p = p.replace(/[,，、;；\s]+$/, '');
    p = p.replace(/^本次共[计招聘]*\d+人[、，,]?\s*/, '');
    if (/^具体.*详见附件/.test(p)) p = '详见公告';
    // 智能分隔岗位名
    p = splitPositions(p);
    if (p.length > 80) p = p.substring(0, 80) + '...';
    job.positions = p;
  }

  filtered.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
  filtered.forEach((job, i) => { job.id = i + 1; });
  return { processed: filtered, loginFiltered: loginWallCount, expired: cleaned.length - filtered.length };
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

  // Save
  fs.writeFileSync(JOBS_PATH, JSON.stringify(processed, null, 2), 'utf-8');
  saveMeta(now.toISOString());
  console.log(`\nSaved: ${JOBS_PATH}`);
  console.log(`Next update will fetch from: ${todayStr}`);

  // Identify NEW companies without profiles (only from this update)
  const profilesPath = path.join(__dirname, 'data', 'company-profiles.json');
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8')); } catch {}
  const existingCompanySet = new Set(existing.map(j => j.company));
  const newCompanies = [...new Set(processed.filter(j => !existingCompanySet.has(j.company)).map(j => j.company))];
  const missingNew = newCompanies.filter(c => !profiles[c]);
  const pendingPath = path.join(__dirname, 'data', 'pending-profiles.json');
  if (missingNew.length > 0) {
    fs.writeFileSync(pendingPath, JSON.stringify(missingNew, null, 2), 'utf-8');
    console.log(`\n⚠ ${missingNew.length} new companies need profiles → data/pending-profiles.json`);
    console.log(`ACTION_REQUIRED: GENERATE_PROFILES`);
  } else {
    fs.writeFileSync(pendingPath, JSON.stringify([], null, 2), 'utf-8');
    console.log('\n✓ All new companies have profiles');
  }
}

main().catch(console.error);
