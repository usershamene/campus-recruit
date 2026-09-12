/**
 * 小红书封面生成脚本
 * 输入: data/jobs.json + 指定日期
 * 输出: data/xhs-content/covers/YYYY-MM-DD.png (1080x1440, 3:4 竖屏)
 *
 * 用法: node scripts/xhs-cover.js [YYYY-MM-DD]
 * 依赖: playwright（项目已装）
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const JOBS_PATH = path.join(__dirname, '..', 'data', 'jobs.json');
const TEMPLATE_PATH = path.join(__dirname, 'xhs-cover-template.html');
// 封面产物归属 xhs-publish 项目（与 publish_xhs.py / run_pipeline.py 的 COVER_DIR 保持一致）
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'xhs-publish', 'covers');

// 不写入文案/封面的岗位（与 xhs-publish/generate.js 保持一致）：
// ① recruitmentType（招聘类型）= 国企招聘
// ② companyType（公司性质）含 央企/国企/央国企（存在 '国企,上市'/'央企,上市' 等复合值，用关键词包含匹配）
const EXCLUDED_RECRUITMENT_TYPES = ['国企招聘'];
const EXCLUDED_COMPANY_KEYWORDS = ['国企', '央企'];

const WIDTH = 1080;
const HEIGHT = 1440;

// 与 generate.js extractTopCompanies 对齐的公司标签映射（知名公司优先）
const COMPANY_TAG_MAP = {
  '腾讯': ['大厂'], '阿里巴巴': ['大厂'], '字节跳动': ['大厂'], '华为': ['大厂'],
  '美团': ['大厂'], '百度': ['大厂'], '京东': ['大厂'], '网易': ['大厂'],
  '小米': ['大厂'], '拼多多': ['大厂'], '字节': ['大厂'], 'Apple苹果': ['大厂'],
  '联想集团': ['大厂'], '高德地图': ['大厂'], '迅雷': ['上市公司'],
  '中国银行': ['央企'], '工商银行': ['央企'], '建设银行': ['央企'], '农业银行': ['央企'],
  '交通银行': ['央企'], '邮储银行': ['央企'], '招商银行': ['银行'], '中国平安': ['保险'],
  '中国人寿': ['央企'], '中国建研院': ['央企'], '华润银行': ['国企'],
};

function getTags(name) {
  if (COMPANY_TAG_MAP[name]) return COMPANY_TAG_MAP[name][0];
  for (const [key, tags] of Object.entries(COMPANY_TAG_MAP)) {
    if (name.includes(key) || key.includes(name)) return tags[0];
  }
  return '';
}

// 提取 Top 公司（按知名度和当日岗位数综合，最多 20 家，封面双列 2×10 网格）
function extractTopCompanies(jobs, limit = 20) {
  const priority = ['大厂', '央企', '国企', '银行', '上市公司'];
  const seen = new Set();
  const top = [];
  for (const job of jobs) {
    if (seen.has(job.company)) continue;
    const tag = getTags(job.company);
    if (tag && priority.includes(tag)) {
      top.push(job.company);
      seen.add(job.company);
    }
    if (top.length >= limit) break;
  }
  // 不足 limit 家时补充当日其他公司（按岗位数排序）
  if (top.length < limit) {
    const countMap = {};
    jobs.forEach(j => { countMap[j.company] = (countMap[j.company] || 0) + 1; });
    const rest = Object.entries(countMap)
      .filter(([c]) => !seen.has(c))
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
    for (const c of rest) {
      top.push(c);
      if (top.length >= limit) break;
    }
  }
  return top;
}

function getDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function main() {
  const dateArg = process.argv[2];
  const today = dateArg || getDate();

  const jobs = JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8'));
  const dayAll = jobs.filter(j => j.publishDate === today);
  const todayJobs = dayAll.filter(j =>
    !EXCLUDED_RECRUITMENT_TYPES.includes(j.recruitmentType)
    && !EXCLUDED_COMPANY_KEYWORDS.some(k => String(j.companyType || '').includes(k)));
  const excluded = dayAll.length - todayJobs.length;
  if (excluded > 0) {
    console.log(`[过滤] 已排除 ${excluded} 条（国企招聘类型 / 央企·国企·央国企公司）岗位（当日共 ${dayAll.length} 条），不写入封面`);
  }
  if (!todayJobs.length) {
    console.log(`${today} 没有新增岗位，跳过封面生成（当日 ${dayAll.length} 条全部为被过滤类型）`);
    process.exit(0);
  }

  const jobCount = todayJobs.length;
  const companyCount = new Set(todayJobs.map(j => j.company)).size;
  const cityCount = new Set(todayJobs.map(j => j.location)).size;
  const topCompanies = extractTopCompanies(todayJobs);

  // 填充模板
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  html = html
    .replace('{jobCount}', jobCount)
    .replace('{companyCount}', companyCount)
    .replace('{cityCount}', cityCount);
  for (let i = 1; i <= 20; i++) {
    const co = topCompanies[i - 1] || '更多公司';
    html = html.replace(`{co${i}}`, co).replace(`{tag${i}}`, getTags(co) || '新岗');
  }

  // 渲染截图
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const outPath = path.join(OUTPUT_DIR, `${today}.png`);
  await page.screenshot({ path: outPath });
  await browser.close();

  console.log(`封面已生成: ${outPath}`);
  console.log(`今日: ${jobCount} 岗位 / ${companyCount} 公司 / ${cityCount} 城市`);
  console.log(`Top: ${topCompanies.join('、')}`);}

main().catch(e => { console.error(e.message); process.exit(1); });
