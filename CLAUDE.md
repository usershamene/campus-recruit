# CLAUDE.md

## 项目概述

校园招聘信息聚合网站，部署在 GitHub Pages。从多个数据源抓取校招岗位信息，提供筛选、搜索、企业详情、投递进度管理、Offer 对比等功能。

## 技术栈

- **前端**: 单文件 `index.html`（vanilla HTML/CSS/JS，无框架）
- **后端**: `server.js`（Node.js http-server，本地开发用）
- **数据存储**: JSON 文件 + localStorage + Supabase（云端同步）
- **认证**: Supabase Auth（邮箱密码 + GitHub OAuth）
- **部署**: GitHub Pages（push 到 main 自动部署）
- **测试**: Playwright（headless browser）

## 目录结构

```
├── index.html              # 主页面（所有前端代码）
├── admin.html              # 访问统计管理后台（不提交 git）
├── server.js               # 本地开发服务器（端口 8080）
├── fetch-data.js           # 数据抓取（增量更新）
├── process-data.js         # 数据清洗（已集成到 fetch-data.js）
├── generate-profiles.js    # AI 企业简介生成（本地脚本，逐个调用 API）
├── fix-data.js             # 数据修复脚本
├── scripts/                # 并行简介生成工具集
│   ├── generate-group.js   # 单组公司简介批量生成（支持命令行传参）
│   ├── retry-failed.js     # 重试失败的企业简介
│   ├── groups.jsonl        # 企业分组文件（每行一个 JSON 数组）
│   └── group-*.json        # 输入：待生成员工组文件
├── .env                    # 环境变量（不提交 git）
├── .github/
│   └── workflows/
│       └── daily-update.yml # GitHub Actions 自动更新（每天 17:00）
├── data/
│   ├── jobs.json           # 岗位数据（主数据源，1460+条）
│   ├── company-profiles.json # 企业简介+标签（3600+家）
│   ├── update-meta.json    # 更新时间元数据
│   └── pending-profiles.json # 待生成简介企业列表（gitignore）
└── package.json
```

## 常用命令

```bash
node server.js              # 启动本地服务器 http://localhost:8080
node fetch-data.js          # 增量更新校招数据（抓取+合并+清洗+保存）
node generate-profiles.js   # 批量生成企业简介（需要 MIMO_API_KEY，逐个串行）
node scripts/generate-group.js scripts/group-1.json  # 并行生成（传入分组文件）
node scripts/retry-failed.js  # 重试失败的企业简介
# 访问统计后台: http://localhost:8080/admin.html
```

## API 配置

### Agnes AI API（企业简介生成）
- **URL**: `https://apihub.agnes-ai.com/v1/chat/completions`
- **Model**: `agnes-2.0-flash`
- **环境变量**: `MIMO_API_KEY`
- **超时**: 120 秒，最多重试 5 次
- **备注**: 实际为 Agnes AI 兼容 API，密钥名沿用 `MIMO_API_KEY`

### Supabase（数据同步+访问统计）
- **环境变量**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`

## 自动化更新流程

### GitHub Actions 自动更新
- **配置文件**: `.github/workflows/daily-update.yml`
- **超时**: 120 分钟（之前 30 分钟会导致简介生成超时）
- **运行时间**: 每天 17:00（北京时间，UTC 05:00 + GitHub 延迟）
- **更新流程**:
  1. 运行 `fetch-data.js` 抓取增量数据
  2. 检查 `data/pending-profiles.json` 是否有待生成简介
  3. 运行 `generate-profiles.js` 生成简介（串行调用 API，全量处理）
  4. 自动提交并推送更新

### 并行简介生成（推荐）
全量生成时串行 API 调用太慢（~60 秒/家），推荐用 `scripts/generate-group.js` 分多组并行：
1. 将企业列表分到 `scripts/group-{1..N}.json`（每组 ~29 家）
2. 各启动一个 subagent 分别执行 `node scripts/generate-group.js group-{N}.json`
3. 合并所有 `group-results-*.json` 到 `company-profiles.json`
4. 或用 `scripts/retry-failed.js` 重试失败的企业

### 手动简介生成流程
每次 `fetch-data.js` 运行后：
1. 自动检测新公司 → 写入 `data/pending-profiles.json`
2. 使用 mimo API 生成简介（调用 subagent 或脚本）
3. 保存到 `company-profiles.json` 并清理 pending
4. 提交推送更新

## 数据源

| 来源 | 状态 | 说明 |
|------|------|------|
| 求职方舟 | 正常 | API 按天查询，增量抓取 |
| offerstar | 正常 | HTML 抓取，每次全量 |
| deepoffer | 已恢复 | HTTPS API，增量抓取 |

## 关键架构

### index.html 结构
- **CSS**: 暖色调主题，CSS 变量控制，响应式设计（移动端/桌面端）
- **HTML**: header + tab 切换（校招信息/投递进度/Offer 对比）+ modal + 抽屉
- **JS**: 数据加载 → 筛选渲染 → 公司详情卡片 → 投递管理 → Offer 对比 → 用户认证 → 云端同步

### 用户认证系统
- **登录方式**: 邮箱密码 + GitHub OAuth
- **认证服务**: Supabase Auth（异步加载 CDN）
- **用户状态**: `currentUser` 全局变量，通过 `onAuthStateChange` 监听
- **UI 更新**: 登录后显示用户名，支持账户管理、切换账号、退出登录

### 数据同步机制
- **本地存储**: 未登录时使用 `campus_recruit_progress/offers`
- **用户存储**: 登录后使用 `cr_progress_{userId}/cr_offers_{userId}`
- **数据合并**: 登录时自动合并本地数据到用户账户（`mergeLocalToUser`）
- **云端同步**: `mergeLocalToCloud` + `syncFromCloud` 双向同步

### 数据更新流程
1. `fetch-data.js` 读取 `update-meta.json` 获取上次更新时间
2. 计算天数差，只抓取增量数据
3. 与已有 `jobs.json` 合并去重
4. 清洗：normalize 类型、删除过期、截断过长岗位名、重排 ID
5. 保存并更新 `update-meta.json`

### 企业简介匹配逻辑（getCompanyProfile）
1. 精确匹配 `companyProfiles[companyName]`
2. 清洗后缀匹配（-补录/-急招/（三）等）
3. 母公司品牌匹配（PROFILE_BRANDS 列表）

### localStorage keys
- `campus_recruit_offers` — Offer 对比数据（未登录）
- `campus_recruit_progress` — 投递进度记录（未登录）
- `cr_offers_{userId}` — Offer 对比数据（已登录用户）
- `cr_progress_{userId}` — 投递进度记录（已登录用户）
- `cr_login_dismissed` — 登录提醒已知晓（sessionStorage）
- `cr_tutorial_done` — 使用教程已完成（sessionStorage）
- `cr_visitor_id` — 访客唯一标识（用于访问统计）

### 访问统计系统
- **数据表**: Supabase `analytics` 表，记录 pageview/login 等事件
- **字段**: visitor_id, event, user_id, device, created_at
- **RLS**: 任何人可 INSERT，只有 service_role 可 SELECT
- **管理后台**: `admin.html`（本地访问，从 server.js 获取 service_role key）
- **统计指标**: 今日 PV/UV、总 PV/UV、登录用户数、次日留存率、设备分布、功能使用

### UI 组件
- **抽屉组件**: 移动端模态框使用底部抽屉形式（50vh/75vh/80vh）
- **筛选抽屉**: 二级结构，公司/类型/岗位/城市分类筛选
- **使用教程**: 首次访问显示 5 步引导教程
- **登录提醒**: 未登录用户操作时弹出提醒（sessionStorage 控制同会话不重复）

## 编码规范

- 所有前端代码在 `index.html` 单文件内
- CSS 使用变量（`var(--accent)` 等），保持暖色调风格
- JS 使用 vanilla，无框架依赖
- 用户输入用 `esc()` 函数转义防 XSS
- 数据持久化用 localStorage（前端）/ JSON 文件（后端）
- 移动端适配使用 `@media (max-width: 768px)` 断点

## 注意事项

- `index.html` 超过 1700 行，编辑时注意行号偏移
- GitHub Pages 部署有 1-2 分钟延迟
- `let` 变量有 temporal dead zone，不要在声明前调用
- Supabase CDN 异步加载，初始化需检查 `window.supabase` 是否存在
- 移动端和桌面端使用不同的 UI 组件（表格 vs 卡片）
- GitHub Actions 定时任务有延迟（约 4 小时），cron 时间已调整补偿
- Agnes AI API 有时响应较慢，已设置 120 秒超时和重试机制
- `scripts/retry-failed.js` 会遗漏部分公司（无类型/行业信息），建议优先用分组文件方式生成
- GitHub Actions 串行生成简介很慢（全量 ~3500 家 × 60s ≈ 50 分钟以上），需确保 workflow timeout ≥ 120 分钟
