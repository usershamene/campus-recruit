# 架构与模块说明

> 最后更新：2026-09-13（移除企业简介 AI 生成链路）

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
              └──────────────┬────────────────────────┘
                             │ 有新增/过期变化
              ┌──────────────▼────────────────────────┐
              │  git commit & push → GitHub Pages     │
              │  index.html + js/* + data/*.json 部署  │
              └────────────────────────────────────────┘

              ┌──────────────────────────────────────┐
              │  前端 index.html（浏览器加载）         │
              │  jobs.min.json → 筛选/搜索/排序       │
              │  Supabase：登录/投递进度/Offer 云同步  │
              └──────────────────────────────────────┘
```

## 二、目录结构（修复后）

```
campus-recruit/
├── index.html              # 主页面（前端全部 UI + 业务逻辑）
├── server.js               # 本地开发服务器（仅监听 127.0.0.1）
├── fetch-data.js           # 数据抓取 + 合并 + 清洗（增量）
├── check-data.js           # 数据质量检查脚本
├── lib/                    # ★ 可复用核心逻辑（纯函数，可单测）
│   └── data-processing.js  #   去重/国企判定/类型推断/岗位分隔/清洗
├── js/                     # ★ 从 index.html 拆出的前端模块
│   └── cloud-sync.js       #   Supabase 云同步（投递/Offer）
├── scripts/                # 数据运维脚本
│   └── fix-soe-labels.js   # 历史「国企招聘」误标修复（小红书链路见 ../xhs-publish/）
├── data/                   # 数据（git 跟踪：jobs/jobs.min/update-meta）
│   ├── jobs.json           # 岗位主数据（含压缩版 jobs.min.json）
│   └── update-meta.json    # 上次更新时间
├── tests/                  # ★ 核心逻辑单测（node:test，零依赖）
│   └── data-processing.test.js
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

### 3.2 js/cloud-sync.js（前端，从 index.html 拆出）
- `mergeLocalToCloud()` / `syncFromCloud()` / `syncNow()`：投递进度 + Offer 双向同步
- `syncToCloud(table, records, mapper)`：防抖自动同步（2s）
- patch `saveProgress`/`saveOffers`：本地保存后自动触发云同步

### 3.3 server.js（本地开发）
- 仅监听 `127.0.0.1`（P0 安全修复）
- `/api/update`：手动触发数据更新（需本机 or UPDATE_SECRET）
- `/api/admin-key`：仅本机回环地址可访问（P0 安全修复，基于 remoteAddress）
- 静态服务 + 目录穿越防护 + 安全响应头

## 四、数据流（一次完整更新）

```
抓取(3源并行) → 合并去重 → 清洗(类型/过期/岗位名) → 排序重排 ID
→ 写 jobs.json + jobs.min.json → [Actions] commit & push
```

## 五、关键设计决策

| 决策 | 理由 |
|------|------|
| jobs.min.json 压缩版 | 体积省 40%（989KB→593KB），前端优先加载，失败回退 jobs.json |
| lib/ 抽取纯函数 | 核心数据逻辑可单测（41 用例） |
| index.html 拆 js/ | 先拆低耦合模块（cloud-sync），渐进式重构 |
| sb 提前声明 | 修复 initAnalytics 访问 sb 的 TDZ 运行时错误 |

## 六、外部依赖

| 依赖 | 用途 | 说明 |
|------|------|------|
| Supabase | 认证 + 云同步 + 访问统计 | anon key 前端公开；service_role 仅本地 admin.html |
| GitHub Pages | 部署 | push main 自动发布 |
| Playwright（仅本地验证） | 真机验证（坐标/交互） | 非运行时依赖 |
