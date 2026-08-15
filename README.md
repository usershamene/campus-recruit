# 校招信息汇总

一站式校园招聘信息平台，聚合多家企业校招信息，助你高效求职。

## 功能

- 🔍 **岗位浏览** — 1900+ 条校招/实习岗位，支持搜索、筛选（公司/类型/城市）
- 🏢 **企业详情** — 企业简介（AI 生成）、标签、母公司品牌匹配（简介懒加载）
- 📋 **投递进度** — 记录投递、笔试、面试、Offer 各阶段状态
- ⚖️ **Offer 对比** — 多维度对比薪资、福利、发展前景
- ☁️ **云端同步** — 登录后数据多设备同步，安全不丢失
- 📱 **移动适配** — 手机端卡片视图、底部 Tab、筛选抽屉

## 数据来源

| 来源 | 状态 | 说明 |
|------|------|------|
| 求职方舟 | ✅ 正常 | API 按天查询，增量抓取 |
| offerstar | ✅ 正常 | HTML 抓取，每次全量 |
| deepoffer | ✅ 正常 | HTTPS API，增量抓取 |

## 技术栈

- **前端**: 单文件 HTML/CSS/JS（无框架依赖，含 `js/profiles.js`、`js/cloud-sync.js` 两个拆分模块）
- **后端**: Node.js http-server（本地开发，仅监听 127.0.0.1）
- **数据存储**: JSON 文件 + localStorage + Supabase
- **认证**: Supabase Auth（邮箱密码 + GitHub OAuth）
- **部署**: GitHub Pages（push 到 main 自动部署）
- **测试**: Node 内置 `node:test`（49 用例，零依赖）

## 本地运行

```bash
# 克隆项目
git clone https://github.com/usershamene/campus-recruit.git
cd campus-recruit

# 安装依赖（仅 Playwright/小红书脚本需要，核心功能不需要）
npm install

# 启动本地服务器（仅本机可访问）
node server.js
# 或 npm start

# 访问
http://localhost:8080
```

## 数据更新

### 自动更新（推荐）
项目已配置 GitHub Actions 自动更新，每天 17:00（北京时间）自动：
- 抓取最新校招数据（写 jobs.json + jobs.min.json 压缩版）
- 全量扫描缺简介公司 → 生成企业简介（失败记录可重试）
- 提交并推送更新

### 手动更新
```bash
# 增量更新校招数据
node fetch-data.js

# 生成企业简介（需要 MIMO_API_KEY）
set MIMO_API_KEY=你的key && node generate-profiles.js

# 重试失败的简介
set MIMO_API_KEY=你的key && node scripts/retry-failed.js

# 数据质量检查
node check-data.js
```

## 测试与检查

```bash
npm test          # 49 个单测（node:test）
npm run check     # 全部脚本语法检查
```

## 项目结构

```
├── index.html              # 主页面（前端 UI + 业务逻辑）
├── js/                     # 前端拆分模块
│   ├── profiles.js         # 企业简介懒加载
│   └── cloud-sync.js       # Supabase 云同步
├── server.js               # 本地开发服务器（端口 8080）
├── fetch-data.js           # 数据抓取（增量更新）
├── generate-profiles.js    # AI 企业简介生成（Agnes AI）
├── lib/                    # 可复用核心逻辑（纯函数，可单测）
│   ├── data-processing.js  # 去重/国企判定/类型推断/岗位分隔/清洗
│   └── profile-api.js      # AI 调用 + JSON 解析 + 重试
├── scripts/                # 运营辅助（小红书发布等）
├── tests/                  # 单元测试（49 用例）
├── docs/                   # 技术文档（架构/接口/配置/已知问题）
├── .env                    # 环境变量（不提交）
├── .github/
│   └── workflows/
│       └── daily-update.yml # GitHub Actions 自动更新
└── data/
    ├── jobs.json           # 岗位数据（1900+条）
    ├── jobs.min.json       # 压缩版（省 40% 流量，前端优先加载）
    ├── company-profiles.json # 企业简介+标签（3900+家）
    ├── update-meta.json    # 更新时间元数据
    ├── pending-profiles.json   # 待生成简介列表
    └── profile-failures.json   # 生成失败记录（可重试）
```

## 文档

- [架构与模块说明](docs/architecture.md)
- [接口文档](docs/api.md)
- [配置说明](docs/configuration.md)
- [已知问题记录](docs/KNOWN_ISSUES.md)

## License

MIT
