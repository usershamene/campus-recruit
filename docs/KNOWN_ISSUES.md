# 已知问题记录（KNOWN ISSUES）

> 维护约定：新发现问题按优先级（P0 紧急 / P1 重要 / P2 一般 / P3 低）追加，修复后标记 ✅。

## 已修复（2026-08-15 修复批次）

### ✅ F1【P0】server.js Host 头伪造 → service_role 泄露
- **现象**：`/api/admin-key` 与 `/api/update` 用 `req.headers.host.includes('localhost')` 判断本机，Host 头可伪造；且服务器监听所有网卡 → 局域网设备可获取 SUPABASE_SERVICE_ROLE。
- **修复**：`isLocalRequest()` 基于 `req.socket.remoteAddress` 回环判定 + `server.listen(PORT, '127.0.0.1')` 双保险。
- **验证**：伪造 Host 头本机仍放行（本机本就允许）；目录穿越 403；编码穿越 404。

### ✅ F2【P0】简介生成失败且永不重试
- **现象**：近 3 天失败率 12/36、9/44、7/30；`fetch-data.js` 只把"本次新增"公司写入 pending，失败公司下次不再进入 → 永久缺简介。
- **修复**：pending 改为**全量扫描**所有无简介公司；失败写入 `data/profile-failures.json`；`retry-failed.js` 可批量重试。

### ✅ F3【P0】generate-profiles.js 仅 1 种 JSON 解析策略
- **现象**：`raw.match(/\{[\s\S]*\}/)` 贪婪匹配脆弱，Agnes AI 返回 Markdown 代码块/前后缀文本时解析失败。
- **修复**：抽公共模块 `lib/profile-api.js`，`extractJson` 三策略（非贪婪→末尾截取→代码块），三份脚本统一引用。

### ✅ F4【P1】零测试
- **现象**：`"test": "echo No tests yet"`。
- **修复**：`tests/` 目录 49 个用例（node:test 零依赖），覆盖 deduplicate/isSOE/inferType/splitPositions/processData/extractJson。

### ✅ F5【P1】scripts/ 未入库
- **现象**：小红书发布链路整个 `?? scripts/` 未提交。
- **修复**：脚本入库；含硬编码密钥的一次性脚本 `generate-profiles-api.py`、中间产物加入 .gitignore。

### ✅ F6【P1】三份生成脚本代码重复
- **修复**：统一走 `lib/profile-api.js`，prompt/调用/解析/重试单点维护。

### ✅ F7【P2】前端首屏 3.3MB JSON
- **修复**：`jobs.min.json` 压缩版（省 40%）优先加载 + company-profiles 懒加载。

### ✅ F8【P2】index.html 3955 行单文件
- **修复**：拆出 `js/profiles.js`（简介懒加载）+ `js/cloud-sync.js`（云同步），渐进式重构。

### ✅ F9【P2】initAnalytics 访问 sb 的 TDZ 运行时错误
- **现象**：`initAnalytics` IIFE 在 `let sb = null` 声明前同步调用 `track('pageview')` → `Cannot access 'sb' before initialization`，**访问统计的 pageview 从未成功上报**（原版遗留 bug）。
- **修复**：`let sb = null` 提升到主脚本开头声明。

### ✅ F10【P2】.gitignore 数据文件白名单不全
- **修复**：`pending-profiles.json`、`profile-failures.json`、`jobs.min.json` 加入白名单。

## 待处理

### ⬜ K1【P2】Supabase RLS 策略未复核
- `progress_records`/`offers` 表依赖 RLS 保护，代码无法验证策略配置。需在 Supabase 控制台确认 `auth.uid() = user_id`。
- `analytics` 表"任何人可 INSERT"存在刷量风险，建议加限流或校验。

### ⬜ K2【P2】processData 类型推断顺序复杂
- 步骤 5/6 的 inferType 覆盖逻辑（如 `26届春招` + 8月发布时间 → 被时间过滤改为秋招）行为与旧版一致但语义难读，后续可重写为单一决策链。**注意：改动前必须有测试锁定现有行为（已补充）**。

### ⬜ K3【P3】前端剩余耦合
- index.html 仍有约 3800 行，全局变量 20+（allJobs/filteredJobs/progressRecords/offers 等）。后续可继续拆 `data.js`/`ui.js`，或引入轻量状态容器。

### ⬜ K4【P3】小红书脚本硬编码元素 ID
- `xhs-auto-publish.js` 中 opencli 元素 id（84/90/109/152/144/349/16）为硬编码，小红书改版即失效，建议改语义化选择器。

### ⬜ K5【P3】offerstar HTML 正则脆弱
- `\{\\?"_id\\?"...` 正则依赖页面结构，数据源改版即坏。建议加 fixture 快照测试。

## 数据质量备忘（check-data.js 检测项）

| 问题 | 数量（2026-08-07 本地数据） | 说明 |
|------|------|------|
| 岗位名无顿号超长 | 82 条 | 如"上汽安吉物流：物流管理类数字技术类财务管理类"，'类' 不在分隔词表（防误分隔），为原版设计行为 |
| 过期岗位 | 123 条 | 每日 Actions 自动清理，本地数据落后属正常（pull 后更新） |
| 城市拼接异常 | 少量 | `splitPositions`/`normalizeCity` 已覆盖大部分场景 |
