# CLAUDE.md

## 项目概述

校园招聘信息聚合网站，部署在 GitHub Pages。从多个数据源抓取校招岗位信息，提供筛选、搜索、企业详情、投递进度管理、Offer 对比等功能。附小红书自动发布引流链路。

## 技术栈

- **前端**: `index.html`（vanilla HTML/CSS/JS）+ `js/profiles.js` + `js/cloud-sync.js`（拆分模块）
- **后端**: `server.js`（Node.js http-server，**仅监听 127.0.0.1**，本地开发用）
- **数据存储**: JSON 文件 + localStorage + Supabase（云端同步）
- **认证**: Supabase Auth（邮箱密码 + GitHub OAuth）
- **部署**: GitHub Pages（push 到 main 自动部署）
- **测试**: Node 内置 `node:test`（49 用例，零依赖）

## 目录结构

```
├── index.html              # 主页面（前端 UI + 业务逻辑，约 3800 行）
├── js/
│   ├── profiles.js         # 企业简介懒加载 + 公司匹配（从 index.html 拆出）
│   └── cloud-sync.js       # Supabase 云同步（从 index.html 拆出）
├── server.js               # 本地开发服务器（端口 8080，仅 127.0.0.1）
├── fetch-data.js           # 数据抓取（增量更新）
├── generate-profiles.js    # AI 企业简介生成（串行，Actions 用）
├── save-profiles.js        # 简介合并工具
├── check-data.js           # 数据质量检查
├── lib/                    # 可复用核心逻辑（纯函数，可单测）
│   ├── data-processing.js  # 去重/国企判定/类型推断/岗位分隔/清洗
│   └── profile-api.js      # Agnes AI 调用 + 3 策略 JSON 解析 + 重试
├── scripts/                # 运营辅助脚本
│   ├── generate-group.js   # 简介批量生成（并行版，subagent 用）
│   ├── retry-failed.js     # 重试失败简介（--all 全量扫描）
│   ├── xhs-auto-publish.js # 小红书自动发布
│   └── README.md           # 小红书发布说明
├── tests/                  # 单测（node:test）
│   ├── data-processing.test.js
│   └── profile-api.test.js
├── docs/                   # 技术文档
│   ├── architecture.md     # 架构与模块说明
│   ├── api.md              # 接口文档
│   ├── configuration.md    # 配置说明
│   └── KNOWN_ISSUES.md     # 已知问题记录
├── .env                    # 环境变量（不提交 git）
├── .github/workflows/daily-update.yml
└── data/
    ├── jobs.json           # 岗位数据（1900+条）
    ├── jobs.min.json       # 压缩版（省 40% 流量）
    ├── company-profiles.json # 企业简介+标签（3900+家）
    ├── update-meta.json    # 更新时间元数据
    ├── pending-profiles.json   # 待生成简介（全量扫描产出，git 跟踪）
    └── profile-failures.json   # 生成失败记录（git 跟踪）
```

## 常用命令

```bash
npm test                     # 运行全部单测（49 用例）
npm run check                # 全部脚本语法检查
node server.js               # 启动本地服务器 http://localhost:8080（仅本机）
node fetch-data.js           # 增量更新校招数据（抓取+合并+清洗+保存）
node generate-profiles.js    # 批量生成企业简介（需要 MIMO_API_KEY，串行）
node scripts/generate-group.js scripts/group-1.json  # 并行生成（传入分组文件）
node scripts/retry-failed.js # 重试失败的企业简介（--all 全量重试）
node check-data.js           # 数据质量检查
# 访问统计后台: http://localhost:8080/admin.html（仅本机，需 SUPABASE_SERVICE_ROLE）
```

## API 配置

### Agnes AI API（企业简介生成）
- **URL**: `https://apihub.agnes-ai.com/v1/chat/completions`
- **Model**: `agnes-2.0-flash`
- **环境变量**: `MIMO_API_KEY`
- **超时**: 120 秒，重试 3-5 次
- **解析**: `lib/profile-api.js` 的 `extractJson` 三策略（非贪婪→末尾截取→代码块）
- **注意**: 所有生成脚本统一走 `lib/profile-api.js`，**不要**在脚本中重复实现 API 调用

### Supabase（数据同步+访问统计）
- **环境变量**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`
- anon key 前端公开属正常；service_role **仅限 .env + 本机 admin.html**，绝不入库

## 自动化更新流程

### GitHub Actions 自动更新（daily-update.yml）
- **运行时间**: 每天 05:00 UTC（约北京 17:00 运行，GitHub 有延迟）
- **超时**: 120 分钟
- **流程**: fetch-data.js（抓取+全量扫描）→ 检查 pending → generate-profiles.js → commit & push
- **关键**: pending 由 fetch-data.js **全量扫描**（非仅新增）→ 生成失败的公司可被下次重试

### 并行简介生成（推荐用于大批量）
1. 将公司分到 `scripts/group-{1..N}.json`（每组 ~29 家）
2. 各 subagent 跑 `node scripts/generate-group.js group-{N}.json`
3. 合并 `group-results-*.json` 到 company-profiles.json（用 save-profiles.js）
4. 或用 `scripts/retry-failed.js` 重试失败记录

## 数据源

| 来源 | 状态 | 说明 |
|------|------|------|
| 求职方舟 | 正常 | API 按天查询，增量抓取 |
| offerstar | 正常 | HTML 抓取，每次全量（正则解析，脆弱） |
| deepoffer | 正常 | HTTPS API，增量抓取 |

## 关键架构

### 数据流
```
fetch(3源并行) → deduplicate(去重) → processData(清洗:登录墙/类型/过期/岗位名)
→ jobs.json + jobs.min.json → 全量扫描缺简介 → pending-profiles.json
→ generate-profiles.js → company-profiles.json + profile-failures.json
```

### index.html 结构
- **CSS**: 暖色调主题，CSS 变量控制，响应式设计
- **JS 分区**: 数据加载（优先 jobs.min.json）→ 筛选渲染 → 公司详情 → 投递管理 → Offer 对比 → 认证 → 云同步
- **模块拆分**: `js/profiles.js`（懒加载简介）、`js/cloud-sync.js`（云同步）已拆出，**必须在主脚本之后加载**

### 用户认证系统
- Supabase Auth（CDN 异步加载），`currentUser` 全局，`onAuthStateChange` 监听
- `sb` 变量在**主脚本开头声明**（不要移回原位，避免 initAnalytics TDZ 错误）

### 数据同步机制
- 未登录: `campus_recruit_progress/offers`
- 登录后: `cr_progress_{userId}/cr_offers_{userId}`
- 自动同步: saveProgress/saveOffers 被 cloud-sync.js patch，保存后 2s 防抖同步

### 企业简介懒加载
- `companyProfiles` 初始为 null，`ensureCompanyProfiles()` 首次需要时 fetch（带 promise 缓存）
- `getCompanyProfile(name)`: 精确 → 后缀清洗 → PROFILE_BRANDS 母公司匹配

### localStorage keys
- `campus_recruit_offers` / `campus_recruit_progress`（未登录）
- `cr_offers_{userId}` / `cr_progress_{userId}`（已登录）
- `cr_visitor_id`（访问统计）、`cr_login_dismissed`、`cr_tutorial_done`（sessionStorage）

### 访问统计
- Supabase `analytics` 表，RLS：任何人可 INSERT，service_role 可 SELECT
- 已知风险: 可刷量（见 docs/KNOWN_ISSUES.md K1）

## 编码规范

- 前端主代码在 `index.html`，**拆分模块放 `js/`**，纯逻辑放 `lib/`（可单测）
- CSS 使用变量（`var(--accent)`），暖色调风格
- 用户输入用 `esc()` 转义防 XSS
- 数据持久化: localStorage（前端）/ JSON 文件（后端）
- 移动端适配: `@media (max-width: 768px)`
- **修改核心逻辑（deduplicate/isSOE/inferType/splitPositions/processData）必须保证 `npm test` 全绿**

## 注意事项

- `index.html` 约 3800 行，编辑时注意行号偏移（改动后跑 `npm run check`）
- GitHub Pages 部署有 1-2 分钟延迟
- `let sb = null` 必须在主脚本开头（TDZ 修复，勿移回）
- Supabase CDN 异步加载，初始化需检查 `window.supabase`
- `scripts/generate-profiles-api.py` 含历史硬编码密钥，**已被 .gitignore 排除，严禁恢复提交**
- Agnes AI 有时响应慢，已设 120s 超时 + 重试；失败记录在 profile-failures.json
- 新增数据文件到 data/ 时，记得在 `.gitignore` 加白名单（`!data/文件名`）
- 完整文档见 `docs/`（architecture/api/configuration/KNOWN_ISSUES）
