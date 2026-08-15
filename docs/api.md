# 接口文档

> 最后更新：2026-08-15

## 一、数据文件（GitHub Pages 静态资源）

### data/jobs.json / data/jobs.min.json
岗位主数据。前端优先加载 `.min.json`（压缩，省 40% 流量），失败回退 `.json`。

```json
[{
  "source": "qiuzhifangzhou | offerstar | deepoffer",
  "publishDate": "2026-08-07",
  "company": "Apple苹果",
  "positions": "硬件、软件和服务、机器学习...",
  "location": "北京、上海、苏州、深圳",
  "deadline": "2026-10-06",
  "applyUrl": "https://...",
  "announcementUrl": "https://...",
  "companyType": "外企",
  "industry": "科技",
  "recruitmentType": "秋招 | 春招 | 提前批 | 实习 | 补录 | 国企招聘 | 校招 | 其他",
  "id": 1
}]
```

### data/company-profiles.json
企业简介索引：`{"公司名": {"summary": "150-250字简介", "tags": ["标签1",...]}}`

### data/pending-profiles.json
待生成简介的公司名数组。由 `fetch-data.js` 每次运行**全量扫描**产出（非仅新增），保证失败可重试。

### data/profile-failures.json
生成失败记录：`[{"name": "公司名", "error": "原因", "time": "ISO时间"}]`。用 `node scripts/retry-failed.js` 重试。

### data/update-meta.json
`{"lastUpdate": "ISO时间", "success": true}`

## 二、本地服务器 API（server.js，仅 127.0.0.1）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/api/update` | 本机 或 `x-update-token`/`?token=` | 触发 `node fetch-data.js`（异步执行，立即返回 200） |
| GET | `/api/update-meta` | 无 | 返回上次更新时间 |
| GET | `/api/admin-key` | **仅本机回环地址** | 返回 SUPABASE_SERVICE_ROLE（admin.html 用） |

安全约束（P0 修复后）：
- 服务器仅监听 `127.0.0.1`，局域网/公网不可达
- 本机判定基于 `req.socket.remoteAddress`（TCP 层），**不可被 Host 头伪造**
- 目录穿越：`path.normalize` + `startsWith(ROOT)` 双重防护，测试验证 403

## 三、前端存储（localStorage）

| Key | 用途 |
|-----|------|
| `campus_recruit_progress` | 投递进度（未登录） |
| `campus_recruit_offers` | Offer 对比（未登录） |
| `cr_progress_{userId}` / `cr_offers_{userId}` | 已登录用户数据 |
| `cr_visitor_id` | 访客标识（访问统计） |
| `cr_login_dismissed` / `cr_tutorial_done` | sessionStorage：登录提醒/教程 |

## 四、Supabase 表结构

| 表 | 用途 | RLS 要求 |
|----|------|----------|
| `progress_records` | 投递进度 | 必须 `auth.uid() = user_id` |
| `offers` | Offer 对比 | 必须 `auth.uid() = user_id` |
| `analytics` | 访问统计 | 任何人可 INSERT（刷量风险，建议加限流） |

## 五、Agnes AI 接口（简介生成）

- URL: `https://apihub.agnes-ai.com/v1/chat/completions`
- Model: `agnes-2.0-flash`
- 认证: `Authorization: Bearer MIMO_API_KEY`
- 超时: 120s，重试 3-5 次
- 响应解析：`extractJson` 三策略（非贪婪 → 末尾截取 → 代码块）
