/**
 * lib/profile-api.js — 企业简介生成公共模块（Agnes AI API）
 *
 * 统一 generate-profiles.js / generate-group.js / retry-failed.js 三份脚本的
 * API 调用与响应解析逻辑，消灭重复代码。
 *
 * 用法：
 *   const { callProfileApi, extractJson } = require('./lib/profile-api');
 *   const result = await callProfileApi('某某公司', '国企/外企', '科技');
 *   // result => { name, summary, tags } 或 null
 */

'use strict';

const https = require('https');

const API_URL = 'https://apihub.agnes-ai.com/v1/chat/completions';
const MODEL = 'agnes-2.0-flash';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 从 LLM 响应文本中健壮地提取 JSON（3 种策略依次尝试）：
 *  1. 非贪婪匹配首个 {...}
 *  2. 从最后一个 { 截取到末尾
 *  3. Markdown 代码块 ```json ... ```
 */
function extractJson(text) {
  if (!text) return null;
  let parsed = null;

  // 策略1：非贪婪首个 JSON 对象
  const match1 = text.match(/\{[\s\S]*?\}/);
  if (match1) {
    try { parsed = JSON.parse(match1[0]); } catch { /* try next */ }
  }

  // 策略2：最后一个 { 到末尾
  if (!parsed) {
    const idx = text.lastIndexOf('{');
    if (idx >= 0) {
      try { parsed = JSON.parse(text.slice(idx)); } catch { /* try next */ }
    }
  }

  // 策略3：Markdown 代码块
  if (!parsed) {
    const match3 = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match3) {
      try { parsed = JSON.parse(match3[1]); } catch { /* give up */ }
    }
  }

  return parsed;
}

/**
 * 调用 Agnes AI 生成企业简介
 * @param {string} name 公司名
 * @param {string} [types] 公司类型（国企/外企等，可空）
 * @param {string} [industries] 行业（可空）
 * @param {object} [opts] 可选：{ retries=3, timeout=120000, log }
 * @returns {Promise<{name:string,summary:string,tags:string[]}|null>} 失败返回 null
 */
async function callProfileApi(name, types, industries, opts = {}) {
  const { retries = 3, timeout = 120000, log = console } = opts;
  const context = [types, industries].filter(Boolean).join('，');
  const prompt = `请为求职者全面介绍"${name}"这家公司${context ? '（' + context + '）' : ''}。简介需涵盖以下方面（150-250字）：
1）公司概况：成立时间、总部地点、主营业务/核心产品
2）行业地位：市场份额、竞争优势、知名产品
3）企业规模：员工体量、营收水平、上市情况
4）工作体验参考：薪资水平、加班情况、企业文化特点（如有公开信息）
最后返回3-5个关键特征标签（如"上市公司""互联网大厂""央企""996""薪资有竞争力"等，不含招聘类型）。
严格按JSON格式返回：{"summary":"简介文字","tags":["标签1","标签2"]}`;

  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: 'system', content: '你是一个企业信息分析助手，专门为求职者提供简洁准确的企业概况。回答必须严格遵循JSON格式。' },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: 2000,
    temperature: 0.5,
    top_p: 0.9,
    stream: false,
  });

  for (let i = 0; i < retries; i++) {
    try {
      const content = await new Promise((resolve, reject) => {
        const req = https.request(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${process.env.MIMO_API_KEY}`,
          },
          timeout,
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error) return reject(new Error(json.error.message));
              resolve(json.choices?.[0]?.message?.content || '');
            } catch (e) { reject(e); }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(Buffer.from(body, 'utf-8'));
        req.end();
      });

      const parsed = extractJson(content);
      if (parsed && parsed.summary && Array.isArray(parsed.tags)) {
        return { name, summary: parsed.summary, tags: parsed.tags };
      }
      if (i < retries - 1) {
        log.log(`  ${name} 响应解析失败，重试 ${i + 1}/${retries}...`);
        await sleep(5000);
      }
    } catch (e) {
      if (i < retries - 1) {
        log.log(`  ${name} 错误: ${e.message} 重试 ${i + 1}/${retries}`);
        await sleep(5000);
      }
    }
  }
  return null;
}

module.exports = { API_URL, MODEL, extractJson, callProfileApi };
