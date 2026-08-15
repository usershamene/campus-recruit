# 架构与模块说明

> 最后更新：2026-08-15（P0-P2 修复后）

## 一、系统总览

```
                    ┌─────────────────────────────┐
                    │   GitHub Actions 每日 05:00 │
                    │   (UTC，约北京 17:00 运行)   │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────▼───────────────────┐
              │          fetch-data.js                │
              │  ① 三源抓取（并行）                    │
              │  ② 合并去重 deduplicate()             │
              │  ③ 清洗 processData()                 │
              │  ④ 写 jobs.json + jobs.min.json       │
              │  ⑤ 全量扫描缺简介公司 → pending        │
              └──────────────┬────────────────────────┘
                             │ 有新增/过期变化
              ┌──────────────▼────────────────────────┐
              │      generate-profiles.js             │
              │  pending → Agnes AI → company-profiles │
              │  失败记录 → profile-failures.json      │
              └──────────────┬────────────────────────┘
                             │
              ┌──────────────▼────────────────────────┐
              │  git commit & push → GitHub Pages     │
              │  index.html + js/* + data/*.json 部署  │
              └────────────────────────────────────────┘

              ┌──────────────────────────────────────┐
              │  前端 index.html（浏览器加载）         │
              │  jobs.min.json → 筛选/搜索/排序       │
              │  company-profiles.json（懒加载）      │
              │  Supabase：登录/投递进度/Offer 云同步  │
              └──────────────────────────────────────┘
```

## 二、目录结构（修复后）

```
campus-recruit/
├── index.html              # 主页面（前端全部 UI + 业务逻辑）
├── server.js               # 本地开发服务器（仅监听 127.0.0.1）
├── fetch-data.js           # 数据抓取 + 合并 + 清洗 + 全量扫描（增量）
├── generate-profiles.js    # 企业简介生成（串行，Actions 用）
├── save-profiles.js        # 简介合并工具（stdin → company-profiles.json）
├── check-data.js           # 数据质量检查脚本
├── lib/                    # ★ 新增：可复用核心逻辑（纯函数，可单测）
│   ├── data-processing.js  #   去重/国企判定/类型推断/岗位分隔/清洗
│   └── profile-api.js      #   Agnes AI 调用 + 3 策略 JSON 解析 + 重试
├── js/                     # ★ 新增：从 index.html 拆出的前端模块
│   ├── profiles.js         #   企业简介懒加载 + 公司匹配
│   └── cloud-sync.js       #   Supabase 云同步（投递/Offer）
├── scripts/                # 运营辅助脚本
│   ├── generate-group.js   # 简介批量生成（并行版，subagent 用）
│   ├── retry-failed.js     # 重试失败简介（读 profile-failures.json）
│   ├── xhs-auto-publish.js # 小红书自动发布（opencli）
│   ├── screenshot-today.js # 站点截图
│   ├── fetch-xhs-words.js  # 小红书违禁词探测
│   └── xhs-banned-words.md # 违禁词词库
├── data/                   # 数据（git 跟踪：jobs/jobs.min/update-meta/company-profiles/pending/failures）
│   ├── jobs.json           # 岗位主数据（含压缩版 jobs.min.json）
│   ├── company-profiles.json # 企业简介 + 标签
│   ├── update-meta.json    # 上次更新时间
│   ├── pending-profiles.json  # 待生成简介公司（全量扫描产出）
│   └── profile-failures.json  # 生成失败记录（可重试）
├── tests/                  # ★ 新增：核心逻辑单测（node:test，零依赖）
│   ├── data-processing.test.js
│   └── profile-api.test.js
└── .github/workflows/daily-update.yml  # 每日自动更新
```

## 三、模块职责

### 3.1 lib/data-processing.js（后端核心，纯函数）
| 函数 | 职责 | 说明 |
|------|------|------|
| `deduplicate(existing, newJobs)` | 岗位去重 | 按 `company\|positions`（忽略大小写/空白）去重；重复时补全缺失的 applyUrl/deadline/location |
| `isSOE(company, applyUrl, announceUrl)` | 国企判定 | 7 条规则 + 580 词排除表；数据源 companyType 优先 |
| `inferType(job)` | 招聘类型推断 | 秋招/提前批/实习/春招/补录/校招 |
| `splitPositions(text)` | 岗位名分隔 | 顿号分隔 + 后缀词智能断开 + 括号保护 |
| `processData(jobs)` | 清洗流水线 | 登录墙过滤 → 类型规范化 → 过期剔除 → 岗位名清洗 → 排序重排 ID |

### 3.2 lib/profile-api.js（简介生成公共层）
| 导出 | 职责 |
|------|------|
| `extractJson(text)` | 3 策略 JSON 提取：非贪婪 `{...}` → 末尾截取 → Markdown 代码块 |
| `callProfileApi(name, types, industries, opts)` | Agnes AI 调用 + 重试（默认 3 次/120s 超时），返回 `{name,summary,tags}` 或 null |

### 3.3 js/profiles.js（前端，从 index.html 拆出）
- `ensureCompanyProfiles()`：懒加载 2.3MB 简介数据（首次需要才 fetch，带缓存 promise）
- `getCompanyProfile(name)`：精确匹配 → 后缀清洗 → 母公司品牌匹配

### 3.4 js/cloud-sync.js（前端，从 index.html 拆出）
- `mergeLocalToCloud()` / `syncFromCloud()` / `syncNow()`：投递进度 + Offer 双向同步
- `syncToCloud(table, records, mapper)`：防抖自动同步（2s）
- patch `saveProgress`/`saveOffers`：本地保存后自动触发云同步

### 3.5 server.js（本地开发）
- 仅监听 `127.0.0.1`（P0 安全修复）
- `/api/update`：手动触发数据更新（需本机 or UPDATE_SECRET）
- `/api/admin-key`：仅本机回环地址可访问（P0 安全修复，基于 remoteAddress）
- 静态服务 + 目录穿越防护 + 安全响应头

## 四、数据流（一次完整更新）

```
抓取(3源并行) → 合并去重 → 清洗(类型/过期/岗位名) → 排序重排 ID
→ 写 jobs.json + jobs.min.json → 全量扫描缺简介公司
→ 写 pending-profiles.json → [Actions] generate-profiles.js
→ 写 company-profiles.json + profile-failures.json → commit & push
```

## 五、关键设计决策

| 决策 | 理由 |
|------|------|
| jobs.min.json 压缩版 | 体积省 40%（989KB→593KB），前端优先加载，失败回退 jobs.json |
| 简介懒加载 | 2.3MB 数据不再拖慢首屏，仅打开公司详情时拉取 |
| pending 全量扫描 | 修复"仅新增公司"导致失败永不重试的缺陷 |
| profile-failures.json | 失败可追溯、可批量重试（retry-failed.js） |
| lib/ 抽取纯函数 | 三份生成脚本共享 API 层；核心逻辑可单测（49 用例） |
| index.html 拆 js/ | 先拆低耦合模块（profiles/cloud-sync），渐进式重构 |
| sb 提前声明 | 修复 initAnalytics 访问 sb 的 TDZ 运行时错误 |

## 六、外部依赖

| 依赖 | 用途 | 说明 |
|------|------|------|
| Agnes AI（apihub.agnes-ai.com） | 企业简介生成 | `MIMO_API_KEY`，模型 agnes-2.0-flash |
| Supabase | 认证 + 云同步 + 访问统计 | anon key 前端公开；service_role 仅本地 admin.html |
| GitHub Pages | 部署 | push main 自动发布 |
| Playwright（仅 scripts） | 截图/小红书 | 非运行时依赖 |
