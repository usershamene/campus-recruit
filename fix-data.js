const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fetchUrl(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('too many redirects'));
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, {
      method: 'GET',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'zh-CN,zh;q=0.9' },
      timeout: 15000,
    }, res => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        const newUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchUrl(newUrl, redirectCount + 1).then(resolve, reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// Extract position info from HTML
function extractPositions(html, url) {
  // Try common patterns
  let pos = '';

  // Pattern: 招聘岗位/职位: xxx
  const posPatterns = [
    /招聘岗位[：:]\s*([^<\n]{2,100})/,
    /岗位名称[：:]\s*([^<\n]{2,100})/,
    /职位名称[：:]\s*([^<\n]{2,100})/,
    /招聘职位[：:]\s*([^<\n]{2,100})/,
    /岗位信息[：:]\s*([^<\n]{2,100})/,
    /"positionName"[：:]\s*"([^"]+)"/,
    /"jobName"[：:]\s*"([^"]+)"/,
    /"title"[：:]\s*"([^"]{2,80})"/,
  ];
  for (const pat of posPatterns) {
    const m = html.match(pat);
    if (m) { pos = m[1].trim(); break; }
  }

  // Try to extract from structured data (JSON-LD)
  if (!pos) {
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const json = JSON.parse(block.replace(/<\/?script[^>]*>/g, ''));
          if (json.title) pos = json.title;
          if (json.name && !pos) pos = json.name;
        } catch {}
      }
    }
  }

  // Try meta tags
  if (!pos) {
    const metaMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (metaMatch) pos = metaMatch[1].trim();
  }

  return pos;
}

// Extract type info from HTML
function extractType(html) {
  const typePatterns = [
    /(202[5-9]届[春夏秋]招)/,
    /(202[5-9]届.*?实习)/,
    /(202[5-9]届.*?提前批)/,
    /(日常实习)/,
    /(暑期实习)/,
    /(补录)/,
    /(校招)/,
    /(春招|秋招)/,
  ];
  for (const pat of typePatterns) {
    const m = html.match(pat);
    if (m) return m[1];
  }
  return '';
}

async function main() {
  const dataPath = path.join(__dirname, 'data', 'jobs.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Find records that need fixing
  const needsFix = data.filter(j => {
    const pos = (j.positions || '').trim();
    return !pos || pos === '详见公告' || pos === '详见' || pos.length < 2;
  });

  console.log(`Total records: ${data.length}`);
  console.log(`Records needing fix: ${needsFix.length}`);

  if (needsFix.length === 0) {
    console.log('No records need fixing.');
    return;
  }

  let fixed = 0;
  let failed = 0;

  for (let i = 0; i < needsFix.length; i++) {
    const job = needsFix[i];
    const url = job.applyUrl || job.announcementUrl;
    if (!url) {
      console.log(`[${i+1}/${needsFix.length}] ${job.company}: No URL available`);
      failed++;
      continue;
    }

    console.log(`[${i+1}/${needsFix.length}] ${job.company}: Fetching ${url.substring(0, 60)}...`);
    try {
      const { status, data: html } = await fetchUrl(url);
      if (status !== 200) {
        console.log(`  -> HTTP ${status}`);
        failed++;
        continue;
      }

      const newPos = extractPositions(html, url);
      const newType = extractType(html);

      let changed = false;
      if (newPos && newPos.length >= 2) {
        job.positions = newPos.length > 80 ? newPos.substring(0, 80) + '...' : newPos;
        changed = true;
        console.log(`  -> Position: ${job.positions}`);
      }
      if (newType) {
        job.recruitmentType = newType;
        changed = true;
        console.log(`  -> Type: ${newType}`);
      }

      if (changed) fixed++;
      else { console.log('  -> No useful data extracted'); failed++; }

      await sleep(1000); // Rate limiting
    } catch (e) {
      console.log(`  -> Error: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nFixed: ${fixed}, Failed: ${failed}`);

  if (fixed > 0) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('Saved to', dataPath);
  }
}

main().catch(console.error);
