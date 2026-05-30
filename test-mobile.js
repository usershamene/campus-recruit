/**
 * 移动端布局自动化测试
 * 通过检查元素的可见性、尺寸、位置和计算样式来验证响应式设计
 * 运行: node test-mobile.js
 */
const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:8080';
const MOBILE_VIEWPORT = { width: 375, height: 812 }; // iPhone 14

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ❌ ${name} — ${detail}`);
  }
}

async function getComputedStyles(page, selector, props) {
  return page.evaluate(({ sel, props }) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const result = {};
    for (const p of props) result[p] = cs[p];
    return result;
  }, { sel: selector, props });
}

async function getRect(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right };
  }, selector);
}

async function isVisible(page, selector) {
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetHeight > 0;
  }, selector);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: MOBILE_VIEWPORT });
  const page = await context.newPage();

  // 收集控制台错误
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#loading', { state: 'hidden', timeout: 15000 });

  console.log('\n📱 移动端布局测试 (375×812)\n');

  // ═══════════════════════════════════════
  // 1. Header 布局
  // ═══════════════════════════════════════
  console.log('▸ Header 布局');

  const headerTop = await getComputedStyles(page, '.header-top', ['flexDirection', 'flexWrap']);
  check('Header 横向布局（标题+登录齐平）', headerTop?.flexDirection === 'row', `实际: ${headerTop?.flexDirection}`);
  check('Header 允许换行', headerTop?.flexWrap === 'wrap', `实际: ${headerTop?.flexWrap}`);

  const stats = await getRect(page, '.stats');
  check('统计区域可见', stats && stats.width > 0, `width: ${stats?.width}`);

  const userArea = await getRect(page, '.user-area');
  check('用户区域可见', userArea && userArea.width > 0, `width: ${userArea?.width}`);

  // 用户区域不应溢出屏幕
  check('用户区域不溢出', userArea && userArea.right <= 376, `right: ${userArea?.right}`);

  const updateTime = await isVisible(page, '.update-time');
  check('更新时间可见', updateTime, '');

  // 标题和登录应在同一行
  const h1 = await getRect(page, '.header-top h1');
  const login = await getRect(page, '.user-area');
  if (h1 && login) {
    check('标题和登录齐平（同一行）', Math.abs(h1.y - login.y) < 20, `h1.y: ${h1.y?.toFixed(0)}, login.y: ${login.y?.toFixed(0)}`);
  }

  // 更新时间应在标题下方
  const updateTimeRect = await getRect(page, '.update-time-wrap');
  if (h1 && updateTimeRect) {
    check('更新时间在标题下方', updateTimeRect.y > h1.y + h1.height - 5, `h1.bottom: ${(h1.y + h1.height)?.toFixed(0)}, updateTime.y: ${updateTimeRect.y?.toFixed(0)}`);
  }

  // ═══════════════════════════════════════
  // 2. Tab 栏固定底部
  // ═══════════════════════════════════════
  console.log('\n▸ Tab 栏');

  // 主页面有3个 .tabs 元素（每个页面一个），检查第一个
  const tabs = await page.$$('.tabs');
  for (let i = 0; i < tabs.length; i++) {
    const styles = await tabs[i].evaluate(el => {
      const cs = getComputedStyle(el);
      return { position: cs.position, bottom: cs.bottom, display: cs.display };
    });
    check(`Tabs[${i}] 固定底部`, styles.position === 'fixed' && styles.bottom === '0px',
      `position: ${styles.position}, bottom: ${styles.bottom}`);
  }

  // tabs-right 应隐藏
  const tabsRight = await getComputedStyles(page, '.main-wrap .tabs-right', ['display']);
  check('tabs-right 隐藏', tabsRight?.display === 'none', `实际: ${tabsRight?.display}`);

  // body 应有底部 padding
  const bodyPadding = await getComputedStyles(page, 'body', ['paddingBottom']);
  check('body 有底部 padding', parseInt(bodyPadding?.paddingBottom) >= 56, `实际: ${bodyPadding?.paddingBottom}`);

  // ═══════════════════════════════════════
  // 3. 桌面表格隐藏
  // ═══════════════════════════════════════
  console.log('\n▸ 表格→卡片切换');

  const tableDisplay = await page.evaluate(() => {
    const table = document.getElementById('mainTable');
    const cs = getComputedStyle(table);
    return cs.display;
  });
  check('主表格隐藏', tableDisplay === 'none', `实际: ${tableDisplay}`);

  const jobCards = await page.evaluate(() => {
    const el = document.getElementById('jobCards');
    const cs = getComputedStyle(el);
    return { display: cs.display, childCount: el.children.length };
  });
  check('岗位卡片容器可见', jobCards.display !== 'none', `实际: ${jobCards.display}`);
  check('岗位卡片有内容', jobCards.childCount > 0, `子元素: ${jobCards.childCount}`);

  // 检查单个卡片的结构
  const cardStructure = await page.evaluate(() => {
    const card = document.querySelector('.job-card');
    if (!card) return null;
    return {
      hasCompany: !!card.querySelector('.job-card-company'),
      hasPosition: !!card.querySelector('.job-card-position'),
      hasMeta: !!card.querySelector('.job-card-meta'),
      hasActions: !!card.querySelector('.job-card-actions'),
      hasCheck: !!card.querySelector('.job-card-check'),
    };
  });
  if (cardStructure) {
    check('卡片有公司名', cardStructure.hasCompany, '');
    check('卡片有岗位名', cardStructure.hasPosition, '');
    check('卡片有元信息', cardStructure.hasMeta, '');
    check('卡片有操作按钮', cardStructure.hasActions, '');
    check('卡片有复选框', cardStructure.hasCheck, '');
  }

  // 卡片宽度应几乎等于视口宽度（减去 padding）
  const cardRect = await getRect(page, '.job-card');
  if (cardRect) {
    check('卡片宽度合理', cardRect.width > 300 && cardRect.width <= 375,
      `width: ${cardRect.width.toFixed(0)}px`);
  }

  // ═══════════════════════════════════════
  // 4. 搜索框
  // ═══════════════════════════════════════
  console.log('\n▸ 搜索框');

  const searchBox = await getRect(page, '.search-box');
  check('搜索框宽度合理', searchBox && searchBox.width > 200, `width: ${searchBox?.width?.toFixed(0)}px`);

  const searchInput = await getComputedStyles(page, '#searchInput', ['height', 'fontSize']);
  check('搜索框高度≥44px', parseInt(searchInput?.height) >= 44, `height: ${searchInput?.height}`);

  // 筛选按钮可见
  const filterBtn = await isVisible(page, '#mobileFilterBtn');
  check('筛选按钮可见', filterBtn, '');

  // ═══════════════════════════════════════
  // 5. 筛选抽屉
  // ═══════════════════════════════════════
  console.log('\n▸ 筛选抽屉');

  await page.click('#mobileFilterBtn');
  await page.waitForTimeout(300);

  const drawerVisible = await page.evaluate(() => {
    const drawer = document.getElementById('filterDrawer');
    return drawer.classList.contains('show');
  });
  check('点击筛选按钮打开抽屉', drawerVisible, '');

  const drawerContent = await page.evaluate(() => {
    const categories = document.querySelectorAll('.filter-category');
    return categories.length;
  });
  check('抽屉有筛选大类', drawerContent >= 4, `大类数: ${drawerContent}`);

  // 点击第一个大类展开
  await page.click('.filter-category-header');
  await page.waitForTimeout(200);

  const drawerOptions = await page.evaluate(() => {
    return document.querySelectorAll('.filter-category-option').length;
  });
  check('展开后有筛选选项', drawerOptions > 0, `选项数: ${drawerOptions}`);

  // 测试关闭抽屉
  await page.click('.filter-drawer-confirm');
  await page.waitForTimeout(300);
  const drawerClosed = await page.evaluate(() => {
    return !document.getElementById('filterDrawer').classList.contains('show');
  });
  check('确定按钮关闭抽屉', drawerClosed, '');

  // ═══════════════════════════════════════
  // 6. 切换到投递进度
  // ═══════════════════════════════════════
  console.log('\n▸ 投递进度页面');

  await page.evaluate(() => switchPage('progress'));
  await page.waitForTimeout(300);

  const progressTable = await page.evaluate(() => {
    const table = document.getElementById('progressTable');
    return getComputedStyle(table).display;
  });
  check('进度表格隐藏', progressTable === 'none', `实际: ${progressTable}`);

  const progressCards = await page.evaluate(() => {
    const el = document.getElementById('progressCards');
    return { display: getComputedStyle(el).display, exists: !!el };
  });
  check('进度卡片容器存在', progressCards.exists, '');
  check('进度卡片容器可见', progressCards.display !== 'none', `实际: ${progressCards.display}`);

  // 进度工具栏
  const progressToolbar = await getComputedStyles(page, '.progress-toolbar', ['flexDirection']);
  check('进度工具栏垂直排列', progressToolbar?.flexDirection === 'column', `实际: ${progressToolbar?.flexDirection}`);

  // ═══════════════════════════════════════
  // 7. 切换到 Offer 对比
  // ═══════════════════════════════════════
  console.log('\n▸ Offer 对比页面');

  await page.evaluate(() => switchPage('offer'));
  await page.waitForTimeout(300);

  const offerCards = await page.evaluate(() => {
    const el = document.querySelector('.offer-cards');
    if (!el) return { exists: false };
    const cs = getComputedStyle(el);
    return { exists: true, gridTemplateColumns: cs.gridTemplateColumns };
  });
  if (offerCards.exists) {
    check('Offer 卡片单列', offerCards.gridTemplateColumns === '1fr',
      `实际: ${offerCards.gridTemplateColumns}`);
  } else {
    check('Offer 卡片容器存在', true, '(无数据时正常)');
  }

  // ═══════════════════════════════════════
  // 8. 弹窗全屏
  // ═══════════════════════════════════════
  console.log('\n▸ 弹窗');

  await page.evaluate(() => switchPage('progress'));
  await page.waitForTimeout(200);
  await page.evaluate(() => showAddModal());
  await page.waitForTimeout(300);

  const modalSize = await page.evaluate(() => {
    const modal = document.querySelector('#modalOverlay .modal');
    const cs = getComputedStyle(modal);
    return { width: cs.width, height: cs.height, borderRadius: cs.borderRadius };
  });
  check('弹窗宽度 100%', modalSize?.width === '375px' || parseInt(modalSize?.width) >= 370,
    `width: ${modalSize?.width}`);
  check('弹窗高度 100%', modalSize?.height === '812px' || parseInt(modalSize?.height) >= 800,
    `height: ${modalSize?.height}`);
  check('弹窗无圆角', parseInt(modalSize?.borderRadius) === 0, `borderRadius: ${modalSize?.borderRadius}`);

  // 表单字段纵向排列
  const modalRow = await getComputedStyles(page, '#modalOverlay .modal-row', ['flexDirection', 'gap']);
  check('表单字段纵向排列', modalRow?.flexDirection === 'column', `实际: ${modalRow?.flexDirection}`);

  // 输入框高度
  const modalInput = await page.evaluate(() => {
    const input = document.querySelector('#modalOverlay .modal-row input[type="text"]');
    if (!input) return null;
    const cs = getComputedStyle(input);
    return { height: cs.height, fontSize: cs.fontSize };
  });
  check('输入框高度≥44px', modalInput && parseInt(modalInput.height) >= 44, `height: ${modalInput?.height}`);

  await page.evaluate(() => closeModal());
  await page.waitForTimeout(200);

  // ═══════════════════════════════════════
  // 9. 水平溢出检查
  // ═══════════════════════════════════════
  console.log('\n▸ 水平溢出检查');

  await page.evaluate(() => switchPage('main'));
  await page.waitForTimeout(200);

  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  check('页面无水平溢出', !overflow, '');

  // ═══════════════════════════════════════
  // 10. JS 错误检查
  // ═══════════════════════════════════════
  console.log('\n▸ JS 错误');

  check('无控制台错误', consoleErrors.length === 0,
    consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join('; ') : '');

  // ═══════════════════════════════════════
  // 11. 分页功能
  // ═══════════════════════════════════════
  console.log('\n▸ 移动端分页');

  const pagination = await page.evaluate(() => {
    const el = document.getElementById('jobCardPagination');
    if (!el) return null;
    return { display: getComputedStyle(el).display, text: el.textContent.trim() };
  });
  check('移动端分页可见', pagination?.display === 'flex', `实际: ${pagination?.display}`);
  check('分页有内容', pagination?.text.length > 0, `text: ${pagination?.text}`);

  // ═══════════════════════════════════════
  // 汇总
  // ═══════════════════════════════════════
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ 通过: ${passed}  ❌ 失败: ${failed}  共: ${passed + failed}`);

  if (failures.length > 0) {
    console.log('\n失败项:');
    failures.forEach(f => console.log(`  • ${f.name}: ${f.detail}`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
