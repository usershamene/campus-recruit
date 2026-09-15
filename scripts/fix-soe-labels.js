/**
 * scripts/fix-soe-labels.js — 修复历史「国企招聘」误标（该类型今已更名为「央国企招聘」）
 *
 * 背景：旧 isSOE 含规则「公司名以行政区划开头即判国企」（已删除），导致大量民企
 *       被误标为「国企招聘」（今「央国企招聘」），例如「广州元游信息技术有限公司」（数据源 companyType=民营）。
 *       历史记录的 recruitmentType 已被该规则覆盖，需用新逻辑重跑 processData 修正。
 *
 * 用法：
 *   node scripts/fix-soe-labels.js --dry-run   # 预览（不写文件）
 *   node scripts/fix-soe-labels.js             # 执行修复
 *
 * 特点：
 *   - 复用 lib/data-processing.js 的 processData（与线上抓取链路同一套逻辑，无重复实现）
 *   - 只更新 recruitmentType 字段，不增删记录
 *   - 输出变化统计与样例（失败/跳过显性化）
 */
const fs = require('fs');
const path = require('path');
const { processData } = require(path.join(__dirname, '..', 'lib', 'data-processing'));

const JOBS_PATH = path.join(__dirname, '..', 'data', 'jobs.json');
const MIN_PATH = path.join(__dirname, '..', 'data', 'jobs.min.json');
const dryRun = process.argv.includes('--dry-run');

const jobs = JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8'));
const beforeSoe = jobs.filter(j => j.recruitmentType === '央国企招聘').length;

// 深拷贝后重跑（processData 原地修改），再用 id 映射回原数组，避免增删记录
const { processed, loginFiltered, expired } = processData(JSON.parse(JSON.stringify(jobs)));
const typeMap = new Map(processed.map(j => [j.id, j.recruitmentType]));

let changed = 0;
const samples = [];
const byCompany = new Map();

for (const job of jobs) {
  const next = typeMap.get(job.id);
  if (next === undefined || next === job.recruitmentType) continue;
  if (samples.length < 15) samples.push(`${job.company} | ${job.recruitmentType} → ${next}`);
  byCompany.set(job.company, `${job.recruitmentType} → ${next}`);
  job.recruitmentType = next;
  changed++;
}

const afterSoe = jobs.filter(j => j.recruitmentType === '央国企招聘').length;

console.log('=== 国企标签修复报告 ===');
console.log(`输入记录: ${jobs.length} 条`);
console.log(`「央国企招聘」: ${beforeSoe} 条 → ${afterSoe} 条（修正 ${beforeSoe - afterSoe} 条）`);
console.log(`recruitmentType 变更: ${changed} 条 / ${byCompany.size} 家公司`);
if (loginFiltered > 0 || expired > 0) {
  console.log(`⚠ processData 另标记待剔除: 登录墙 ${loginFiltered} 条、过期 ${expired} 条（本次不删除，留给 fetch-data 处理）`);
}
console.log('\n变更样例（前 15 条）:');
samples.forEach(s => console.log('  ' + s));

if (dryRun) {
  console.log('\n[dry-run] 未写入文件');
} else {
  fs.writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2), 'utf-8');
  fs.writeFileSync(MIN_PATH, JSON.stringify(jobs), 'utf-8');
  console.log(`\n✅ 已写回 ${path.basename(JOBS_PATH)} + ${path.basename(MIN_PATH)}`);
}
