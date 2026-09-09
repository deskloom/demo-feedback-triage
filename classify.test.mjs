// OpenAI呼び出しをモックした決定的な単体テスト（APIコストなし）。
// 実行: npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  buildMessages,
  parseClassifyResponse,
  classifyFeedbacks,
  formatResults,
} from './classify.mjs';

function fakeClient(jsonText) {
  return {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: jsonText } }],
        }),
      },
    },
  };
}

describe('buildMessages', () => {
  it('全件の本文を含み、件数を明示する', () => {
    const msgs = buildMessages(['不具合A', '要望B']);
    assert.equal(msgs.length, 2);
    assert.match(msgs[1].content, /2件/);
    assert.match(msgs[1].content, /1\. 不具合A/);
    assert.match(msgs[1].content, /2\. 要望B/);
  });
});

describe('parseClassifyResponse', () => {
  it('正常なJSONをパースしてソートする', () => {
    const content = JSON.stringify({
      classifications: [
        { index: 2, category: 'praise' },
        { index: 1, category: 'bug' },
      ],
      summary: '不具合と称賛が混在している。',
    });
    const parsed = parseClassifyResponse(content, 2);
    assert.deepEqual(parsed.classifications, [
      { index: 1, category: 'bug' },
      { index: 2, category: 'praise' },
    ]);
    assert.equal(parsed.summary, '不具合と称賛が混在している。');
  });

  it('コードフェンス付きの応答もパースできる', () => {
    const content =
      '```json\n' +
      JSON.stringify({
        classifications: [{ index: 1, category: 'feature_request' }],
        summary: '要望が1件ある。',
      }) +
      '\n```';
    const parsed = parseClassifyResponse(content, 1);
    assert.equal(parsed.classifications[0].category, 'feature_request');
  });

  it('不正なカテゴリはエラーにする', () => {
    const content = JSON.stringify({
      classifications: [{ index: 1, category: 'unknown' }],
      summary: '要約',
    });
    assert.throws(() => parseClassifyResponse(content, 1), /invalid classification/);
  });

  it('件数不一致はエラーにする', () => {
    const content = JSON.stringify({
      classifications: [{ index: 1, category: 'bug' }],
      summary: '要約',
    });
    assert.throws(() => parseClassifyResponse(content, 2), /length mismatch/);
  });

  it('summary欠落はエラーにする', () => {
    const content = JSON.stringify({
      classifications: [{ index: 1, category: 'bug' }],
      summary: '   ',
    });
    assert.throws(() => parseClassifyResponse(content, 1), /missing summary/);
  });

  it('JSONでない応答はエラーにする', () => {
    assert.throws(() => parseClassifyResponse('これはJSONではない', 1), /not JSON/);
  });
});

describe('classifyFeedbacks (mock)', () => {
  it('モック応答からresults+summaryを組み立てる', async () => {
    const feedbacks = ['画面が真っ白になる', 'ありがとう'];
    const client = fakeClient(
      JSON.stringify({
        classifications: [
          { index: 1, category: 'bug' },
          { index: 2, category: 'praise' },
        ],
        summary: '不具合報告と称賛が1件ずつある。',
      }),
    );
    const out = await classifyFeedbacks(client, feedbacks, { model: 'mock-model' });
    assert.equal(out.results.length, 2);
    assert.equal(out.results[0].text, '画面が真っ白になる');
    assert.equal(out.results[0].category, 'bug');
    assert.equal(out.results[1].category, 'praise');
    assert.match(out.summary, /不具合/);
  });

  it('空配列はエラーにする', async () => {
    const client = fakeClient('{}');
    await assert.rejects(() => classifyFeedbacks(client, []), /non-empty array/);
  });

  it('全カテゴリ値を受け付ける', async () => {
    const feedbacks = ['a', 'b', 'c', 'd'];
    const client = fakeClient(
      JSON.stringify({
        classifications: CATEGORIES.map((category, i) => ({ index: i + 1, category })),
        summary: '4カテゴリが各1件ずつある。',
      }),
    );
    const out = await classifyFeedbacks(client, feedbacks);
    assert.deepEqual(
      out.results.map((r) => r.category),
      CATEGORIES,
    );
  });
});

describe('formatResults', () => {
  it('分類行と要約行を含む出力になる', () => {
    const text = formatResults({
      results: [
        { index: 1, text: '画面が真っ白', category: 'bug' },
        { index: 2, text: 'ありがとう', category: 'praise' },
      ],
      summary: '不具合と称賛が混在。',
    });
    assert.match(text, /\[1\] bug/);
    assert.match(text, /\[2\] praise/);
    assert.match(text, /要約: 不具合と称賛が混在/);
  });
});
