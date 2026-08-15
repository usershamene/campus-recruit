/**
 * generate-profiles.js — 企业简介生成（串行版，GitHub Actions 每日运行）
 *
 * 从 data/pending-profiles.json 读取待生成公司（由 fetch-data.js 全量扫描产出），
 * 调用 Agnes AI API 生成简介，保存到 data/company-profiles.json。
 * 生成失败的公司记录到 data/profile-failures.json（供 retry-failed.js 重试）。
 *
 * 用法：
 *   set MIMO_API_KEY=你的key
 *   node generate-profiles.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { callProfileApi } = require('./lib/profile-api');

// ── 路径 ──
const ROOT = __dirname;
const PROFILES_PATH = path.join(ROOT, 'data', 'company-profiles.json');
const PENDING_PATH = path.join(ROOT, 'data', 'pending-profiles.json');
const FAILURES_PATH = path.join(ROOT, 'data', 'profile-failures.json');

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; }
}
function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

async function main() {
  const jobs = loadJson(path.join(ROOT, 'data', 'jobs.json')) || [];
  const profiles = loadJson(PROFILES_PATH) || {};
  const pending = loadJson(PENDING_PATH);

  // 优先级：pending 列表 > 全量扫描兜底
  // pending 由 fetch-data.js 全量扫描生成；若缺失（首次运行/本地），从 jobs 全量推导
  let companies = pending;
  if (!Array.isArray(companies)) {
    companies = [...new Set(jobs.map(j => j.company))].filter(c => !profiles[c]);
  }
  companies = companies.filter(c => c && !profiles[c]);

  console.log(`总公司数: ${new Set(jobs.map(j => j.company)).size}`);
  console.log(`已有简介: ${Object.keys(profiles).length}`);
  console.log(`待生成: ${companies.length}\n`);

  if (companies.length === 0) {
    console.log('所有公司已有简介，无需更新。');
    return;
  }

  // 收集公司元信息（类型/行业）用于 prompt 上下文
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

  let generated = 0, failed = 0;
  const failures = [];

  for (const name of companies) {
    const meta = companyMap.get(name) || { types: new Set(), industries: new Set() };
    const typeStr = [...meta.types].join('/') || '';
    const industryStr = [...meta.industries].join('/') || '';

    const result = await callProfileApi(name, typeStr, industryStr, { retries: 3, log: console });
    if (result) {
      profiles[name] = { summary: result.summary, tags: result.tags };
      generated++;
      process.stdout.write(`\r[${generated + failed}/${companies.length}] ${name} ✓`);
    } else {
      failed++;
      failures.push({ name, error: 'API 调用/解析失败（3 次重试后）', time: new Date().toISOString() });
      console.log(`\n[${generated + failed}/${companies.length}] ${name} ✗ 已记录到失败列表`);
    }

    // 每生成 10 家增量保存一次（防中断丢失）
    if (generated % 10 === 0 && generated > 0) {
      saveJson(PROFILES_PATH, profiles);
    }
    await new Promise(r => setTimeout(r, 500)); // 限速
  }

  // 最终保存 + 失败落库
  saveJson(PROFILES_PATH, profiles);
  const oldFailures = loadJson(FAILURES_PATH) || [];
  const mergedFailures = [
    ...oldFailures.filter(f => !profiles[f.name]),
    ...failures,
  ];
  saveJson(FAILURES_PATH, mergedFailures);

  // 更新 pending（清空已处理）
  saveJson(PENDING_PATH, []);

  console.log(`\n\n完成！生成 ${generated} 条，失败 ${failed} 条`);
  console.log(`已保存至 ${PROFILES_PATH}`);
  if (failed > 0) console.log(`失败 ${failed} 家已记录至 ${FAILURES_PATH}，可用 scripts/retry-failed.js 重试`);
}

main().catch((e) => { console.error('程序异常退出:', e.message); process.exit(1); });
