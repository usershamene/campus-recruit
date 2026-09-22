/**
 * scripts/fix-anticrawl-links.js — 清理现有数据中的反爬/聚合站链接
 *
 * 背景：求职方舟部分岗位的 applyUrl/announcementUrl 被替换为 givemeoc.com 等
 *       聚合站跳转链接（非官方投递入口）。processData 已内置域名黑名单过滤，
 *       但历史数据的 recruitmentType 已终值化，不能重跑 processData → 用本脚本按
 *       同一规则清理：命中黑名单的链接清空；清空后无任何入口的岗位移除。
 *
 * 用法：node scripts/fix-anticrawl-links.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { isAntiCrawlUrl } = require(path.join(__dirname, '..', 'lib', 'data-processing'));

const JOBS_PATH = path.join(__dirname, '..', 'data', 'jobs.json');
const MIN_PATH = path.join(__dirname, '..', 'data', 'jobs.min.json');
const dryRun = process.argv.includes('--dry-run');

const jobs = JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8'));
const before = jobs.length;

let linksCleared = 0, removed = 0;
const removedSamples = [];
const out = jobs.filter(job => {
  const hadAnyEntry = !!(job.applyUrl || job.announcementUrl);
  let changed = false;
  if (isAntiCrawlUrl(job.applyUrl)) { job.applyUrl = ''; changed = true; }
  if (isAntiCrawlUrl(job.announcementUrl)) { job.announcementUrl = ''; changed = true; }
  if (changed) linksCleared++;
  if (hadAnyEntry && !job.applyUrl && !job.announcementUrl) {
    removed++;
    if (removedSamples.length < 5) removedSamples.push(`${job.company} | ${String(job.positions).slice(0, 28)} | ${job.publishDate}`);
    return false;
  }
  return true;
});

console.log('=== 反爬链接清理报告 ===');
console.log(`输入: ${before} 条`);
console.log(`清空反爬链接: ${linksCleared} 处`);
console.log(`移除无入口岗位: ${removed} 条（其余保留）`);
console.log(`输出: ${out.length} 条`);
console.log('\n移除样例:');
removedSamples.forEach(x => console.log('  ' + x));

if (dryRun) {
  console.log('\n[dry-run] 未写入文件');
} else {
  fs.writeFileSync(JOBS_PATH, JSON.stringify(out, null, 2), 'utf-8');
  fs.writeFileSync(MIN_PATH, JSON.stringify(out), 'utf-8');
  console.log(`\n✅ 已写回 ${path.basename(JOBS_PATH)} + ${path.basename(MIN_PATH)}`);
}
