# 小红书「校招更新」发布流水线

自动化发布校招信息到小红书：**生成文案 → 生成封面 → 发布**，由统一编排脚本串起三段。

## 前置条件

1. **Chrome 浏览器**：需安装并启用 opencli 的 Browser Bridge 扩展（id `ildkmabpimmkaediidaifkhjpohdnifk`）。
2. **opencli**：本机已装 `@jackwener/opencli`（发布内核）。
3. **小红书账号**：Chrome 中已登录创作者中心（opencli 复用登录态，非 headless）。
4. **Node**：运行 `generate.js` / `xhs-cover.js`（封面用 Playwright 渲染，需 `campus-recruit` 本地 `node_modules` 含 playwright）。
5. **数据**：`campus-recruit/data/jobs.json` 每日更新（文案与封面均依赖它）。

## 文件结构

```
小红书/xhs-publish/
├── run_pipeline.py          # 统一编排：文案→封面→发布（入口）
├── publish_xhs.py           # 发布内核（opencli + 原创/合集增强 + --stay/--draft/--publish）
└── poc_enhance_note.py      # 原创+合集自动化的 POC 记录（参考）

campus-recruit/scripts/
├── xhs-cover.js             # 封面生成：Playwright 渲染设计模板 → 1080×1440 PNG
├── xhs-cover-template.html  # 封面模板
├── fetch-xhs-words.js       # 词云取词（纪念/补充用）
└── xhs-banned-words.md      # 违禁词清单

小红书/today_recruit/文案/
└── generate.js              # 文案生成（基于 jobs.json + 模板，5 种风格）
```

> 已清理的失效旧逻辑：`xhs-auto-publish.js`（写死元素序号、合集名写错）、`xhs-publish-task.xml` / `install-xhs-task.bat`（定时任务，路径错误且指向不存在的批处理）。定时任务后续如需接入，将以 `run_pipeline.py` 为内核重做。

## 三段职责

| 环节 | 脚本 | 输入 | 输出 |
|------|------|------|------|
| 文案 | `generate.js <date> <style>` | `jobs.json` | `文案/<date>/校招更新.txt` |
| 封面 | `xhs-cover.js <date>` | `jobs.json` + 模板 | `covers/<date>.png`（1080×1440） |
| 发布 | `publish_xhs.py` | 上述 txt + png | 小红书笔记（原创+合集） |

## 使用方法

### 一键编排（推荐）

```bash
cd "C:/Users/Administrator/Desktop/小红书/xhs-publish"

# 今天 + daily 风格 + 停在发布前最终页（默认，安全，人工点发布）
python run_pipeline.py

# 指定日期/风格，并真发
python run_pipeline.py --date 2026-08-22 --style daily --publish

# 存草稿（含原创+合集，不公开）
python run_pipeline.py --style review --draft

# 关闭原创+合集增强
python run_pipeline.py --no-enhance
```

发布模式：
- `--stay`（默认）：填完表 + 开原创 + 加合集后，**停在发布前最终页面**，人工确认后点发布。
- `--draft`：存草稿（含原创+合集）。
- `--publish`：真发（公开）。

### 分步手动

```bash
# 1. 文案
node "C:/Users/Administrator/Desktop/小红书/today_recruit/文案/generate.js" 2026-08-22 daily

# 2. 封面（在 campus-recruit 下，让 playwright 解析 node_modules）
node "C:/Users/Administrator/Desktop/myProject/campus-recruit/scripts/xhs-cover.js" 2026-08-22

# 3. 发布
python "C:/Users/Administrator/Desktop/小红书/xhs-publish/publish_xhs.py" --date 2026-08-22 --style daily --stay
```

## 发布增强说明（原创声明 + 合集）

`publish_xhs.py` 会对**本机** opencli 的 `clis/xiaohongshu/publish.js` 做幂等本地补丁，把"原创声明 + 加入合集（默认「每日校招更新」）"注入到点击发布/暂存按钮之前——因此增强在发布流程内、发布前完成，**不经过草稿箱二次编辑**。

- `--no-enhance`：关闭增强（设 `XHS_ENHANCE=0`）。
- `--collection <名>`：改合集名（默认「每日校招更新」，空串=不加）。
- `--restore-patch`：还原 publish.js 到原生 opencli 行为。

> ⚠️ 补丁打在本地 `node_modules` 的 opencli 文件上，`npm update -g @jackwener/opencli` 会覆盖它——`publish_xhs.py` 每次运行会自动检测并重新注入（会打印备份文件名）。

## 故障排除

- **文案未生成 / "没有新增岗位"**：当日 `jobs.json` 无新增岗位，编排会自动中止。
- **封面未生成**：检查 `campus-recruit` 下 playwright 是否安装（`npm ls playwright`）；封面脚本需联网渲染模板字体。
- **发布失败**：
  - Chrome 是否运行、opencli 扩展是否启用（否则报 `exit 69 Browser Bridge 未连接`）。
  - 小红书是否登录、页面是否改版。
  - 首次运行若 publish.js 被 npm 覆盖，重跑会自动重打补丁。
- **复用 tab 状态异常**：opencli adapter tab 不会被真正关闭。若二次运行挂话题失败，关闭 Chrome 中所有 `creator.xiaohongshu.com/publish/publish` 标签页后重试（脚本已加话题去重 + 页面刷新补丁缓解）。

## 注意事项

1. 发布依赖 Chrome 登录态（Browser Bridge 复用），无法完全 headless，需保持 Chrome 运行。
2. 当日无新增岗位时不发布，避免空内容。
3. 默认 `--stay` 是安全验收模式；确认无误后再用 `--publish` 真发或 `--draft` 存草稿。
