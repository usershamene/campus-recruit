# CLAUDE.md

## 项目概述

校园招聘信息聚合网站，部署在 GitHub Pages。从多个数据源抓取校招岗位信息，提供筛选、搜索、企业详情、投递进度管理、Offer 对比等功能。

## 技术栈

- **前端**: 单文件 `index.html`（vanilla HTML/CSS/JS，无框架）
- **后端**: `server.js`（Node.js http-server，本地开发用）
- **数据存储**: JSON 文件 + localStorage
- **部署**: GitHub Pages（push 到 main 自动部署）
- **测试**: Playwright（headless browser）

## 目录结构

```
├── index.html              # 主页面（所有前端代码）
├── server.js               # 本地开发服务器（端口 8080）
├── fetch-data.js           # 数据抓取（增量更新）
├── process-data.js         # 数据清洗（已集成到 fetch-data.js）
├── generate-profiles.js    # AI 企业简介生成（SiliconFlow API）
├── fix-data.js             # 数据修复脚本
├── data/
│   ├── jobs.json           # 岗位数据（主数据源）
│   ├── company-profiles.json # 企业简介+标签（1971条）
│   ├── update-meta.json    # 更新时间元数据
│   └── missing-companies.json # 缺失简介企业列表
└── package.json
```

## 常用命令

```bash
node server.js              # 启动本地服务器 http://localhost:8080
node fetch-data.js          # 增量更新校招数据（抓取+合并+清洗+保存）
node save-profiles.js '{}'  # 写入企业简介（供 subagent 调用）
```

## 增量简介生成流程

每次 `fetch-data.js` 运行后：
1. 自动检测新公司 → 写入 `data/pending-profiles.json`（gitignore）
2. Claude subagent 读取 pending 列表，用 web search + AI 生成简介
3. 调用 `node save-profiles.js '{...}'` 写入结果并清理 pending
4. 提交推送 `company-profiles.json`

## 数据源

| 来源 | 状态 | 说明 |
|------|------|------|
| 求职方舟 | 正常 | API 按天查询，增量抓取 |
| offerstar | 正常 | HTML 抓取，每次全量 |
| deepoffer | 证书过期 | HTTPS 证书问题，暂不可用 |

## 关键架构

### index.html 结构
- **CSS**: 暖色调主题，CSS 变量控制
- **HTML**: header + tab 切换（校招信息/投递进度/Offer 对比）+ modal
- **JS**: 数据加载 → 筛选渲染 → 公司详情卡片 → 投递管理 → Offer 对比

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
- `campus_recruit_offers` — Offer 对比数据
- `campus_recruit_progress` — 投递进度记录

## 编码规范

- 所有前端代码在 `index.html` 单文件内
- CSS 使用变量（`var(--accent)` 等），保持暖色调风格
- JS 使用 vanilla，无框架依赖
- 用户输入用 `esc()` 函数转义防 XSS
- 数据持久化用 localStorage（前端）/ JSON 文件（后端）

## 注意事项

- `index.html` 超过 1700 行，编辑时注意行号偏移
- GitHub Pages 部署有 1-2 分钟延迟
- `let` 变量有 temporal dead zone，不要在声明前调用
- deepoffer 证书过期，fetch-data.js 已加错误处理直接跳过
