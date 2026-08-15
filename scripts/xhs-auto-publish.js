/**
 * 小红书自动发布脚本
 *
 * 流程：
 * 1. 检查今日是否已发布
 * 2. 使用 Playwright 截取 GitHub Pages 页面
 * 3. 运行文案生成脚本
 * 4. 读取生成的文案
 * 5. 调用 opencli 发布到小红书
 * 6. 记录发布状态
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // GitHub Pages URL（测试时使用本地服务器）
  githubPagesUrl: process.argv.includes('--local') ? 'http://localhost:8080' : 'https://usershamene.github.io/campus-recruit/',

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

  // 发布日志
  publishLog: path.join(__dirname, '..', 'data', 'xhs-content', 'publish-log.json'),

  // opencli 会话名称
  browserSession: 'xhs-auto',

  // 小红书发布页面
  xhsPublishUrl: 'https://creator.xiaohongshu.com/publish/publish',

  // 合集名称
  collectionName: '每日校招更新合集',

  // 标签合集名称
  tagCollectionName: '校招合集',

  // 重试配置
  retry: {
    maxAttempts: 3,
    delayMs: 5000,
  },
};

// 工具函数
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
};

const log = (message, level = 'INFO') => {
  const timestamp = `${getDate()} ${getTime()}`;
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// 检查今日是否已发布
const checkAlreadyPublished = () => {
  try {
    if (!fs.existsSync(CONFIG.publishLog)) {
      return false;
    }

    const logData = JSON.parse(fs.readFileSync(CONFIG.publishLog, 'utf-8'));
    const today = getDate();

    return logData.some((entry) => entry.date === today && entry.status === 'success');
  } catch (error) {
    log(`检查发布日志失败: ${error.message}`, 'ERROR');
    return false;
  }
};

// 记录发布状态
const logPublishStatus = (status, details = {}) => {
  try {
    let logData = [];

    if (fs.existsSync(CONFIG.publishLog)) {
      logData = JSON.parse(fs.readFileSync(CONFIG.publishLog, 'utf-8'));
    }

    logData.push({
      date: getDate(),
      time: getTime(),
      status,
      ...details,
    });

    // 只保留最近 30 天的日志
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    logData = logData.filter((entry) => new Date(entry.date) >= thirtyDaysAgo);

    fs.writeFileSync(CONFIG.publishLog, JSON.stringify(logData, null, 2), 'utf-8');
    log(`发布状态已记录: ${status}`);
  } catch (error) {
    log(`记录发布状态失败: ${error.message}`, 'ERROR');
  }
};

// 使用 Playwright 截图
const takeScreenshot = async () => {
  const { chromium } = require('playwright');
  const screenshotPath = path.join(CONFIG.screenshot.outputDir, `jobs-${getDate()}.png`);

  log('启动浏览器...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: {
      width: CONFIG.screenshot.width,
      height: CONFIG.screenshot.height,
    },
  });
  const page = await context.newPage();

  try {
    log(`打开页面: ${CONFIG.githubPagesUrl}`);
    await page.goto(CONFIG.githubPagesUrl, { waitUntil: 'networkidle', timeout: 60000 });

    // 等待主表格加载
    log('等待页面加载...');
    await page.waitForSelector('#mainTable', { timeout: 30000 });

    // 检查并跳过使用教程
    const tutorialOverlay = await page.$('.tutorial-overlay.show');
    if (tutorialOverlay) {
      log('检测到使用教程，点击跳过...');
      const skipButton = await page.$('#tutorialSkip');
      if (skipButton) {
        await skipButton.click();
        await sleep(1000);
        log('教程已跳过');
      }
    }

    // 等待页面稳定
    await sleep(2000);

    // 截图
    log('开始截图...');
    await page.screenshot({
      path: screenshotPath,
      clip: {
        x: 0,
        y: 0,
        width: CONFIG.screenshot.width,
        height: CONFIG.screenshot.height,
      },
    });

    log(`截图已保存: ${screenshotPath}`);
    return screenshotPath;
  } catch (error) {
    log(`截图失败: ${error.message}`, 'ERROR');
    throw error;
  } finally {
    await browser.close();
  }
};

// 运行文案生成脚本
const generateContent = () => {
  log('运行文案生成脚本...');
  try {
    execSync(CONFIG.contentGenerator, {
      encoding: 'utf-8',
      stdio: 'inherit',
    });
    log('文案生成完成');
  } catch (error) {
    log(`文案生成失败: ${error.message}`, 'ERROR');
    throw error;
  }
};

// 读取生成的文案
const readContent = () => {
  const today = getDate();
  const contentPath = path.join(CONFIG.contentDir, today, '校招更新.txt');

  log(`读取文案: ${contentPath}`);

  if (!fs.existsSync(contentPath)) {
    throw new Error(`文案文件不存在: ${contentPath}`);
  }

  const content = fs.readFileSync(contentPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  // 提取标题（第一行）
  const title = lines[0] || '';

  // 提取正文（除标题和分隔线外的内容）
  const bodyLines = lines.filter((line) => !line.startsWith('---'));
  const body = bodyLines.slice(1).join('\n').trim();

  log(`标题: ${title}`);
  log(`正文长度: ${body.length} 字`);

  return { title, body, content };
};

// 发布到小红书
const publishToXHS = async (screenshotPath, content) => {
  const { title, body } = content;

  log('开始发布到小红书...');

  // 1. 打开小红书创作者中心
  log('打开小红书创作者中心...');
  execSync(`opencli browser ${CONFIG.browserSession} open "${CONFIG.xhsPublishUrl}"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(3000);

  // 2. 切换到图文发布模式（点击"上传图文"）
  log('切换到图文发布模式...');
  execSync(`opencli browser ${CONFIG.browserSession} find --css "[class*='title']"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);

  // 3. 上传截图
  log('上传截图...');
  execSync(`opencli browser ${CONFIG.browserSession} find --css "input[type=file]"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);
  execSync(`opencli browser ${CONFIG.browserSession} upload 84 "${screenshotPath}"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(3000);

  // 4. 输入标题
  log('输入标题...');
  execSync(`opencli browser ${CONFIG.browserSession} fill 84 "${title.replace(/"/g, '\\"')}"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);

  // 5. 输入正文
  log('输入正文...');
  execSync(`opencli browser ${CONFIG.browserSession} fill 90 "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);

  // 6. 使用话题模板添加话题
  log('使用话题模板添加话题...');
  execSync(`opencli browser ${CONFIG.browserSession} click 109`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(2000);

  // 7. 勾选"原创作品"
  log('勾选原创作品...');
  execSync(`opencli browser ${CONFIG.browserSession} find --css ".original-wrapper input[type=checkbox]"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);
  execSync(`opencli browser ${CONFIG.browserSession} check 152`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);

  // 8. 选择合集
  log(`选择合集: ${CONFIG.collectionName}...`);
  execSync(`opencli browser ${CONFIG.browserSession} find --css ".collection-plugin-choose"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);
  execSync(`opencli browser ${CONFIG.browserSession} click 144`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(2000);
  execSync(`opencli browser ${CONFIG.browserSession} find --css ".collection-plugin-popover .item"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);
  execSync(`opencli browser ${CONFIG.browserSession} click 349`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(2000);

  // 9. 点击发布
  log('点击发布...');
  execSync(`opencli browser ${CONFIG.browserSession} find --css ".btn-wrapper"`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(1000);
  execSync(`opencli browser ${CONFIG.browserSession} click 16`, {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  await sleep(5000);

  log('发布完成！');
};

// 主函数
const main = async () => {
  const today = getDate();
  const skipContentGen = process.argv.includes('--skip-content-gen');
  log(`===== 小红书自动发布流程开始 (${today}) =====`);

  // 1. 检查今日是否已发布
  if (checkAlreadyPublished()) {
    log('今日已发布，跳过...');
    return;
  }

  let screenshotPath = null;

  try {
    // 2. 截图
    screenshotPath = await takeScreenshot();

    // 3. 生成文案（可跳过）
    if (!skipContentGen) {
      generateContent();
    } else {
      log('跳过文案生成步骤（使用现有文案）');
    }

    // 4. 读取文案
    const content = readContent();

    // 5. 发布到小红书
    await publishToXHS(screenshotPath, content);

    // 6. 记录成功
    logPublishStatus('success', {
      screenshot: screenshotPath,
      title: content.title,
    });

    log('===== 流程完成 =====');
  } catch (error) {
    log(`流程失败: ${error.message}`, 'ERROR');

    // 记录失败
    logPublishStatus('failed', {
      error: error.message,
      screenshot: screenshotPath,
    });

    throw error;
  }
};

// 运行主函数
main().catch((error) => {
  log(`程序异常退出: ${error.message}`, 'ERROR');
  process.exit(1);
});
