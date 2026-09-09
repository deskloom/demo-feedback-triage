// 顧客フィードバック分類・要約のコアロジック。
// OpenAI クライアントの chat.completions.create を呼ぶ部分だけを外から注入できる
// 形にしてあるため、単体テストではモッククライアントを渡せる。

export const CATEGORIES = ['bug', 'feature_request', 'praise', 'complaint'];

export const CATEGORY_LABELS_JA = {
  bug: '不具合報告',
  feature_request: '要望',
  praise: '称賛',
  complaint: '苦情・その他不満',
};

export function buildMessages(feedbacks) {
  const numbered = feedbacks.map((t, i) => `${i + 1}. ${t}`).join('\n');
  return [
    {
      role: 'system',
      content:
        'あなたは顧客フィードバックの分類アシスタントです。' +
        '各フィードバックを bug / feature_request / praise / complaint のいずれか1つに分類します。' +
        '判定基準: bug=動作不良・誤表示など技術的な不具合の報告、' +
        'feature_request=新機能や改善の提案・要望、praise=感謝・満足・好意的な評価、' +
        'complaint=それ以外の不満（遅い・迷惑・対応への不満など）。' +
        '必ずJSONオブジェクトのみで回答します。',
    },
    {
      role: 'user',
      content:
        `以下の${feedbacks.length}件のフィードバックを分類し、全体の傾向を1〜2文で要約してください。\n` +
        '回答は次のJSON形式だけにしてください:\n' +
        '{"classifications": [{"index": 1, "category": "bug"}, ...], "summary": "全体傾向の要約（日本語1〜2文）"}\n\n' +
        '--- フィードバック ---\n' +
        numbered,
    },
  ];
}

// モデルの生テキストからJSONを取り出して検証する。
// コードブロック（```json ... ```）で包まれていても取り出せるようにする。
export function parseClassifyResponse(content, expectedCount) {
  if (typeof content !== 'string' || content.trim() === '') {
    throw new Error('empty response from model');
  }
  let jsonText = content.trim();
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonText = fence[1].trim();
  // 先頭・末尾の余計な文章が混ざる場合に { ... } 部分だけ抜き出す
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('response is not JSON');
  }
  jsonText = jsonText.slice(start, end + 1);

  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('response is not valid JSON');
  }

  if (!Array.isArray(parsed.classifications)) {
    throw new Error('missing classifications array');
  }
  if (parsed.classifications.length !== expectedCount) {
    throw new Error(
      `classifications length mismatch: expected ${expectedCount}, got ${parsed.classifications.length}`,
    );
  }
  for (const item of parsed.classifications) {
    if (typeof item.index !== 'number' || !CATEGORIES.includes(item.category)) {
      throw new Error(`invalid classification entry: ${JSON.stringify(item)}`);
    }
  }
  if (typeof parsed.summary !== 'string' || parsed.summary.trim() === '') {
    throw new Error('missing summary');
  }
  const sorted = [...parsed.classifications].sort((a, b) => a.index - b.index);
  return { classifications: sorted, summary: parsed.summary.trim() };
}

export async function classifyFeedbacks(client, feedbacks, options = {}) {
  if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
    throw new Error('feedbacks must be a non-empty array');
  }
  const {
    model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens = 800,
    temperature = 0,
  } = options;

  const messages = buildMessages(feedbacks);
  const res = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });
  const content = res?.choices?.[0]?.message?.content;
  const parsed = parseClassifyResponse(content, feedbacks.length);
  const results = parsed.classifications.map((c) => ({
    index: c.index,
    text: feedbacks[c.index - 1],
    category: c.category,
  }));
  return { results, summary: parsed.summary };
}

export function formatResults(classified) {
  const lines = ['=== フィードバック分類結果 ==='];
  for (const r of classified.results) {
    const label = CATEGORY_LABELS_JA[r.category] ?? r.category;
    lines.push(`[${r.index}] ${r.category}（${label}）: ${r.text}`);
  }
  lines.push('');
  lines.push(`要約: ${classified.summary}`);
  return lines.join('\n');
}
