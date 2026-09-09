// CLIエントリ: feedbacks.json を読み、OpenAIで分類・要約して表示する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { loadDotEnv } from './env.mjs';
import { classifyFeedbacks, formatResults } from './classify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function loadFeedbacks(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  const list = Array.isArray(data) ? data : data.feedbacks;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`no feedbacks found in ${file}`);
  }
  return list.map(String);
}

async function main() {
  loadDotEnv(path.join(here, '.env'));
  // キーの値自体は出力しない。有無のみ真偽値で確認できる形にする。
  const keyLoaded =
    typeof process.env.OPENAI_API_KEY === 'string' &&
    process.env.OPENAI_API_KEY.length > 0;
  if (!keyLoaded) {
    console.error('ERROR: OPENAI_API_KEY が設定されていません（.env を確認してください）。');
    process.exit(1);
  }

  const inputFile = process.argv[2] ?? path.join(here, 'feedbacks.json');
  const outFile = process.argv[3] ?? null;
  const feedbacks = loadFeedbacks(inputFile);

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const classified = await classifyFeedbacks(client, feedbacks);
  const text = formatResults(classified);
  console.log(text);

  if (outFile) {
    fs.writeFileSync(outFile, text + '\n', 'utf8');
    console.log(`\n結果を ${outFile} に保存しました。`);
  }
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
