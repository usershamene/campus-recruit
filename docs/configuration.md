# 配置说明

> 最后更新：2026-09-13（移除企业简介 AI 生成链路）

## 一、环境变量（.env，不提交 git）

| 变量 | 必需 | 说明 |
|------|------|------|
| `SUPABASE_URL` | 云同步必需（前端硬编码） | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` | 云同步必需（前端硬编码） | 公开 anon key |
| `SUPABASE_SERVICE_ROLE` | admin.html 必需 | **最高权限密钥**，仅存 .env，仅本机使用 |
| `PORT` | 可选 | 本地服务器端口，默认 8080 |
| `UPDATE_SECRET` | 建议 | 远程触发 `/api/update` 的 token（本机访问不需要） |
| `ALLOWED_ORIGINS` | 可选 | CORS 白名单，逗号分隔 |

> ⚠️ 安全提醒（P0 修复后）：
> 1. 服务器只监听 127.0.0.1，`SUPABASE_SERVICE_ROLE` 不会暴露给局域网
> 2. 如曾部署过旧版本（Host 头可伪造），**建议轮换 SUPABASE_SERVICE_ROLE**
> 3. 不要提交任何含密钥的文件（`.env`、含硬编码 Key 的脚本均已排除）

## 二、GitHub Actions Secrets

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
```

## 五、配套项目

小红书引流发布链路（文案生成/封面/发布）在独立项目 `../xhs-publish/`，
其运行依赖（Chrome + opencli 扩展、账号登录态等）见该项目 README。

## 六、数据更新频率

| 机制 | 频率 | 说明 |
|------|------|------|
| GitHub Actions `daily-update.yml` | 每天 05:00 UTC（约北京 17:00） | 抓取 → 简介 → commit → push |
| 小红书自动发布 | 每天（Windows 定时任务） | 截图 → 文案 → opencli 发布 |
| 手动 | 随时 | `node fetch-data.js` / `POST /api/update` |
