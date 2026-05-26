const https = require('https');
const fs = require('fs');
const path = require('path');

// ── Config ──
const API_KEY = process.env.MIMO_API_KEY;
if (!API_KEY) {
  console.error('请设置环境变量 MIMO_API_KEY，例如：');
  console.error('  set MIMO_API_KEY=你的key');
  console.error('  node generate-profiles.js');
  process.exit(1);
}

const API_URL = 'https://api.xiaomimimo.com/v1/chat/completions';
const MODEL = 'mimo-v2.5-pro';
const PROFILES_PATH = path.join(__dirname, 'data', 'company-profiles.json');
const JOBS_PATH = path.join(__dirname, 'data', 'jobs.json');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── API Call ──
function callMiMo(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一个企业信息分析助手，专门为求职者提供简洁准确的企业概况。回答必须严格遵循JSON格式。' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 300,
      temperature: 0.5,
      top_p: 0.9,
      stream: false,
    });

    const req = https.request(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': API_KEY,
      },
      timeout: 30000,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          const content = json.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// ── Main ──
async function main() {
  const jobs = JSON.parse(fs.readFileSync(JOBS_PATH, 'utf-8'));

  // Load existing profiles
  let profiles = {};
  if (fs.existsSync(PROFILES_PATH)) {
    profiles = JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));
  }

  // Get unique companies with their metadata
  const companyMap = new Map();
  for (const j of jobs) {
    if (!companyMap.has(j.company)) {
      companyMap.set(j.company, {
        types: new Set(),
        industries: new Set(),
        count: 0,
      });
    }
    const c = companyMap.get(j.company);
    if (j.companyType) c.types.add(j.companyType);
    if (j.industry) c.industries.add(j.industry);
    c.count++;
  }

  // Filter: skip already profiled, prioritize by frequency
  const companies = [...companyMap.entries()]
    .filter(([name]) => !profiles[name])
    .sort((a, b) => b[1].count - a[1].count);

  console.log(`总公司数: ${companyMap.size}`);
  console.log(`已有简介: ${Object.keys(profiles).length}`);
  console.log(`待生成: ${companies.length}\n`);

  if (companies.length === 0) {
    console.log('所有公司已有简介，无需更新。');
    return;
  }

  let generated = 0;
  let failed = 0;

  for (const [name, meta] of companies) {
    const typeStr = [...meta.types].join('/') || '';
    const industryStr = [...meta.industries].join('/') || '';
    const context = [typeStr, industryStr].filter(Boolean).join('，');

    const prompt = `请为求职者简要介绍"${name}"这家公司${context ? '（' + context + '）' : ''}。要求：1）80-120字，重点突出行业地位、主营业务、规模特点；2）返回3-5个关键标签帮助求职者快速了解企业（如"上市公司""央企""互联网大厂""新能源"等，不要包含招聘类型如"春招""实习"）。严格按JSON格式返回：{"summary":"简介文字","tags":["标签1","标签2"]}`;

    try {
      const raw = await callMiMo(prompt);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.summary && parsed.tags) {
          profiles[name] = parsed;
          generated++;
          process.stdout.write(`\r[${generated}/${companies.length}] ${name} ✓`);
        }
      }
      if (!profiles[name]) {
        failed++;
        console.log(`\n[${generated + failed}/${companies.length}] ${name} ✗ 解析失败`);
      }
    } catch (e) {
      failed++;
      console.log(`\n[${generated + failed}/${companies.length}] ${name} ✗ ${e.message}`);
    }

    // Save every 10 companies
    if (generated % 10 === 0 && generated > 0) {
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
    }

    await sleep(500); // rate limit
  }

  // Final save
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2), 'utf-8');
  console.log(`\n\n完成！生成 ${generated} 条，失败 ${failed} 条`);
  console.log(`已保存至 ${PROFILES_PATH}`);
}

main().catch(console.error);
