# 小红书自动发布脚本

## 功能说明

自动化发布校招信息到小红书的完整流程：

1. **截图**：使用 Playwright 截取 GitHub Pages 页面（1260x880）
2. **文案**：调用现有文案生成脚本
3. **发布**：使用 opencli 发布到小红书

## 前置条件

1. **Chrome 浏览器**：需要安装并启用 opencli 扩展
2. **opencli**：已安装并配置好小红书账号
3. **文案生成脚本**：`C:\Users\Administrator\Desktop\小红书\today_recruit\文案\生成今日文案.bat`
4. **小红书账号**：已登录并保存状态

## 文件结构

```
scripts/
├── xhs-auto-publish.js     # 主流程脚本
├── run-xhs-publish.bat     # 定时任务批处理文件
├── xhs-publish-task.xml    # Windows 定时任务配置
├── install-xhs-task.bat    # 安装定时任务脚本
└── README.md               # 本说明文件

data/xhs-content/
├── screenshots/            # 截图存储目录
└── publish-log.json        # 发布日志
```

## 使用方法

### 手动运行

```bash
# 运行自动发布脚本
npm run xhs-publish

# 或者直接运行
node scripts/xhs-auto-publish.js
```

### 安装定时任务

以管理员权限运行：

```bash
# 运行安装脚本
scripts/install-xhs-task.bat

# 或者手动安装
schtasks /create /tn "Campus Recruit\XHS Auto Publish" /xml "scripts/xhs-publish-task.xml" /f
```

### 管理定时任务

```bash
# 查看任务状态
schtasks /query /tn "Campus Recruit\XHS Auto Publish"

# 手动触发任务
schtasks /run /tn "Campus Recruit\XHS Auto Publish"

# 删除任务
schtasks /delete /tn "Campus Recruit\XHS Auto Publish" /f
```

## 配置说明

在 `xhs-auto-publish.js` 中可以修改以下配置：

```javascript
const CONFIG = {
  // GitHub Pages URL
  githubPagesUrl: 'https://usershamene.github.io/campus-recruit/',

  // 截图配置
  screenshot: {
    width: 1260,
    height: 880,
    outputDir: path.join(__dirname, '..', 'data', 'xhs-content', 'screenshots'),
  },

  // 文案生成脚本
  contentGenerator: 'C:/Users/Administrator/Desktop/小红书/today_recruit/文案/生成今日文案.bat',

  // 文案输出目录
  contentDir: 'C:/Users/Administrator/Desktop/小红书/today_recruit/文案',

  // 小红书发布页面
  xhsPublishUrl: 'https://creator.xiaohongshu.com/publish/publish',

  // 合集名称
  collectionName: '每日校招更新合集',

  // 标签合集名称
  tagCollectionName: '校招合集',
};
```

## 发布流程

1. **检查今日是否已发布**
   - 读取 `data/xhs-content/publish-log.json`
   - 如果今日已发布，跳过流程

2. **截图**
   - 打开 GitHub Pages 页面
   - 等待页面加载完成
   - 跳过使用教程（如果存在）
   - 截取 1260x880 区域

3. **生成文案**
   - 运行文案生成脚本
   - 读取生成的文案文件

4. **发布到小红书**
   - 打开小红书创作者中心
   - 切换到图文发布模式
   - 上传截图
   - 输入标题和正文
   - 使用话题模板添加话题（`data-opencli-ref="109"`）
   - 勾选"原创声明"
   - 选择合集："每日校招更新"
   - 添加标签："校招合集"
   - 点击发布

5. **记录发布状态**
   - 保存到 `data/xhs-content/publish-log.json`
   - 记录时间、状态、标题等信息

## 日志查看

发布日志保存在：

- **脚本日志**：`logs/xhs-publish.log`
- **发布记录**：`data/xhs-content/publish-log.json`

## 故障排除

### 1. 截图失败

- 检查 GitHub Pages 是否可访问
- 检查 Playwright 是否正确安装
- 检查网络连接

### 2. 文案生成失败

- 检查文案生成脚本是否存在
- 检查文案输出目录权限
- 检查网络连接

### 3. 发布失败

- 检查 opencli 是否正确安装
- 检查小红书账号是否登录
- 检查 Chrome 浏览器是否运行
- 检查 opencli 扩展是否启用

### 4. 定时任务不执行

- 检查任务计划程序中任务是否启用
- 检查任务触发器时间是否正确
- 检查任务执行条件（电源、网络等）

## 注意事项

1. **防重复发布**：脚本会检查今日是否已发布，避免重复发布
2. **错误处理**：发布失败会记录日志，不会重复重试
3. **登录状态**：opencli 会保存登录状态，无需每次登录
4. **网络要求**：需要稳定的网络连接
5. **电源要求**：定时任务需要电脑保持开机状态
6. **话题模板**：使用小红书话题模板功能自动添加话题标签

## 话题模板配置

脚本使用小红书的话题模板功能自动添加话题：

- **模板入口**：`data-opencli-ref="109"`（使用/管理话题模板）
- **模板名称**：每日校招更新模板
- **功能**：在正文末尾自动添加预设的话题标签

## 更新日志

- **2026-06-21**：添加话题模板功能，截图前自动跳过使用教程
- **2026-06-20**：初始版本，实现基本功能
