# UX 交互问题修复交付说明

> 对应审查文档：`docs/UX-交互审查报告.md`（14 项问题）
> 修复日期：2026-09-12
> 决策确认：P0-1 采用**路线 A**（未登录允许本地存储，与 `saveOffers()` 对齐）

## 修复总览

| 级别 | 应修 | 已修 | 说明 |
|------|------|------|------|
| P0 | 2 | 2 | 含 1 项审查后新发现的重复同步问题（一并修复） |
| P1 | 4 | 4 | — |
| P2 | 5 | 5 | — |
| P3 | 3 | 3 | 进度阶段色板保留（功能语义色，见"遗留事项"） |
| **合计** | **14** | **14** | — |

改动文件：`index.html`、`js/cloud-sync.js`（约 +330/-90 行）。

---

## P0 级修复

### ✅ P0-1 未登录投递记录不落盘（路线 A）

**修复**：删除 `saveProgress()` 中的 `if (!currentUser) return;`，与 `saveOffers()` 行为对齐。

**兼容性验证**：`js/cloud-sync.js` 中 `syncToCloud` / `deleteFromCloud` 均有 `if (!currentUser) return;` 保护（行 91/100），未登录时本地写入正常、云端同步安全跳过，无副作用。`saveProgress` 的 monkey-patch（debounce 云同步）中 `if (currentUser)` 守卫同样兼容。

**验证**：DOM stub 推演 —— 未登录写入 `campus_recruit_progress` ✓；登录后写入 `cr_progress_<uid>` ✓。

### ✅ P0-2 登录/注册缺少异常捕获与提交态

**修复**（`loginWithEmail` / `doRegister` / `loginWithGitHub` 三处）：

1. 外层 `try/catch`：网络异常统一提示"网络异常，请稍后重试"，不再静默冒泡
2. 新增 `_authBusy(btnId, busy, busyText, idleText)`：提交期间按钮 `disabled` + 透明度 0.6 + 文案切换（"登录中…"/"注册中…"），`finally` 中恢复——杜绝重复提交
3. 分离提示：登录/注册成功提示与同步结果解耦（同步结果由 `onAuthStateChange` 单点提示）

**审查后新发现并一并修复：登录同步双路径**

原实现中 `loginWithEmail` 与 `sb.auth.onAuthStateChange(SIGNED_IN)` **各执行一遍**"合并本地→上云→拉取"——同一登录动作产生两轮重复网络请求，且会弹两条相同提示。本次修复确立**单一职责**：页面内登录流程只负责认证与 UI 更新，云端合并/同步/结果提示统一由 `onAuthStateChange` 处理；`syncAndRender` 补充返回布尔值供结果判断。

**验证**：结构检查 6 项全过（辅助函数/防重接入/try-catch/重复同步消除）。

---

## P1 级修复

### ✅ P1-1 Toast 单例互相覆盖

改为**按序播放队列**（上限 3 条）：显示中收到新提示则入队，当前提示结束后 180ms 逐条播放；`clearTimeout` 句柄防提前消失。

**验证**：DOM stub 推演 4 项 —— 立即显示 ✓ / 入队 ✓ / 文本不被覆盖 ✓ / 队列上限 ✓。

### ✅ P1-2 云端删除失败静默

`deleteFromCloud` 的 `catch` 追加用户提示："云端删除失败，该记录可能在下次同步后重新出现"——如实告知数据可能不一致，不做虚假承诺（不引入重试队列，属新功能范围，见遗留事项）。

### ✅ P1-3 同步错误信息笼统

新增 `_syncErrorMsg(e)` 按错误特征分流：

| 错误特征 | 提示 |
|----------|------|
| `JWT / token / expired / 401 / session` | 登录已过期，请重新登录 |
| `403 / permission / policy / row-level` | 无权限同步该数据 |
| `fetch / network / timeout / offline` | 网络异常，请检查连接 |
| 其余 | 数据同步失败，请稍后重试 |

`mergeLocalToCloud` / `syncFromCloud` / `syncToCloud` / `syncNow` 四处 catch 统一接入；`syncNow` 仅在两条链路均成功时提示"同步完成"。

### ✅ P1-4 行内编辑缺少反馈

`updateNote` 保存成功后短提示"备注已保存"（1.2s）；**值未变化时跳过**（不落盘、不提示，避免失焦即弹的噪音）。

---

## P2 级修复

### ✅ P2-1 零键盘支持

新增全局 `keydown` 监听，优先级从高到低：

- **ESC**：自定义下拉 → 表头筛选菜单 → 确认对话框（=取消）→ 移动端筛选抽屉 → 弹窗栈（后开先关，覆盖 8 个弹窗）
- **Enter**：焦点在 INPUT 时按当前弹窗分发——登录弹窗→`loginWithEmail`、注册→`doRegister`、投递记录弹窗→`confirmModal`、Offer 弹窗→`confirmOffer`（TEXTAREA 与 Shift+Enter 除外）

**验证**：结构检查 3 项（监听注册 / 弹窗栈 / Enter 分发）。

### ✅ P2-2 加载失败无重试入口

新增 `retryLoadData()`（恢复 loading UI 后重新拉取）；超时与失败两分支的错误文案改渲染 `.retry-btn` 重试按钮；硬编码 `#e74c3c` 改为 `var(--danger)`。

### ✅ P2-3 导入语义不清、跳过数不可见

`importProgress` / `importOffers` 统一改为显式报告：

- 提示语明确"**合并**导入"语义：`已合并导入 X 条，跳过 Y 条重复（现有 Z 条）`
- `importOffers` 补充对缺公司名无效项的跳过计数（原实现静默丢弃）
- 解析失败提示具体化（"请确认是本应用导出的 JSON"）+ `console.error` 保留详情

### ✅ P2-4 破坏性操作无撤销

新增轻量撤销机制（约 50 行，无依赖）：

- `showUndoBar(msg, restore)`：底部深色撤销条，内存保留恢复回调，**10 秒**后自动消失
- 接入全部 4 个删除入口：单条/批量删除投递记录、单条/批量删除 Offer
- 撤销时恢复快照 → 重新落盘 → 重渲染 → `syncProgressToCloud`/`syncOffersToCloud` 重新上云（对冲已执行的 `deleteFromCloud`）
- 深拷贝快照（`JSON.parse(JSON.stringify())`）防止引用共享导致的恢复污染

**验证**：DOM stub 推演 4 项 —— 显示 ✓ / 回调注册 ✓ / 数据恢复 ✓ / 隐藏清引用 ✓。

### ✅ P2-5 记录投递去重无明细

`_doRecordSelected` 提示三分支：`新增 X 条，跳过 Y 条（已存在）` / `已记录 X 条投递` / `跳过的 N 条均已存在`。

**去重键保持 `company+position` 不变的权衡说明**：审查报告曾建议与导入键（`+applyDate`）对齐，但投递记录的业务语义是"同岗位只记一次"（记录时 `applyDate` 取当天，若对齐导入键会导致不同天重复记录同一岗位），故**维持现状**，仅补提示。

---

## P3 级修复

| 项 | 修复 | 验证 |
|----|------|------|
| P3-1 空状态无操作入口 | 进度页空状态改为标题 + 两个按钮（「去挑选岗位」「手动添加」），新增 `.empty-actions` | 结构检查 ✓ |
| P3-2 筛选无醒目重置入口 | `renderActiveFilters` 在有任一标签时追加「清空全部」按钮（`clear-all-btn`，hover 危险色提示） | 结构检查 ✓ |
| P3-3 硬编码色值 | 7 处替换（`#dc2626`→`var(--danger)`、`#fef2f2`→`var(--danger-bg)`、`#ccc`→`var(--border)`，含 JS 模板内联色） | `#dc2626` 仅剩 `:root` 定义行 ✓ |

---

## 测试结果汇总

| 验证项 | 结果 |
|--------|------|
| `index.html` 内联 JS 语法（new Function 编译） | ✅ 通过 |
| `js/cloud-sync.js` 语法（node --check） | ✅ 通过 |
| 单元测试（node:test，49 用例） | ✅ 49/49 |
| DOM stub 逻辑推演（P0-1 落盘 / P1-1 队列 / P2-4 撤销） | ✅ 10/10 |
| 结构检查（认证/键盘/导入/空状态/色值等 16 项） | ✅ 16/16 |
| 服务连通（`/`、`/js/*`、`/data/jobs.min.json`） | ✅ 全部 200 |

## 改动统计

```
index.html      约 +290/-70（认证防重/Toast队列/键盘/撤销/重试/空状态/色值）
js/cloud-sync.js 约 +40/-15（错误分流/删除提示/同步结果返回值）
```

## 遗留事项

1. **进度阶段色板**（`STAGE_COLORS` 11 组 rgba）保留硬编码——属功能语义色（11 个阶段需可区分），统一到 token 会牺牲区分度；如需主题化可后续抽取为 `--stage-*` 变量族。
2. **云端删除失败的重试队列**未实现（本次仅显性提示）。如需彻底解决"删除后被同步拉回"，需引入本地 pending-delete 队列，建议单独评估。
3. **`showLoginReminder` 弹窗不支持 ESC**（无 id 的动态弹窗，ESC 处理会误触发"我已知晓"的继续执行语义）——刻意保留，需用户显式二选一。
4. 审查报告中的 K1（Supabase RLS 复核）为服务端配置事项，不在本次前端修复范围。
