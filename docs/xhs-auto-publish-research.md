# 小红书自动发布 · 开源方案调研

> 调研时间：2026-08-22
> 目的：为「校招更新」小红书日更文案/封面做自动发布程序，先盘点 GitHub 上的成熟项目与底层能力，评估可行性。

## 一、核心结论（先说风险）

1. **小红书没有公开官方 API**。所有自动化发布都基于「逆向 Web 接口」或「浏览器模拟点击」，属于平台条款禁止的灰色地带。
2. **账号封禁风险高**。平台风控（设备指纹 + 行为分析 + 风控模型）对自动化识别率持续提升，批量/高频发布极易被封，且可能牵连同设备账号。
3. **Cookie = 明文密码**。登录态靠 Cookie 维持，泄露即他人可操控账号；务必不入库、不提交、不跨设备共享。
4. **法律层面**：大规模抓取/商业化运营可能触及《刑法》285 条（非法获取计算机信息系统数据）、PIPL 个人信息保护法。个人低频学习测试风险低，商业化代运营风险显著上升。
5. **建议姿态**：个人账号、低频（≤1 篇/天）、原创内容、人工润色后置后再发；用测试心态，接受可能封号。

## 二、底层能力（决定可靠性）

| 项目 | 类型 | 说明 |
|---|---|---|
| **ReaJason/xhs** (~2k★) | Python SDK | 封装小红书 Web API，支持登录/发帖/搜索。需自行实现 `sign` 签名函数（通常用本地 Playwright 起签名服务 `POST /xhs/sign`）。最成熟的基础库。 |
| **xiaohongshu-cookie** | 加密参数还原 | 解决 x-s / x-t 等头部加密，JSVMP 算法还原 + 补环境。维护成本高、易失效。 |
| **muhenan/xiaohongshu-mcp-python** | MCP 服务 | 用 Playwright 封装 login / check_status / publish 三个 MCP 工具，可被 Cursor/Claude Code 等直接调用。发布参数：title(≤40字)、content、image_paths、headless。 |

**发布接口的硬约束**：
- 标题 ≤ 40 字符；
- 图片需本地存在，支持 JPG/PNG/GIF/WebP；
- 部分接口需要 `xsec_token`（从列表接口获取）；
- Cookie 会过期，需重新扫码登录。

## 三、上层成品项目（可借鉴架构）

| 项目 | 技术栈 | 特征 | 可借鉴点 |
|---|---|---|---|
| **doing-cr7/xhs_ai_publisher** | Python + Selenium RPA | 大模型生成内容 + 模拟点击发布图文/视频，GUI + 定时任务 | RPA 发布流程、定时发布骨架 |
| **muhenan/xiaohongshu-mcp-python** | Python + Playwright + MCP | login/check_status/publish 三工具，CLI + MCP 双模式 | 把发布抽象成可调用服务 |
| **chengyixu/xhs-auto-publisher** | Python + schedule | AI 生成 + 定时 daemon（默认 17:00 采集、18:00 发布），--manual/--daemon/单跑 | 调度模式设计 |
| **cv-cat/XHS_ALL_IN_ONE** | 全链路 | 采集→AI 改写→发布→自动运营；2 小时健康巡检 | 全流程编排、健康检查 |
| **Auto-Redbook-Skills** | Python/Node + Playwright | Markdown→小红书图文（8 主题/4 分页），cookie 发布，`--post-time` 定时，`--dry-run` 测试 | 图文渲染 + 定时 +  dry-run 思路 |
| **tool-pressure/xiaohongshu** | FastAPI + MCP | Web 应用，Jina/Tavily 检索 + XHS MCP 发布 | 前后端分离架构 |

## 四、对我们「校招更新」项目的适配思路

当前已有：`generate.js`（生成 5 风格文案到 txt）+ 封面 PNG（1080×1440，3:4 已合规）。

**最小可行自动发布链路**：
1. **内容源**：直接复用 `2026-08-21/校招更新_<style>.txt` 文案 + `covers/2026-08-21.png` 封面。
2. **发布层**（二选一）：
   - 轻量：基于 `ReaJason/xhs` + 本地 Playwright 签名服务，写一个小脚本读 txt/封面 → 调 publish；
   - 规范：用 `xiaohongshu-mcp-python` 起 MCP 服务，WorkBuddy/Claude 直接调 publish 工具。
3. **调度**：用系统级 cron / 任务计划程序（或 Python `schedule`）每天固定时段触发生成 + 发布。
4. **安全**：Cookie 存本地文件、`.gitignore` 屏蔽、不入库；发布前加 `--dry-run` 或人工确认开关。
5. **风控**：固定低频（1 篇/天）、随机延迟、避免违禁词（已在 generate.js 的 sanitizeText 处理）、保留人工润色后置环节。

## 五、方案迁移：从 mcp-python 改用 opencli（2026-08-22 更新）

### 为什么弃用 xiaohongshu-mcp-python
实测结论：该项目**已过时、选择器写死**，小红书前端一改版即失效。具体踩坑：
- `_click_upload_tab` 用 `div.creator-tab:nth-child(2)` 点错成了「上传视频」而非「上传图文」；
- `_upload_images` 写死等 `.upload-input`，找不到就超时；
- 自己维护 Cookie（`~/.xiaohongshu_mcp/cookies.json`），登录态易过期。

### 改用 opencli（jackwener/OpenCLI，v1.8.4 已装于本机）
opencli 是活跃维护的社区 CLI，覆盖 15+ 平台。**其 xiaohongshu 发布走 creator-center UI 自动化 + Browser Bridge 扩展复用 Chrome 登录态**，规避了"自己管 Cookie + 写死 DOM"两个坑，更可持续。

**接口**：`opencli xiaohongshu publish <content> --title <t> --images <i> --topics <t> [--draft]`
- 标题硬限 **20 字**（比 mcp-python 的 40 更严，脚本已自动截断）；
- 话题用 `--topics` **不含 # 号**，opencli 自动加 #；
- `--draft true` 存草稿（不公开），适合验证链路。

### 适配脚本
`C:/Users/Administrator/Desktop/小红书/xhs-publish/publish_xhs.py`（已重写为对接 opencli）：
- 解析 `校招更新_<style>.txt` → 标题/正文/话题；
- 用 Python `subprocess`（shell=False）调 opencli，正文多行安全传参；
- **关键修复**：在 Windows 上 opencli 的 `.cmd` 包装会吃掉 `--title` 引号导致参数错乱，已改为**直接用 managed node 跑 `dist/src/main.js`** 绕过；
- 默认 dry-run 预览；`--draft` 存草稿；`--publish` 真发。

### ⚠️ 当前阻塞点（必须由用户操作）
opencli 发布依赖 **OpenCLI Browser Bridge 扩展**在 Chrome 中安装并启用，否则报 `exit 69 Browser Bridge 未连接`（当前 `opencli profile list` 为空）。
- **方式 A（推荐）**：Chrome Web Store 装 `OpenCLI` 扩展（id `ildkmabpimmkaediidaifkhjpohdnifk`）；
- **方式 B**：GitHub Releases 下载 `opencli-extension-v{ver}.zip` → `chrome://extensions` 开发者模式加载已解压目录。
- 装好后保持 Chrome 登录 xiaohongshu.com，再 `opencli profile list` 应能看到 profile。

### 下一步
- [x] 调研成熟项目 + 风险分析
- [x] 跑通 login/status（mcp-python 路线，已登录态可用但方案弃用）
- [x] 写适配脚本（dry-run + opencli draft 验证，参数传递已修通至"扩展未连接"阶段）
- [ ] **用户装 Browser Bridge 扩展 → `opencli profile list` 出现 profile**
- [ ] 重新跑 `--draft` 验证草稿存成功 → 再 `--publish` 真发测试
- [ ] 接系统定时任务（每日触发 generate + publish）
- [ ] 评估「生成→渲染长图→发布」一体化

## 六、附：opencli 失败码速查
`0`成功 / `66`无数据 / `69` Browser Bridge 未连接 / `75`超时 / `77`需认证 / `78`配置错误。
