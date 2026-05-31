# 校招信息汇总 — 组件结构清单

## 一、全局 / Header 区域

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `header` | `.header` | 顶部导航栏 | 粘性定位，包含标题、统计、用户区 |
| `header-inner` | `.header-inner` | 导航栏内框 | 最大宽度 1360px 居中容器 |
| `header-top` | `.header-top` | 导航栏上行 | flex 布局：标题 + 统计 + 用户区 |
| `title-block` | `.title-block` | 标题区块 | 网站标题 + 更新时间 |
| — | `h1` | 网站标题 | "校招信息汇总"，"汇总"高亮 |
| `updateTime` | `.update-time` | 更新时间 | 显示数据最后更新时间 |
| `statTotal` | `.stat-num` | 岗位总数统计 | 显示总岗位数量 |
| `statToday` | `.stat-num` | 今日新增统计 | 显示今日新增数量，绿色 |
| `statCompany` | `.stat-num` | 企业总数统计 | 显示企业数量 |
| `statCity` | `.stat-num` | 城市总数统计 | 显示城市数量 |
| `userArea` | `.user-area` | 用户区域 | 登录按钮 / 用户头像菜单 |
| `loginBtn` | `.login-btn` | 登录按钮 | 点击打开登录弹窗 |
| `userMenu` | `.user-menu` | 用户菜单 | 已登录时显示用户下拉菜单 |
| `userAvatar` | `.user-avatar` | 用户头像 | 显示用户头像图片 |
| `userName` | `.user-name` | 用户昵称 | 显示用户名 |
| `quoteText` | `.quote-text` | 励志语句 | 随机显示励志短句 |
| `quoteAuthor` | `.quote-author` | 语句作者 | 显示语句出处 |

## 二、招聘岗位页面（Main Page）

### 2.1 搜索与筛选

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| — | `.controls` | 控制栏容器 | 包含搜索框、筛选按钮、清除按钮 |
| `searchInput` | `.search-box input` | 搜索框 | 按公司/岗位/城市模糊搜索 |
| — | `.search-box` | 搜索框容器 | 带放大镜图标的输入框 |
| `clearAllBtn` | `.clear-btn` | 清除筛选按钮 | 一键清除所有筛选条件 |
| `mobileFilterBtn` | `.mobile-filter-btn` | 移动端筛选按钮 | 打开筛选抽屉（移动端） |
| `activeFilters` | `.active-filters` | 已选筛选标签栏 | 桌面端显示已选筛选条件标签 |
| `mobileFilterBar` | `.mobile-filter-bar` | 移动端筛选标签栏 | 移动端 chip 样式筛选条件 |
| — | `.active-tag` | 筛选标签 | 单个筛选条件标签（如"公司: 华为"） |
| — | `.mobile-filter-chip` | 移动端筛选芯片 | 移动端单个筛选条件 chip |
| — | `.mobile-filter-chip-dropdown` | 芯片下拉菜单 | 点击 chip 展开的选项列表 |
| — | `.filter-x` | 筛选按钮关闭符 | 移动端筛选按钮上的 × |

### 2.2 筛选抽屉（移动端）

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `filterDrawerOverlay` | `.filter-drawer-overlay` | 筛选抽屉遮罩 | 半透明背景遮罩 |
| `filterDrawer` | `.filter-drawer` | 筛选抽屉 | 从底部弹出的筛选面板 |
| `filterDrawerContent` | — | 筛选抽屉内容 | 可滚动的筛选选项区域 |
| — | `.filter-drawer-title` | 抽屉标题 | "筛选条件" + 关闭按钮 |
| — | `.filter-drawer-close` | 抽屉关闭按钮 | × 关闭抽屉 |
| — | `.filter-drawer-btns` | 抽屉按钮组 | 重置 + 确定按钮 |
| — | `.filter-drawer-reset` | 重置按钮 | 清空所有筛选 |
| — | `.filter-drawer-confirm` | 确定按钮 | 应用筛选并关闭 |
| `fcat-${key}` | `.filter-category` | 筛选分类 | 公司/类型/岗位/城市分类折叠 |
| — | `.filter-category-header` | 分类头部 | 分类名称 + 展开/收起箭头 |
| — | `.filter-category-body` | 分类内容 | 搜索框 + 选项列表 |
| `fopts-${key}` | `.filter-category-options` | 分类选项列表 | 可勾选的筛选选项 |
| — | `.filter-category-option` | 单个筛选选项 | checkbox + 名称 + 数量 |
| — | `.filter-category-search` | 分类内搜索 | 快速定位选项 |

### 2.3 表头筛选下拉

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `companyFilterHeader` | `.th-filter` | 公司筛选表头 | 点击展开公司筛选下拉 |
| `companyDD` | `.col-filter-dd` | 公司筛选下拉 | 公司多选筛选面板 |
| `companySearchInput` | `.col-filter-search` | 公司搜索 | 快速筛选公司名 |
| `companyFilterList` | `.col-filter-list` | 公司选项列表 | 公司 checkbox 列表 |
| `typeFilterHeader` | `.th-filter` | 类型筛选表头 | 点击展开类型筛选下拉 |
| `typeDD` | `.col-filter-dd` | 类型筛选下拉 | 类型多选筛选面板 |
| `typeSearchInput` | `.col-filter-search` | 类型搜索 | 快速筛选类型 |
| `typeFilterList` | `.col-filter-list` | 类型选项列表 | 类型 checkbox 列表 |
| `posFilterHeader` | `.th-filter` | 岗位筛选表头 | 点击展开岗位筛选下拉 |
| `posDD` | `.col-filter-dd` | 岗位筛选下拉 | 岗位多选筛选面板 |
| `posSearchInput` | `.col-filter-search` | 岗位搜索 | 快速筛选岗位名 |
| `posFilterList` | `.col-filter-list` | 岗位选项列表 | 岗位 checkbox 列表 |
| `cityFilterHeader` | `.th-filter` | 城市筛选表头 | 点击展开城市筛选下拉 |
| `cityDD` | `.col-filter-dd` | 城市筛选下拉 | 城市多选筛选面板 |
| `citySearchInput` | `.col-filter-search` | 城市搜索 | 快速筛选城市名 |
| `cityFilterList` | `.col-filter-list` | 城市选项列表 | 城市 checkbox 列表 |

### 2.4 数据表格

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `loading` | `.loading` | 加载动画 | 数据加载中 spinner |
| `mainTable` | `.table-card` | 主数据表格 | 岗位信息表格容器 |
| `checkAll` | `.col-check` | 全选框 | 表头全选 checkbox |
| — | `.sortable` | 可排序表头 | 点击切换排序 |
| — | `.sort-icon` | 排序图标 | 升序/降序箭头 |
| — | `.col-no` | 序号列 | 岗位编号 |
| — | `.col-company` | 公司列 | 公司名称（可点击查看详情） |
| — | `.col-position` | 岗位列 | 岗位名称 |
| — | `.col-type` | 类型列 | 校招类型标签 |
| — | `.col-city` | 城市列 | 工作城市 |
| — | `.col-date` | 日期列 | 发布日期 |
| — | `.col-deadline` | 截止日期列 | 投递截止日期 |
| — | `.col-link` | 链接列 | 原文链接 |
| — | `.col-check` | 勾选列 | 行选择 checkbox |
| `tbody` | — | 表格主体 | 岗位数据行容器 |

### 2.5 分页

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `paginationWrap` | `.pagination-wrap` | 分页容器 | 桌面端分页区域 |
| `pageInfo` | `.page-info` | 分页信息 | "第 X-Y 条，共 Z 条" |
| `pagination` | `.pagination` | 分页按钮组 | 页码按钮 |
| — | `.page-btn` | 页码按钮 | 单个页码 |
| `jobCards` | `.job-cards` | 岗位卡片列表 | 移动端卡片布局 |
| `jobCardPagination` | `.job-card-pagination` | 卡片分页 | 移动端卡片分页 |

### 2.6 岗位卡片（移动端）

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| — | `.job-card` | 岗位卡片 | 单个岗位信息卡片 |
| — | `.job-card-top` | 卡片顶部 | 勾选框 + 公司名 + 类型标签 |
| — | `.job-card-check` | 卡片勾选框 | 行选择 checkbox |
| — | `.job-card-company` | 卡片公司名 | 公司名称（可点击） |
| — | `.job-card-type` | 卡片类型标签 | 校招类型（如"秋招"） |
| — | `.job-card-position` | 卡片岗位名 | 岗位名称 |
| — | `.job-card-meta` | 卡片元信息 | 城市 + 日期 + 截止日期 |
| — | `.job-card-actions` | 卡片操作栏 | 链接 + 记录投递按钮 |

### 2.7 记录投递

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `recordBtn` | `.record-btn` | 记录投递按钮 | 将选中岗位加入投递进度 |
| `recordCount` | `.record-count` | 已选计数 | 显示已勾选岗位数量 |
| `mobileRecordBar` | `.mobile-record-bar` | 移动端浮动记录栏 | 底部固定"已选 X 条 → 记录投递" |

### 2.8 类型标签样式

| CSS 类名 | 中文名 | 说明 |
|---------|--------|------|
| `.type-tag` | 类型标签基础 | 通用标签样式 |
| `.type-campus` | 校园招聘 | 蓝色系 |
| `.type-fall` | 秋招 | 橙色系 |
| `.type-spring` | 春招 | 绿色系 |
| `.type-intern` | 实习 | 紫色系 |
| `.type-supplement` | 补录 | 红色系 |
| `.type-early` | 提前批 | 青色系 |
| `.type-other` | 其他 | 灰色系 |
| `.urgent` | 急招标记 | 红色加粗 |

---

## 三、投递进度页面（Progress Page）

### 3.1 页面容器

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `progressWrap` | `.progress-wrap` | 投递进度页面 | 整个进度页面容器 |
| — | `.main-wrap` | 主页面容器 | 招聘岗位页面容器 |
| — | `.tabs` | 底部标签栏 | 招聘岗位/投递进度/Offer 对比 切换 |
| — | `.tab-btn` | 标签按钮 | 单个页面切换按钮 |

### 3.2 进度统计

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `progressStats` | `.progress-stats` | 进度统计面板 | 各阶段数量统计 |
| — | `.pstat` | 单个统计项 | 阶段名 + 数量 |
| — | `.pstat-num` | 统计数字 | 阶段数量值 |
| — | `.pstat-label` | 统计标签 | 阶段名称 |

### 3.3 工具栏

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| — | `.progress-toolbar` | 进度工具栏 | 搜索 + 筛选 + 排序 + 操作按钮 |
| `progressSearchInput` | `.progress-search input` | 进度搜索框 | 搜索公司/岗位/城市 |
| `progressStageFilter` | `.progress-filter-select` | 阶段筛选下拉 | 按投递阶段筛选 |
| `progressSortSelect` | `.progress-filter-select` | 排序下拉 | 按时间/公司/阶段排序 |
| — | `.add-manual-btn` | 手动添加按钮 | 打开添加投递记录弹窗 |
| — | `.export-btn` | 导出按钮 | 导出投递进度 JSON |
| `batchDeleteBtn` | `.export-btn` | 批量删除按钮 | 删除选中的投递记录 |
| — | `.export-btn`（导入） | 导入按钮 | 导入 JSON 备份文件 |

### 3.4 阶段筛选（移动端）

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| — | `.stage-filter-dropdown` | 阶段筛选下拉面板 | 移动端阶段多选面板 |
| — | `.stage-filter-option` | 阶段筛选选项 | 单个阶段 checkbox |

### 3.5 进度表格

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `progressTable` | `.table-card` | 进度表格 | 投递记录表格 |
| `pCheckAll` | `.col-check` | 全选框 | 表头全选 checkbox |
| `progressTbody` | — | 进度表格主体 | 投递记录行容器 |
| `progressEmpty` | `.empty` | 空状态提示 | "暂无投递记录" |

### 3.6 进度卡片（移动端）

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `progressCards` | `.progress-cards` | 进度卡片列表 | 移动端卡片布局 |
| — | `.progress-card` | 进度卡片 | 单个投递记录卡片 |
| — | `.progress-card-top` | 卡片顶部 | 勾选框 + 公司名 + 阶段 badge |
| — | `.progress-card-check` | 卡片勾选框 | 行选择 checkbox |
| — | `.progress-card-company` | 卡片公司名 | 公司名称 |
| — | `.progress-card-stage` | 阶段 badge | 投递阶段标签（彩色） |
| — | `.progress-stage-badge` | 阶段徽章 | 阶段名称 + 背景色 |
| — | `.progress-card-position` | 卡片岗位名 | 岗位名称 |
| — | `.progress-card-meta` | 卡片元信息 | 城市 + 日期 + 备注 |
| — | `.progress-card-note` | 卡片备注 | 备注文本 |
| — | `.progress-card-actions` | 卡片操作栏 | 更改阶段/编辑/详情/删除 |

### 3.7 阶段颜色

| CSS 类名 | 阶段 | 颜色 |
|---------|------|------|
| `.stage-apply` | 投递 | 蓝色 |
| `.stage-test` | 测评 | 青色 |
| `.stage-call` | 电邀 | 紫色 |
| `.stage-group` | 群面 | 黄色 |
| `.stage-first` | 一面 | 橙色 |
| `.stage-second` | 二面 | 浅红 |
| `.stage-third` | 三面 | 红色 |
| `.stage-hr` | HR面 | 粉色 |
| `.stage-offer` | Offer | 绿色 |
| `.stage-join` | 入职 | 深绿 |
| `.stage-reject` | 拒绝 | 灰色 |

### 3.8 操作按钮

| CSS 类名 | 中文名 | 功能 |
|---------|--------|------|
| `.action-btn` | 操作按钮 | 表格行操作按钮基础样式 |
| `.progress-actions` | 操作按钮组 | 更改阶段/编辑/详情/删除 |

---

## 四、Offer 对比页面（Offer Page）

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `offerWrap` | `.offer-wrap` | Offer 对比页面 | 整个 Offer 页面容器 |
| `offerContent` | — | Offer 内容区 | Offer 卡片列表容器 |
| — | `.offer-toolbar` | Offer 工具栏 | 添加 Offer 按钮 |
| — | `.offer-cards` | Offer 卡片列表 | Offer 卡片容器 |
| — | `.offer-card` | Offer 卡片 | 单个 Offer 信息卡片 |
| — | `.offer-card-header` | 卡片头部 | 公司名 + 岗位名 + 城市 |
| — | `.offer-card-company` | 卡片公司名 | 公司名称 |
| — | `.offer-card-position` | 卡片岗位名 | 岗位名称 |
| — | `.offer-card-city` | 卡片城市 | 工作城市 |
| — | `.offer-rows` | 信息行容器 | 薪资/福利等信息行 |
| — | `.offer-row` | 单行信息 | 标签 + 值 |
| — | `.offer-row-label` | 行标签 | 如"月薪"、"年薪" |
| — | `.offer-row-value` | 行值 | 具体数值 |
| — | `.offer-card-notes` | 卡片备注 | 备注文本 |
| — | `.offer-card-actions` | 卡片操作栏 | 编辑/删除按钮 |
| — | `.best` | 最佳标记 | 最优 Offer 高亮 |
| — | `.offer-empty` | 空状态 | "暂无 Offer 记录" |
| — | `.offer-empty-icon` | 空状态图标 | 空状态装饰图标 |

---

## 五、弹窗 / Modal

### 5.1 Offer 编辑弹窗

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `offerModalOverlay` | `.modal-overlay.offer-modal` | Offer 弹窗遮罩 | 半透明背景 |
| `offerModalTitle` | — | 弹窗标题 | "添加 Offer" / "编辑 Offer" |
| `offerCompany` | `.modal-row` | 公司输入 | 公司名称输入框 |
| `offerPosition` | `.modal-row` | 岗位输入 | 岗位名称输入框 |
| `offerCity` | `.modal-row` | 城市输入 | 工作城市输入框 |
| `offerMonthly` | `.modal-row` | 月薪输入 | 月薪金额输入框 |
| `offerAnnual` | `.modal-row` | 年薪输入 | 年薪金额输入框 |
| `offerSigning` | `.modal-row` | 签约金输入 | 签约金输入框 |
| `offerYearEnd` | `.modal-row` | 年终奖输入 | 年终奖输入框 |
| `offerWorkHours` | `.modal-row` | 工作时长输入 | 工作时间输入框 |
| `offerInsurance` | `.modal-row` | 五险一金输入 | 社保公积金信息 |
| `offerHousing` | `.modal-row` | 住房补贴输入 | 住房补贴/公积金 |
| `offerNotes` | `.modal-row` | 备注输入 | 备注文本域 |
| `offerConfirmBtn` | `.modal-confirm` | 确认按钮 | 保存 Offer |

### 5.2 投递记录弹窗

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `modalOverlay` | `.modal-overlay` | 投递弹窗遮罩 | 半透明背景 |
| `modalTitle` | — | 弹窗标题 | "添加投递记录" / "编辑投递记录" |
| `modalCompany` | `.modal-row` | 公司输入 | 公司名称输入框 |
| `modalPosition` | `.modal-row` | 岗位输入 | 岗位名称输入框 |
| `modalCity` | `.modal-row` | 城市输入 | 工作城市输入框 |
| `modalDate` | `.modal-row` | 日期输入 | 投递日期输入框 |
| `modalStage` | `.modal-row` | 阶段选择 | 投递阶段下拉选择 |
| `modalNote` | `.modal-row` | 备注输入 | 备注文本域 |
| `modalConfirmBtn` | `.modal-confirm` | 确认按钮 | 保存投递记录 |

### 5.3 时间线弹窗

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `timelineOverlay` | `.modal-overlay` | 时间线遮罩 | 半透明背景 |
| `timelineTitle` | — | 时间线标题 | "投递时间线" |
| `timelineContent` | `.timeline` | 时间线内容 | 阶段节点列表 |
| — | `.timeline-item` | 时间线节点 | 单个阶段节点 |
| — | `.timeline-dot` | 节点圆点 | 阶段标记圆点 |

### 5.4 公司详情弹窗

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `companyOverlay` | `.modal-overlay` | 公司详情遮罩 | 半透明背景 |
| `companyCard` | `.modal.company-card` | 公司详情卡片 | 企业信息详情 |
| — | `.cc-header` | 公司头部 | Logo + 名称 + 标签 |
| `ccTags` | `.cc-tags` | 公司标签 | 企业标签列表 |
| — | `.cc-tag` | 单个标签 | 企业标签 |
| — | `.cc-logo` | 公司 Logo | 企业 Logo 图片 |
| — | `.cc-logo-fallback` | Logo 占位 | Logo 加载失败占位 |
| — | `.cc-name` | 公司名称 | 企业名称 |
| — | `.cc-section` | 内容区块 | 企业简介/标签等区块 |
| — | `.cc-section-title` | 区块标题 | "企业简介"、"标签"等 |
| `ccSummary` | `.cc-summary` | 企业简介 | AI 生成的企业简介文本 |
| — | `.cc-summary-loading` | 简介加载中 | 简介加载动画 |
| — | `.cc-links` | 相关链接 | 官网/招聘页等链接 |
| — | `.cc-link` | 单个链接 | 单个外部链接 |
| — | `.cc-section` | 岗位列表区块 | 该公司在招岗位列表 |

### 5.5 登录弹窗

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `loginModalOverlay` | `.modal-overlay.login-modal` | 登录弹窗遮罩 | 半透明背景 |
| — | `.login-github-btn` | GitHub 登录按钮 | OAuth 第三方登录 |
| — | `.login-divider` | 分隔线 | "或" 分隔线 |
| — | `.phone-login-form` | 手机号登录表单 | 手机号 + 验证码 |
| `phoneCountryCode` | — | 国际区号选择 | +86 等区号下拉 |
| `phoneInput` | `.phone-input-row` | 手机号输入 | 手机号输入框 |
| `sendCodeBtn` | `.verify-code-btn` | 发送验证码按钮 | 获取短信验证码 |
| `phoneCodeInput` | — | 验证码输入 | 验证码输入框 |
| `verifyCodeBtn` | `.verify-code-btn` | 验证按钮 | 提交验证码登录 |

---

## 六、全局组件

| 组件 ID | CSS 类名 | 中文名 | 功能 |
|---------|---------|--------|------|
| `toast` | `.toast` | 消息提示 | 底部浮层提示（如"已保存"） |
| — | `.spinner` | 加载动画 | 旋转加载指示器 |
| — | `.hidden` | 隐藏状态 | `display: none` |
| — | `.show` | 显示状态 | `display: block` |
| — | `.modal` | 弹窗基础 | 弹窗内容容器 |
| — | `.modal-overlay` | 弹窗遮罩基础 | 半透明全屏遮罩 |
| — | `.modal-btns` | 弹窗按钮组 | 确认/取消按钮 |
| — | `.modal-confirm` | 确认按钮 | 弹窗确认操作 |
| — | `.modal-cancel` | 取消按钮 | 弹窗取消操作 |
| — | `.modal-row` | 弹窗表单行 | 标签 + 输入框 |

---

## 七、核心 JS 函数清单

| 函数名 | 中文名 | 功能 |
|--------|--------|------|
| `loadData()` | 加载数据 | 从 JSON 加载岗位数据 |
| `loadUpdateMeta()` | 加载更新元数据 | 获取数据更新时间 |
| `applyFilter()` | 应用筛选 | 执行筛选逻辑 |
| `applySort()` | 应用排序 | 执行排序逻辑 |
| `renderTable()` | 渲染表格 | 生成桌面端表格 HTML |
| `renderJobCards()` | 渲染岗位卡片 | 生成移动端卡片 HTML |
| `renderPagination()` | 渲染分页 | 生成分页按钮 |
| `renderActiveFilters()` | 渲染已选筛选 | 生成筛选标签 |
| `renderMobileFilterBar()` | 渲染移动端筛选栏 | 生成 chip 标签 |
| `openFilterDrawer()` | 打开筛选抽屉 | 显示移动端筛选面板 |
| `closeFilterDrawer()` | 关闭筛选抽屉 | 隐藏筛选面板 |
| `applyFilterDrawer()` | 应用抽屉筛选 | 确认筛选条件 |
| `resetFilters()` | 重置筛选 | 清空所有筛选 |
| `clearAllFilters()` | 清除全部筛选 | 一键清除 |
| `switchPage()` | 切换页面 | Tab 页面切换 |
| `renderProgressPage()` | 渲染进度页面 | 刷新投递进度 |
| `renderProgressTable()` | 渲染进度表格 | 生成进度表格 HTML |
| `renderProgressCards()` | 渲染进度卡片 | 生成移动端进度卡片 |
| `renderProgressStats()` | 渲染进度统计 | 生成阶段统计 |
| `getFilteredProgress()` | 获取筛选后进度 | 筛选+排序投递记录 |
| `showAddModal()` | 显示添加弹窗 | 打开添加投递记录 |
| `showEditModal()` | 显示编辑弹窗 | 打开编辑投递记录 |
| `confirmModal()` | 确认弹窗 | 保存投递记录 |
| `showTimeline()` | 显示时间线 | 打开投递时间线 |
| `updateStage()` | 更新阶段 | 更改投递阶段 |
| `deleteRecord()` | 删除记录 | 删除单条投递 |
| `batchDeleteProgress()` | 批量删除 | 删除选中记录 |
| `exportProgress()` | 导出进度 | 导出 JSON 备份 |
| `importProgress()` | 导入进度 | 导入 JSON 备份 |
| `showCompanyDetail()` | 显示公司详情 | 打开企业详情卡片 |
| `getCompanyProfile()` | 获取公司简介 | 匹配企业简介数据 |
| `showOfferModal()` | 显示 Offer 弹窗 | 打开 Offer 编辑 |
| `confirmOffer()` | 确认 Offer | 保存 Offer |
| `renderOffers()` | 渲染 Offer | 生成 Offer 卡片 |
| `findBest()` | 查找最佳 Offer | 标记最优 Offer |
| `recordSelected()` | 记录选中 | 将选中岗位加入进度 |
| `showQuote()` | 显示励志语 | 随机显示励志短句 |
| `showToast()` | 显示提示 | 底部浮层提示 |
| `esc()` | 转义 HTML | XSS 防护 |
| `isMobile()` | 判断移动端 | 响应式判断 |
| `initAuth()` | 初始化认证 | Supabase 认证初始化 |
| `syncNow()` | 立即同步 | 云端数据同步 |

---

## 八、数据文件

| 文件 | 中文名 | 说明 |
|------|--------|------|
| `data/jobs.json` | 岗位数据 | 主数据源，所有岗位信息 |
| `data/company-profiles.json` | 企业简介 | 1971 条企业简介+标签 |
| `data/update-meta.json` | 更新元数据 | 数据更新时间记录 |
| `data/missing-companies.json` | 缺失企业 | 缺少简介的企业列表 |

---

## 九、localStorage Keys

| Key | 中文名 | 说明 |
|-----|--------|------|
| `campus_recruit_progress` | 投递进度 | 用户投递记录 |
| `campus_recruit_offers` | Offer 数据 | 用户 Offer 记录 |
