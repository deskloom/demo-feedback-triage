// 本物のOpenAI APIを1回だけ呼ぶスモークテスト。
// 実行: node smoke-test.mjs
// 成功条件: APIから空でない応答テキストが返ること。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { loadDotEnv } from './env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  loadDotEnv(path.join(here, '.env'));
  // 値は出さず有無のみ確認
  const keyLoaded =
    typeof process.env.OPENAI_API_KEY === 'string' &&
    process.env.OPENAI_API_KEY.length > 0;
  console.log('key loaded:', keyLoaded);
  if (!keyLoaded) {
    console.error('SMOKE FAIL: OPENAI_API_KEY が未設定');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  console.log('model:', model);

  // コスト最小のため1件・短文・JSON1件分類だけを要求する
  const res = await client.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'あなたは顧客フィードバックの分類アシスタントです。必ずJSONだけで回答します。',
      },
      {
        role: 'user',
        content:
          '次の1件を bug / feature_request / praise / complaint のいずれかに分類し、' +
          '{"classifications": [{"index": 1, "category": "..."}], "summary": "要約"} 形式のJSONだけで答えてください。\n' +
          '1. 架空アプリ「そらメモ」の起動直後に画面が真っ白になります。',
      },
    ],
  });

  const content = res?.choices?.[0]?.message?.content ?? '';
  console.log('response chars:', content.length);
  if (content.trim() === '') {
    console.error('SMOKE FAIL: 空の応答');
    process.exit(1);
  }
  const parsed = JSON.parse(content);
  const category = parsed?.classifications?.[0]?.category;
  const ok = ['bug', 'feature_request', 'praise', 'complaint'].includes(category);
  console.log('category:', category);
  console.log('summary:', parsed?.summary ?? '(none)');
  if (!ok || typeof parsed?.summary !== 'string' || parsed.summary.trim() === '') {
    console.error('SMOKE FAIL: 形式不正');
    process.exit(1);
  }
  console.log('SMOKE PASS: 実API応答を確認しました');
}

main().catch((err) => {
  console.error('SMOKE FAIL:', err?.message ?? err);
  process.exit(1);
});
