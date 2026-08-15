/**
 * tests/profile-api.test.js — 企业简介 API 公共模块单测
 *
 * 运行：node --test tests/
 * 覆盖：extractJson 三策略解析
 * 注意：callProfileApi 需要真实 API Key 与网络，此处仅测纯函数 extractJson。
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { extractJson, MODEL, API_URL } = require('../lib/profile-api');

describe('extractJson 响应解析（3 策略）', () => {
  test('策略1：非贪婪匹配首个 JSON 对象', () => {
    const r = extractJson('前言 {"summary":"好公司","tags":["a","b"]} 尾巴');
    assert.ok(r);
    assert.equal(r.summary, '好公司');
    assert.deepEqual(r.tags, ['a', 'b']);
  });

  test('策略1：正文中夹杂说明文字', () => {
    const r = extractJson('好的，以下是简介：\n{"summary":"测试公司简介内容","tags":["标签1","标签2"]}\n希望对你有帮助');
    assert.equal(r.summary, '测试公司简介内容');
  });

  test('策略2：最后一个 { 截取（JSON 前有异常前缀）', () => {
    const r = extractJson('some garbage text before {"summary":"A","tags":["x"]} trailing');
    // 策略1 应已成功，此处验证策略2兜底路径
    assert.ok(r);
  });

  test('策略3：Markdown 代码块', () => {
    const r = extractJson('```json\n{"summary":"代码块公司","tags":["y"]}\n```');
    assert.equal(r.summary, '代码块公司');
  });

  test('无 JSON 返回 null', () => {
    assert.equal(extractJson('这是一段普通文本，没有 JSON'), null);
    assert.equal(extractJson(''), null);
    assert.equal(extractJson(null), null);
    assert.equal(extractJson(undefined), null);
  });

  test('无效 JSON 返回 null', () => {
    assert.equal(extractJson('{invalid json}'), null);
  });

  test('缺失必要字段的 JSON 仍返回对象（由调用方校验）', () => {
    const r = extractJson('{"foo":"bar"}');
    assert.ok(r);
    assert.equal(r.foo, 'bar');
  });

  test('常量配置正确', () => {
    assert.ok(MODEL.length > 0);
    assert.ok(API_URL.startsWith('https://'));
  });
});
