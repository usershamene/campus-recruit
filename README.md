# 校招信息汇总

一站式校园招聘信息平台，聚合多家企业校招信息，助你高效求职。

## 功能

- 🔍 **岗位浏览** — 1500+ 条校招/实习岗位，支持搜索、筛选（公司/类型/城市）
- 🏢 **企业详情** — 企业简介、标签、母公司品牌匹配
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

- **前端**: 单文件 HTML/CSS/JS（无框架依赖）
- **后端**: Node.js http-server（本地开发）
- **数据存储**: JSON 文件 + localStorage + Supabase
- **认证**: Supabase Auth（邮箱密码 + GitHub OAuth）
- **部署**: GitHub Pages（push 到 main 自动部署）

## 本地运行

```bash
# 克隆项目
git clone https://github.com/usershamene/campus-recruit.git
cd campus-recruit

# 安装依赖（仅 Playwright 测试需要）
npm install

# 启动本地服务器
node server.js

# 访问
http://localhost:8080
```

## 数据更新

### 自动更新（推荐）
项目已配置 GitHub Actions 自动更新，每天 17:00（北京时间）自动：
- 抓取最新校招数据
- 生成新企业简介
- 提交并推送更新

### 手动更新
```bash
# 增量更新校招数据
node fetch-data.js

# 生成企业简介（需要 MIMO_API_KEY）
node generate-profiles.js
```

## 项目结构

```
├── index.html              # 主页面（所有前端代码）
├── server.js               # 本地开发服务器（端口 8080）
├── fetch-data.js           # 数据抓取（增量更新）
├── generate-profiles.js    # AI 企业简介生成（mimo API）
├── .env                    # 环境变量（不提交）
├── .github/
│   └── workflows/
│       └── daily-update.yml # GitHub Actions 自动更新
├── data/
│   ├── jobs.json           # 岗位数据（1400+条）
│   ├── company-profiles.json # 企业简介+标签（2800+条）
│   ├── update-meta.json    # 更新时间元数据
│   └── pending-profiles.json # 待生成简介列表
└── package.json
```

## License

MIT
