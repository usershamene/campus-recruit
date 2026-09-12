# campus-recruit 项目全面体检报告

> 体检时间：2026-08-15 20:30
> 体检对象：`C:\Users\Administrator\Desktop\myProject\campus-recruit`（远程 origin/main @ `5571665`）
> 方法：静态代码审查 + 数据质量分析 + GitHub Actions 运行日志回溯 + npm audit

---

## 📊 总体健康度评分：**72 / 100**（中等偏上，可运行但有隐患）

| 维度 | 得分 | 简评 |
|------|------|------|
| 代码质量 | 68 | 单文件过大、业务逻辑硬编码严重，但整体风格统一 |
| 安全性与依赖 | 78 | 依赖无漏洞、XSS 防护良好；**service_role 泄露通道 + Host 头伪造**是隐患 |
| 性能表现 | 70 | 3.3MB JSON 同步加载 + 全量索引构建，移动端首屏偏重 |
| 架构与可维护性 | 62 | 3955 行单文件、全局变量满天飞、scripts/ 未入库、逻辑重复 |
| 测试覆盖率 | 30 | **零测试**，全靠 Actions 冒烟 |
| 最佳实践与数据健康 | 75 | 自动化链路健康，但简介生成 25% 失败、pending 不落库、文档过时 |

---

## 一、代码质量（68/100）

| # | 严重度 | 位置 | 问题 | 改进建议 |
|---|--------|------|------|----------|
| 1.1 | 🔴 高 | `fetch-data.js` `isSOE()` | **硬编码规则堆叠**：6 条判定规则 + 40+ 行排除词表 + 300+ 城市名单 + 100+ 品牌名单，规则 6/7 逻辑重复（weakSignals 与 strongSignals 部分重叠），每年换届还要手动更新 TYPE_MAP 年份 | 提取为 `data/soe-rules.json` 配置化；规则重叠合并；删除逐年失效的年份映射，改为动态正则 `\d{2}届?春招` |
| 1.2 | 🟡 中 | `fetch-data.js` `processData()` | 步骤编号重复（两处 `// 5.`）、推断逻辑顺序混乱：先 `if (!rawType...)` 兜底，再 `if (rawType && TYPE_MAP[rawType])` 用 inferType 覆盖，语义难读，易误判（例如"校招兜底"会覆盖已规范化的类型） | 重写为单一决策链：数据源类型 → SOE 判定 → 时间修正 → inferType 兜底，每步只执行一次 |
| 1.3 | 🟡 中 | `generate-profiles.js` / `generate-group.js` / `retry-failed.js` | **三份脚本重复实现** API 调用、prompt、重试逻辑，prompt 文本完全复制粘贴；`generate-profiles.js` 仅用 `raw.match(/\{[\s\S]*\}/)` 一种解析策略，而 `generate-group.js` 有 3 种 → 解析失败率高的直接原因 | 抽公共模块 `lib/profile-api.js`（callApi + 3 策略解析 + retry），三份脚本改为引用；workflow 优先用 group 并行版本 |
| 1.4 | 🟡 中 | 全局 | **错误被静默吞掉**：`fetch-data.js` 中 `catch(e){/* skip */}`、`catch(e){ return []; }`；`index.html` 中 `catch {}` 数十处，生产问题无法追溯 | 错误至少 `console.warn` 带上 source 标识；写 `logs/fetch-error.log`；失败的 API 批次记入 `data/fetch-failures.json` |
| 1.5 | 🟢 低 | `check-data.js` | 硬编码相对路径 `./data/jobs.json`，依赖 CWD | 用 `path.join(__dirname, ...)` |
| 1.6 | 🟢 低 | `fetch-data.js` `inferType()` | `日常实习|日常实习` 重复无意义 | 清理 |

**亮点**：函数命名清晰、职责分离（fetch/dedup/process/main 分层明确）、变量命名无拼写错误、无硬编码密钥。

---

## 二、安全性与依赖（78/100）

| # | 严重度 | 位置 | 问题 | 改进建议 |
|---|--------|------|------|----------|
| 2.1 | 🔴 高 | `server.js` `/api/admin-key` | **service_role 密钥泄露通道**：`isLocal` 仅靠 `req.headers.host.includes('localhost')` 判断 —— Host 头完全由客户端控制，可伪造为 `localhost:8080` 直接获取 **SUPABASE_SERVICE_ROLE**（最高权限）。且 `server.listen(PORT)` 未绑 host，默认监听所有网卡，局域网内任何设备可达 | ① 改为 `req.socket.remoteAddress` 判断回环地址（`127.0.0.1`/`::1`）；② 监听绑定 `server.listen(PORT, '127.0.0.1')`；③ 或直接删除该接口，admin.html 改读本地文件 |
| 2.2 | 🟡 中 | `index.html` Supabase | **RLS 依赖无法验证**：anon key 硬编码前端（属正常），但 `progress_records`/`offers` 表全靠 RLS 保护，代码无法确认策略配置；CLAUDE.md 自述 analytics 表"任何人可 INSERT"——存在刷量污染 | 在 Supabase 控制台核对：`progress_records`/`offers` 的 RLS 必须 `auth.uid() = user_id`；analytics 表加限流或校验 |
| 2.3 | 🟡 中 | `server.js` `/api/update` | `UPDATE_SECRET` 为空时"允许本地访问"判定同样用 Host 头——服务若暴露在公网/局域网，可被远程触发更新 | 同上，统一用 `remoteAddress`；生产环境必须配置强 `UPDATE_SECRET` |
| 2.4 | 🟢 低 | `scripts/xhs-auto-publish.js` | `execSync` 拼 shell 命令，title/body 仅转义 `"` 和 `\n`，若文案含 `$()`、反引号等存在命令注入面（当前内容源为本地可信脚本，风险低） | 用 `execFileSync` 传参数数组；或对标题做白名单清洗 |
| 2.5 | 🟢 低 | `index.html` | onclick 属性中 `updateStage('${r.id}')` 等 id 未转义（id 为本地生成随机串，可控，风险低） | 统一经 `esc()` 后嵌入 |

**亮点**：npm audit **0 漏洞**（依赖极少，仅 playwright）；`.env` 未入库；`esc()` 全站覆盖、`rel="noopener"` 齐全、CSP 类响应头（nosniff/DENY/Referrer-Policy）已设置、静态服务做了目录穿越防护（`startsWith(ROOT)`）。

---

## 三、性能表现（70/100）

| # | 严重度 | 位置 | 问题 | 改进建议 |
|---|--------|------|------|----------|
| 3.1 | 🟡 中 | `index.html` `loadData()` | **首屏 3.3MB JSON 同步加载**：`jobs.json`（989KB）+ `company-profiles.json`（2.3MB）页面加载即并行 fetch，`allJobs.forEach` 全量构建城市/岗位/类型索引（每条多次正则），移动端首屏卡顿 1–2s | ① jobs.json 压缩后仅 641KB，改为**压缩存储**（提交 jobs.min.json，fetch 体积减 35%）；② profiles 改为**懒加载**（点开公司详情才 fetch，或分片 `profiles-0..9.json`） |
| 3.2 | 🟡 中 | `index.html` 加载超时 | `AbortController` 8s 中止 + 10s 提示，但 `company-profiles.json` 是独立 5s 超时且失败静默 —— 弱网下详情页无简介 | 统一超时策略；加载失败时展示重试按钮 |
| 3.3 | 🟢 低 | `fetch-data.js` 抓取 | deepoffer 单次可达 50 页 × 20 条（1000 条），`process.stdout.write` 回显频繁 | 分页做节流、支持断点续抓 |
| 3.4 | 🟢 低 | 静态资源 | `_headers` 只对 `/data/*.json` 设 no-store，`index.html` 本身无缓存策略（GitHub Pages 默认 10 分钟，可接受） | 可对 index.html 显式设 `Cache-Control: max-age=300` |

**亮点**：筛选渲染有 `slice(0,100)` 上限、分页正常、CSS 变量统一、无第三方渲染库拖累。

---

## 四、架构与可维护性（62/100）

| # | 严重度 | 位置 | 问题 | 改进建议 |
|---|--------|------|------|----------|
| 4.1 | 🔴 高 | `index.html` | **3955 行单文件 + 139 个函数**，UI/CSS/JS/状态/云同步全在一个文件，任何改动都有回归风险（CLAUDE.md 自嘲"编辑注意行号偏移"） | 拆为 `app.js`（数据+筛选）、`progress.js`、`offer.js`、`sync.js`、`ui.js` 多文件（GitHub Pages 原生支持 ES Modules）；至少先抽出 `data.js` 与 `sync.js` |
| 4.2 | 🟡 中 | `index.html` | **全局变量泛滥**：`allJobs`、`filteredJobs`、`progressRecords`、`offers`、`companyProfiles`、`selectedJobKeys` 等 20+ 个 `let` 全局互写，状态流不可追踪 | 引入轻量状态容器（一个 `store = {}` + 订阅），或按模块闭包隔离 |
| 4.3 | 🟡 中 | 仓库 | **`scripts/` 整个目录未入库**（`git status` 显示 `?? scripts/`），但 CLAUDE.md/README/package.json 均引用它 —— 新克隆的仓库没有小红书发布链路 | `git add scripts/` 提交（注意 `*.bat` 在 .gitignore，需确认或豁免 xhs 相关 .bat） |
| 4.4 | 🟡 中 | 三份生成脚本 | 职责重叠（见 1.3），且 `save-profiles.js` 从 stdin 传 JSON 有 shell 转义风险 | 合并脚本，统一输出格式 |
| 4.5 | 🟢 低 | 文档 | README/CLAUDE.md 数据过时：README 写"1400+条"、CLAUDE.md 写"1460+/3600+家"，实际 **1952 条 / 3974 家**；README 未提及小红书链路 | 同步更新 |

**亮点**：目录职责划分合理（data/scripts/.github 分离）、单一数据源 jobs.json、数据流 fetch→merge→clean→save 清晰。

---

## 五、测试覆盖率（30/100）

| # | 严重度 | 位置 | 问题 | 改进建议 |
|---|--------|------|------|----------|
| 5.1 | 🔴 高 | `package.json` | **`"test": "echo No tests yet && exit 0"` —— 零测试** | 引入 vitest（零配置，Node 原生兼容），为纯函数补单测 |
| 5.2 | 🔴 高 | `fetch-data.js` | **关键业务逻辑全部无测试**：`deduplicate`（去重/合并）、`isSOE`（国企判定）、`inferType`（类型推断）、`splitPositions`（岗位名分隔）、`processData`（清洗/过期过滤）——任何一个回归都会污染 2000 条数据 | 优先覆盖：`deduplicate`（重复 key、缺字段补全）、`isSOE`（国企/民企/外企样本各 10 个）、`inferType`（全年份/类型矩阵） |
| 5.3 | 🟡 中 | `fetch-data.js` offerstar | HTML 正则 `\{\\?"_id\\?"...` 脆弱，数据源改版即坏且无回归保护 | 加 fixture 快照测试（保存一段真实 HTML 样本） |
| 5.4 | 🟢 低 | 前端 | 无 E2E（CLAUDE.md 提到 Playwright 但未使用） | 可选：为"加载→筛选→详情"主链路补 1 个 smoke 测试 |

---

## 六、最佳实践与数据健康（75/100）

| # | 严重度 | 位置 | 问题 | 改进建议 |
|---|--------|------|------|----------|
| 6.1 | 🔴 高 | Actions + `generate-profiles.js` | **简介生成失败率高且无法重试**：近 3 天失败 12/36、9/44、7/30（**23–33% 失败**），全部为 JSON 解析错误；且 `fetch-data.js` 只把"本次新增且无简介"的公司写入 pending —— **生成失败的公司下次不再进入 pending（已不是新增）→ 永久缺简介** | ① 统一用 `generate-group.js` 的 3 策略解析；② pending 逻辑改为"**当前 jobs 中所有无简介公司**"而非"仅本次新增"；③ 失败记录写入 `data/profile-failures.json` 供重试 |
| 6.2 | 🟡 中 | `.gitignore` + `pending-profiles.json` | `pending-profiles.json` 被 `data/*` 通配排除且未白名单 → **不落库**，本地与 Actions 环境状态不同步，也无法审计 | `.gitignore` 增加 `!data/pending-profiles.json` 与 `!data/profile-failures.json` |
| 6.3 | 🟡 中 | 数据质量 | **本地数据落后远程 8 个 commit**（本地 1699 条 vs 远程 1952 条）；`check-data.js` 报 82 条问题（城市拼接、岗位无顿号超长，如上汽安吉物流）；123 条已过期 | `git pull` 同步；`splitPositions` 对 `类`/`类` 后缀做加强；过期清理依赖每日 Actions 已正常 |
| 6.4 | 🟢 低 | git 流程 | 仅 main 单分支，Actions 直接 push main，无保护 | 个人项目可接受；可选加 `workflow_dispatch` 手动触发（已有） |
| 6.5 | 🟢 低 | 小红书链路 | `xhs-auto-publish.js` 硬编码 opencli 元素 id（84/90/109/152/144/349/16），小红书改版即失效 | 元素定位改为语义化 CSS 选择器 + 失败重试 |

**亮点**：Actions 链路健康（近 15 次全部 success，数据每天更新）；`.env` 管理规范；`.gitignore` 较完整（secret/临时文件/截图均排除）。

---

## 🎯 优先级修复清单

### P0（立即，本周）— 安全与数据完整性
1. **修复 `server.js` Host 头伪造漏洞**（2.1/2.3）：`/api/admin-key` 与 `/api/update` 改用 `remoteAddress` 回环判定 + 监听绑定 127.0.0.1。**这是唯一的高危安全问题。**
2. **修复简介生成失败+无法重试**（6.1）：pending 改为全量无简介公司扫描；解析统一 3 策略；失败落库。

### P1（短期，2 周内）— 工程地基
3. **补核心逻辑单测**（5.2）：deduplicate / isSOE / inferType / splitPositions / processData，40+ 用例。
4. **`scripts/` 入库 + pending-profiles 白名单**（4.3/6.2），保证仓库自包含。
5. **抽出公共生成模块**（1.3），消灭三份重复脚本。

### P2（中期，1 个月）— 质量与性能
6. **jobs.json 压缩存储 + profiles 懒加载**（3.1），首屏减 70% 流量。
7. **拆分 index.html**（4.1）：先拆 data.js + sync.js 两个文件，验证后再继续。
8. **错误可见化**（1.4）：全局错误日志 + fetch 失败记录。

### P3（长期，随缘）
9. 前端状态容器化（4.2）；Supabase RLS 复核（2.2）；xhs 元素定位语义化（6.5）；文档同步（4.5）。

---

## 📌 体检结论

- **优点**：自动化链路（抓取→简介→部署）全自动运转且近 15 天零失败；依赖极简零漏洞；XSS 防护意识好；数据源管理清晰。
- **最大隐患**：① server.js 的 service_role 泄露通道（需立即修复）；② 简介生成 25% 失败 + 无重试机制导致数据缺口累积；③ 零测试 + 3955 行单文件，后续迭代风险高。
- **一句话**：**产品能跑、链路健康，但"安全 + 数据完整性 + 工程化"三个地基需要优先加固**，修完 P0/P1 评分可提升至 85+。
