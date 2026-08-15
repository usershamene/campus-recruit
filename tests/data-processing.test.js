/**
 * tests/data-processing.test.js — 数据清洗核心逻辑单测
 *
 * 运行：node --test tests/
 * 覆盖：deduplicate / isSOE / inferType / splitPositions / processData
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  deduplicate, isSOE, inferType, splitPositions, processData,
  TYPE_MAP, PROVINCES, CITIES, SOE_EXCLUDE,
} = require('../lib/data-processing');

// ══════════════ deduplicate ══════════════

describe('deduplicate 去重与合并', () => {
  test('按 company+positions 去重（忽略大小写与空白）', () => {
    const existing = [{ company: 'A', positions: 'P1', source: 'old' }];
    const newJobs = [{ company: 'a', positions: ' P1 ', source: 'new' }];
    const result = deduplicate(existing, newJobs);
    assert.equal(result.length, 1);
  });

  test('新增不重复岗位', () => {
    const existing = [{ company: 'A', positions: 'P1' }];
    const newJobs = [{ company: 'B', positions: 'P2' }];
    assert.equal(deduplicate(existing, newJobs).length, 2);
  });

  test('重复时补全缺失字段（applyUrl/deadline/location）', () => {
    const existing = [{ company: 'A', positions: 'P1', applyUrl: '', deadline: '', location: '' }];
    const newJobs = [{ company: 'A', positions: 'P1', applyUrl: 'http://x', deadline: '2026-10-01', location: '北京' }];
    const [job] = deduplicate(existing, newJobs);
    assert.equal(job.applyUrl, 'http://x');
    assert.equal(job.deadline, '2026-10-01');
    assert.equal(job.location, '北京');
  });

  test('已有字段不被新空值覆盖', () => {
    const existing = [{ company: 'A', positions: 'P1', applyUrl: 'http://keep' }];
    const newJobs = [{ company: 'A', positions: 'P1', applyUrl: '' }];
    const [job] = deduplicate(existing, newJobs);
    assert.equal(job.applyUrl, 'http://keep');
  });

  test('空输入返回空数组', () => {
    assert.deepEqual(deduplicate([], []), []);
  });
});

// ══════════════ isSOE 国企判定 ══════════════

describe('isSOE 国企判定', () => {
  test('规则1：明确国资标志词', () => {
    assert.equal(isSOE('某市国资委下属公司', '', ''), true);
    assert.equal(isSOE('省属国企测试', '', ''), true);
  });

  test('规则2：行政区划开头', () => {
    assert.equal(isSOE('北京市政集团', '', ''), true);
    assert.equal(isSOE('山东九羊集团有限公司', '', ''), true);
    // 注意：含排除词（如'城建'=房地产商名单）的即使地名开头也不算国企（行为与旧版一致）
    assert.equal(isSOE('武汉城建集团', '', ''), false);
  });

  test('规则3：gov 域名链接', () => {
    assert.equal(isSOE('测试公司', 'http://xxx.gov.cn/job', ''), true);
    assert.equal(isSOE('测试公司', '', 'http://a.gov.hk/x'), true);
  });

  test('规则4：强信号词', () => {
    assert.equal(isSOE('中石化', '', ''), true);
    assert.equal(isSOE('国家电网', '', ''), true);
    assert.equal(isSOE('贵州中烟', '', ''), true);
    assert.equal(isSOE('北京地铁运营公司', '', ''), true);
  });

  test('规则5：央企前缀+机构词', () => {
    assert.equal(isSOE('中国移动', '', ''), true);
    assert.equal(isSOE('中国银行', '', ''), true);
  });

  test('规则6：弱信号≥2', () => {
    assert.equal(isSOE('中国信托投资', '', ''), true); // 中国+信托
  });

  test('排除词：民企/外企/商业机构不误判', () => {
    assert.equal(isSOE('瑞幸咖啡', '', ''), false);
    assert.equal(isSOE('阿里巴巴', '', ''), false);
    assert.equal(isSOE('字节跳动', '', ''), false);
    assert.equal(isSOE('新东方', '', ''), false);
    assert.equal(isSOE('蜜雪冰城', '', ''), false);
    assert.equal(isSOE('特斯拉', '', ''), false);
    assert.equal(isSOE('恒力重工', '', ''), false);
  });

  test('边界：空公司名返回 false', () => {
    assert.equal(isSOE('', '', ''), false);
    assert.equal(isSOE(null, '', ''), false);
  });

  test('常量数据完整性', () => {
    assert.ok(PROVINCES.includes('北京') && PROVINCES.includes('西藏'));
    assert.ok(CITIES.includes('深圳') && CITIES.includes('哈尔滨'));
    assert.ok(SOE_EXCLUDE.includes('新东方') && SOE_EXCLUDE.includes('瑞幸'));
  });
});

// ══════════════ inferType 类型推断 ══════════════

describe('inferType 类型推断', () => {
  const mk = (recruitmentType, positions = '', announcementUrl = '') =>
    ({ recruitmentType, positions, company: '', announcementUrl });

  test('秋招识别', () => {
    assert.equal(inferType(mk('27秋招')), '秋招');
    assert.equal(inferType(mk('', '', 'https://x.com/27届秋招')), '秋招');
    // 注意：'秋季校园招聘' 不匹配 '秋季招聘'（中间有'校园'），落入校招兜底（行为与旧版一致）
    assert.equal(inferType(mk('', '2026届秋季校园招聘')), '校招');
  });

  test('提前批识别', () => {
    assert.equal(inferType(mk('27提前批')), '提前批');
    assert.equal(inferType(mk('', '提前批招聘')), '提前批');
  });

  test('实习识别', () => {
    assert.equal(inferType(mk('27届实习')), '日常实习');
    assert.equal(inferType(mk('', '暑期实习岗位')), '暑期实习');
    assert.equal(inferType(mk('', '实习生招聘')), '日常实习');
  });

  test('春招识别', () => {
    assert.equal(inferType(mk('26春招')), '春招');
    assert.equal(inferType(mk('', '春季招聘')), '春招');
  });

  test('补录识别', () => {
    assert.equal(inferType(mk('春招补录')), '补录');
    assert.equal(inferType(mk('', '第二批补录')), '补录');
  });

  test('校招兜底', () => {
    assert.equal(inferType(mk('', '校园招聘')), '校招');
    assert.equal(inferType(mk('', '完全无关键词')), '校招');
  });

  test('社招归其他', () => {
    assert.equal(inferType(mk('', '社会招聘')), '其他');
  });
});

// ══════════════ splitPositions 岗位分隔 ══════════════

describe('splitPositions 岗位名智能分隔', () => {
  test('已有顿号不处理', () => {
    assert.equal(splitPositions('工程师、产品经理'), '工程师、产品经理');
  });

  test('空格转顿号', () => {
    assert.equal(splitPositions('Java工程师 产品经理'), 'Java工程师、产品经理');
  });

  test('后缀词后加分隔', () => {
    assert.equal(splitPositions('算法工程师机器学习工程师'), '算法工程师、机器学习工程师');
  });

  test('括号内容不被分隔', () => {
    assert.equal(splitPositions('开发工程师（实习）'), '开发工程师（实习）');
  });

  test('已含顿号的字符串原样返回（不清理，行为与旧版一致）', () => {
    assert.equal(splitPositions('工程师、产品经理、'), '工程师、产品经理、');
    assert.equal(splitPositions('工程师、产品经理'), '工程师、产品经理');
  });

  test('空输入返回原值', () => {
    assert.equal(splitPositions(''), '');
    assert.equal(splitPositions(null), null);
  });
});

// ══════════════ processData 全量清洗 ══════════════

describe('processData 数据清洗流水线', () => {
  const mk = (overrides = {}) => ({
    company: '测试公司', positions: '工程师', location: '北京',
    applyUrl: '', announcementUrl: '', deadline: '',
    publishDate: '2026-08-01', recruitmentType: '', companyType: '',
    industry: '', source: 'test',
    ...overrides,
  });

  test('登录墙过滤', () => {
    const { processed, loginFiltered } = processData([
      mk({ company: '正常公司' }),
      mk({ company: '登录墙公司', location: '登录后可见' }),
    ]);
    assert.equal(processed.length, 1);
    assert.equal(loginFiltered, 1);
  });

  test('过期岗位剔除（deadline < 今天）', () => {
    const { processed, expired } = processData([
      mk({ deadline: '2020-01-01' }),
      mk({ deadline: '2026-12-31' }),
      mk({ deadline: '尽快投递' }),
      mk({ deadline: '' }),
    ]);
    assert.equal(processed.length, 3);
    assert.equal(expired, 1);
  });

  test('companyType 国企 → 国企招聘', () => {
    const { processed } = processData([mk({ companyType: '国企' })]);
    assert.equal(processed[0].recruitmentType, '国企招聘');
  });

  test('isSOE 兜底判定国企', () => {
    const { processed } = processData([mk({ company: '国家电网', applyUrl: 'http://x' })]);
    assert.equal(processed[0].recruitmentType, '国企招聘');
  });

  test('TYPE_MAP 规范化（3月发布不触发时间过滤）', () => {
    const { processed } = processData([mk({ recruitmentType: '26届春招', publishDate: '2026-03-01' })]);
    assert.equal(processed[0].recruitmentType, '春招');
  });

  test('春招在 7 月后发布 → 时间过滤改为秋招（原版行为）', () => {
    const { processed } = processData([mk({ recruitmentType: '26届春招', publishDate: '2026-08-01' })]);
    assert.equal(processed[0].recruitmentType, '秋招');
  });

  test('ID 连续重排 + 按发布时间倒序', () => {
    const { processed } = processData([
      mk({ publishDate: '2026-08-01' }),
      mk({ publishDate: '2026-08-10' }),
    ]);
    assert.equal(processed[0].publishDate, '2026-08-10');
    assert.deepEqual(processed.map(j => j.id), [1, 2]);
  });

  test('岗位名截断（>80 字符）', () => {
    const long = '工程师'.repeat(40); // 120 chars
    const { processed } = processData([mk({ positions: long })]);
    assert.ok(processed[0].positions.length <= 84);
    assert.ok(processed[0].positions.endsWith('...'));
  });

  test('空数组安全', () => {
    const r = processData([]);
    assert.deepEqual(r, { processed: [], loginFiltered: 0, expired: 0 });
  });

  test('TYPE_MAP 关键映射存在', () => {
    assert.equal(TYPE_MAP['26秋招'], '秋招');   // 注意：无裸'秋招'键，靠 TYPE_MAP[rawType] || rawType 兜底
    assert.equal(TYPE_MAP['春招补录'], '补录');
    assert.equal(TYPE_MAP['实习'], '日常实习');
  });
});

// ══════════════ 一致性回归（重要） ══════════════

describe('数据源回归样本', () => {
  test('真实数据样本：Apple 苹果（外企，非国企）', () => {
    assert.equal(isSOE('Apple苹果', 'https://jobs.apple.com/x', ''), false);
  });

  test('真实数据样本：中国电信（国企）', () => {
    assert.equal(isSOE('中国电信', '', ''), true);
  });

  test('真实数据样本：中信建筑设计研究总院（国企）', () => {
    assert.equal(isSOE('中信建筑设计研究总浣', '', ''), true);
  });

  test('splitPositions 真实样本：上汽安吉物流', () => {
    // '类' 不在分隔后缀词表（防误分隔），故保持原样 —— 这是原版设计行为
    assert.equal(splitPositions('物流管理类数字技术类财务管理类'), '物流管理类数字技术类财务管理类');
    // 带明确后缀词的场景才会分隔
    assert.equal(splitPositions('Java工程师产品经理'), 'Java工程师、产品经理');
  });
});
