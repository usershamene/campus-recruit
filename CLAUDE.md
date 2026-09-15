# CLAUDE.md

## 项目概述

校园招聘信息聚合网站，部署在 GitHub Pages。从多个数据源抓取校招岗位信息，提供筛选、搜索、企业详情、投递进度管理、Offer 对比等功能。

> 小红书引流发布链路的代码与文档在**独立项目** `../xhs-publish/`（不在本仓库）。

## 技术栈

- **前端**: `index.html`（vanilla HTML/CSS/JS）+ `js/cloud-sync.js`（拆分模块）
- **后端**: `server.js`（Node.js http-server，**仅监听 127.0.0.1**，本地开发用）
- **数据存储**: JSON 文件 + localStorage + Supabase（云端同步）
- **认证**: Supabase Auth（邮箱密码 + GitHub OAuth）
- **部署**: GitHub Pages（push 到 main 自动部署）
- **测试**: Node 内置 `node:test`（41 用例，零依赖）

## 目录结构

```
├── index.html              # 主页面（前端 UI + 业务逻辑，约 3800 行）
├── js/
│   └── cloud-sync.js       # Supabase 云同步（从 index.html 拆出）
├── server.js               # 本地开发服务器（端口 8080，仅 127.0.0.1）
├── fetch-data.js           # 数据抓取（增量更新）
├── check-data.js           # 数据质量检查
├── lib/                    # 可复用核心逻辑（纯函数，可单测）
│   └── data-processing.js  # 去重/国企判定/类型推断/岗位分隔/清洗
├── scripts/                # 数据运维脚本
│   └── fix-soe-labels.js   # 历史「国企招聘」误标修复
├── tests/                  # 单测（node:test）
│   └── data-processing.test.js
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
    └── update-meta.json    # 更新时间元数据
```

## 常用命令

```bash
npm test                     # 运行全部单测（41 用例）
npm run check                # 全部脚本语法检查
node server.js               # 启动本地服务器 http://localhost:8080（仅本机）
node fetch-data.js           # 增量更新校招数据（抓取+合并+清洗+保存）
node check-data.js           # 数据质量检查
# 访问统计后台: http://localhost:8080/admin.html（仅本机，需 SUPABASE_SERVICE_ROLE）
```

## API 配置

### Supabase（数据同步+访问统计）
- **环境变量**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE`
- anon key 前端公开属正常；service_role **仅限 .env + 本机 admin.html**，绝不入库

## 自动化更新流程

### GitHub Actions 自动更新（daily-update.yml）
- **运行时间**: 每天 05:00 UTC（约北京 17:00 运行，GitHub 有延迟）
- **超时**: 120 分钟
- **流程**: fetch-data.js（抓取+清洗）→ commit & push

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
→ jobs.json + jobs.min.json → commit & push
```

### index.html 结构
- **CSS**: 暖色调主题，CSS 变量控制，响应式设计
- **JS 分区**: 数据加载（优先 jobs.min.json）→ 筛选渲染 → 公司详情 → 投递管理 → Offer 对比 → 认证 → 云同步
- **模块拆分**: `js/cloud-sync.js`（云同步）已拆出，**必须在主脚本之后加载**

### 用户认证系统
- Supabase Auth（CDN 异步加载），`currentUser` 全局，`onAuthStateChange` 监听
- `sb` 变量在**主脚本开头声明**（不要移回原位，避免 initAnalytics TDZ 错误）

### 数据同步机制
- 未登录: `campus_recruit_progress/offers`
- 登录后: `cr_progress_{userId}/cr_offers_{userId}`
- 自动同步: saveProgress/saveOffers 被 cloud-sync.js patch，保存后 2s 防抖同步

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
- 新增数据文件到 data/ 时，记得在 `.gitignore` 加白名单（`!data/文件名`）
- 完整文档见 `docs/`（architecture/api/configuration/KNOWN_ISSUES）
