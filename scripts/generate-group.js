/**
 * scripts/generate-group.js — 企业简介批量生成（并行版，供多个 subagent 并行跑）
 *
 * 用法：
 *   set MIMO_API_KEY=你的key
 *   node scripts/generate-group.js scripts/group-1.json
 *   # 或从 stdin 读公司数组：cat group.json | node scripts/generate-group.js
 *
 * 输入格式（group-*.json / stdin）：
 *   [{"name":"公司名","types":"国企/外企","industries":"科技","count":3}, ...]
 * 或简化为字符串数组：["公司A","公司B"]
 *
 * 输出：scripts/group-results-{随机}.json（含 results/failed/group）
 * 注意：本脚本仅输出结果文件，不直接写入 company-profiles.json，
 *       合并需用 node save-profiles.js '{"公司":{"summary":"...","tags":[...]}}'
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { callProfileApi } = require(path.join(__dirname, '..', 'lib', 'profile-api'));

// 读入公司列表：优先命令行参数文件，否则 stdin
function readCompanies() {
  const groupFile = process.argv[2];
  let raw;
  if (groupFile) {
    raw = fs.readFileSync(groupFile, 'utf-8');
  } else {
    raw = fs.readFileSync('/dev/stdin', 'utf-8');
  }
  const data = JSON.parse(raw);
  // 兼容两种输入格式：对象数组 / 字符串数组
  return (Array.isArray(data) ? data : []).map(item =>
    typeof item === 'string' ? { name: item, types: '', industries: '' } : item
  ).filter(c => c && c.name);
}

(async () => {
  const companies = readCompanies();
  console.log(`Processing group of ${companies.length} companies...`);

  const results = [];
  const failed = [];

  for (let i = 0; i < companies.length; i++) {
    const { name, types = '', industries = '' } = companies[i];
    process.stdout.write(`[${i + 1}/${companies.length}] ${name}...`);
    const result = await callProfileApi(name, types, industries, { retries: 5, log: console });
    if (result) {
      results.push({ name, summary: result.summary, tags: result.tags });
      console.log(' ✓');
    } else {
      failed.push(name);
      console.log(' ✗');
    }
    await new Promise(r => setTimeout(r, 500)); // 限速
  }

  // 保存组结果
  const outPath = path.join(__dirname, `group-results-${Math.floor(Math.random() * 10000)}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ results, failed, group: companies.map(c => c.name) }, null, 2));

  console.log(`\n组结果: ${companies.length} 家公司, 成功 ${results.length}, 失败 ${failed.length}`);
  console.log(`结果文件: ${outPath}`);
  if (failed.length > 0) console.log(`失败的: ${failed.join(', ')}`);
  console.log('合并到正式库: node save-profiles.js "$(cat ' + outPath + ')" 或手动合并');
})();
