# 配置说明

> 最后更新：2026-08-15

## 一、环境变量（.env，不提交 git）

| 变量 | 必需 | 说明 |
|------|------|------|
| `MIMO_API_KEY` | 简介生成必需 | Agnes AI API 密钥（`apihub.agnes-ai.com`） |
| `SUPABASE_URL` | 云同步必需（前端硬编码） | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` | 云同步必需（前端硬编码） | 公开 anon key |
| `SUPABASE_SERVICE_ROLE` | admin.html 必需 | **最高权限密钥**，仅存 .env，仅本机使用 |
| `PORT` | 可选 | 本地服务器端口，默认 8080 |
| `UPDATE_SECRET` | 建议 | 远程触发 `/api/update` 的 token（本机访问不需要） |
| `ALLOWED_ORIGINS` | 可选 | CORS 白名单，逗号分隔 |

> ⚠️ 安全提醒（P0 修复后）：
> 1. 服务器只监听 127.0.0.1，`SUPABASE_SERVICE_ROLE` 不会暴露给局域网
> 2. 如曾部署过旧版本（Host 头可伪造），**建议轮换 SUPABASE_SERVICE_ROLE**
> 3. `scripts/generate-profiles-api.py`（历史一次性脚本）内曾含硬编码 API Key，已被 .gitignore 排除，**不要提交任何含密钥的文件**

## 二、GitHub Actions Secrets

| Secret | 说明 |
|--------|------|
| `MIMO_API_KEY` | 简介生成（Actions 内 `generate-profiles.js` 用） |

`GITHUB_TOKEN` 自动注入，无需配置。

## 三、GitHub Pages

- 部署源：main 分支根目录
- 自定义域名：无（使用 `usershamene.github.io/campus-recruit/`）
- 缓存策略：`_headers` 中对 `/data/*.json` 设 `no-cache`，保证数据实时更新

## 四、本地开发

```bash
# 1. 安装依赖（仅 Playwright/脚本需要）
npm install

# 2. 语法检查
npm run check

# 3. 单测
npm test

# 4. 启动本地服务器（仅 127.0.0.1）
node server.js
# 或 npm start

# 5. 数据更新（需网络）
node fetch-data.js

# 6. 简介生成（需 MIMO_API_KEY）
set MIMO_API_KEY=你的key && node generate-profiles.js

# 7. 重试失败的简介
set MIMO_API_KEY=你的key && node scripts/retry-failed.js
```

## 五、定时任务（Windows 本机，小红书自动发布）

```bash
# 安装任务（管理员权限）
scripts/install-xhs-task.bat

# 查看
schtasks /query /tn "Campus Recruit\XHS Auto Publish"

# 手动触发
schtasks /run /tn "Campus Recruit\XHS Auto Publish"
```

小红书发布依赖：
- Chrome + opencli 扩展（已登录小红书账号）
- 外部文案脚本：`C:\Users\Administrator\Desktop\小红书\today_recruit\文案\生成今日文案.bat`
- 发布日志：`data/xhs-content/publish-log.json`（当日已发布则跳过）

## 六、数据更新频率

| 机制 | 频率 | 说明 |
|------|------|------|
| GitHub Actions `daily-update.yml` | 每天 05:00 UTC（约北京 17:00） | 抓取 → 简介 → commit → push |
| 小红书自动发布 | 每天（Windows 定时任务） | 截图 → 文案 → opencli 发布 |
| 手动 | 随时 | `node fetch-data.js` / `POST /api/update` |
