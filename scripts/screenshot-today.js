/**
 * 截图今日校招页面
 * 输出: scripts/output/today-recruit.png (1260x880)
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const URL = 'http://127.0.0.1:8080/';
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'today-recruit.png');
const WIDTH = 1260;
const HEIGHT = 880;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-font-subscription'],
  });
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // 等待主表格加载
  await page.waitForSelector('#mainTable', { timeout: 15000 });

  // 检查并跳过使用教程
  const tutorialOverlay = await page.$('.tutorial-overlay.show');
  if (tutorialOverlay) {
    console.log('检测到使用教程，点击跳过...');
    const skipButton = await page.$('#tutorialSkip');
    if (skipButton) {
      await skipButton.click();
      await sleep(1000);
      console.log('教程已跳过');
    }
  }

  // 等待页面稳定
  await sleep(2000);

  // 用 pdf 方式截图绕过字体等待
  const pdfBuf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  // 将 pdf 转为 png（用 page.screenshot 的 timeout 覆盖）
  await page.screenshot({ path: OUTPUT_FILE, fullPage: false, timeout: 5000 });
  await browser.close();

  console.log(`截图已保存: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('截图失败:', err);
  process.exit(1);
});
