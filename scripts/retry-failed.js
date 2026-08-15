/**
 * scripts/retry-failed.js — 重试生成失败的企业简介
 *
 * 读取 data/profile-failures.json（由 generate-profiles.js 记录）中
 * 仍未生成成功的公司，重新调用 Agnes AI 生成。
 * 也支持 --all 模式：全量扫描 jobs 中所有缺简介的公司（等价 fetch-data 的 pending）。
 *
 * 用法：
 *   set MIMO_API_KEY=你的key
 *   node scripts/retry-failed.js          # 只重试失败列表
 *   node scripts/retry-failed.js --all    # 全量扫描重试
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { callProfileApi } = require(path.join(__dirname, '..', 'lib', 'profile-api'));

const ROOT = path.join(__dirname, '..');
const PROFILES_PATH = path.join(ROOT, 'data', 'company-profiles.json');
const FAILURES_PATH = path.join(ROOT, 'data', 'profile-failures.json');
const JOBS_PATH = path.join(ROOT, 'data', 'jobs.json');

const loadJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } };
const saveJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf-8');

async function main() {
  const profiles = loadJson(PROFILES_PATH) || {};
  const jobs = loadJson(JOBS_PATH) || [];

  // 收集公司元信息
  const companyMap = new Map();
  for (const j of jobs) {
    if (!companyMap.has(j.company)) {
      companyMap.set(j.company, { types: new Set(), industries: new Set(), count: 0 });
    }
    const c = companyMap.get(j.company);
    if (j.companyType) c.types.add(j.companyType);
    if (j.industry) c.industries.add(j.industry);
    c.count++;
  }

  // 确定重试名单
  let retryNames;
  if (process.argv.includes('--all')) {
    retryNames = [...companyMap.keys()].filter(c => !profiles[c]);
  } else {
    const failures = loadJson(FAILURES_PATH) || [];
    retryNames = failures.map(f => f.name).filter(c => c && !profiles[c]);
  }

  console.log(`待重试: ${retryNames.length} 家公司\n`);
  if (retryNames.length === 0) { console.log('无需重试。'); return; }

  let generated = 0, failed = 0;
  const newFailures = [];

  for (const name of retryNames) {
    const meta = companyMap.get(name) || { types: new Set(), industries: new Set() };
    const typeStr = [...meta.types].join('/') || '';
    const industryStr = [...meta.industries].join('/') || '';

    process.stdout.write(`[${generated + failed + 1}/${retryNames.length}] ${name}...`);
    const result = await callProfileApi(name, typeStr, industryStr, { retries: 5, log: console });
    if (result) {
      profiles[name] = { summary: result.summary, tags: result.tags };
      generated++;
      console.log(' ✓');
    } else {
      failed++;
      newFailures.push({ name, error: '重试仍失败', time: new Date().toISOString() });
      console.log(' ✗');
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // 保存
  saveJson(PROFILES_PATH, profiles);
  const oldFailures = loadJson(FAILURES_PATH) || [];
  const remaining = [...oldFailures.filter(f => !profiles[f.name]), ...newFailures];
  saveJson(FAILURES_PATH, remaining);

  console.log(`\n\n完成！生成 ${generated} 条，失败 ${failed} 条`);
  if (remaining.length > 0) console.log(`剩余失败 ${remaining.length} 家（见 data/profile-failures.json）`);
}

main().catch((e) => { console.error('程序异常退出:', e.message); process.exit(1); });
