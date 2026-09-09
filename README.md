# 顧客フィードバック分類・要約デモ

架空の顧客フィードバック（日本語8件）を OpenAI Chat Completions API で
`bug` / `feature_request` / `praise` / `complaint` に分類し、全体傾向を1〜2文で要約する小規模CLIデモです。
実在の企業名・顧客情報は一切使っていません（登場する「そらメモ」は架空アプリ名）。

## 構成

- `feedbacks.json` — 架空フィードバック8件（日本語）
- `classify.mjs` — 分類ロジック本体（プロンプト生成・応答パース・整形）
- `cli.mjs` — CLIエントリ（`feedbacks.json` → OpenAI → コンソール/ファイル出力）
- `env.mjs` — `.env` 読み込みヘルパー（標準機能のみ、`dotenv`不使用）
- `classify.test.mjs` — モック単体テスト（`node:test`、APIコストなし）
- `smoke-test.mjs` — 実APIを1回だけ呼ぶスモークテスト
- `.gitignore` — `.env` / `node_modules/` / `output.txt` を除外

## 必要条件

- Node.js 22
- `.env` に `OPENAI_API_KEY=<キー>` が設定済みであること（任意で `OPENAI_MODEL` も可、既定 `gpt-4o-mini`）

## 実行手順

```bash
npm install
node cli.mjs feedbacks.json output.txt
# 第2引数（出力ファイル）は省略可。省略時はコンソール表示のみ
```

実行例の出力:

```text
=== フィードバック分類結果 ===
[1] bug（不具合報告）: ...
[2] feature_request（要望）: ...
...
要約: ...
```

## 検証方法

### 1. 単体テスト（モック・決定的・APIコストなし）

```bash
npm test
```

- `node:test` + `node:assert/strict` のみ使用（追加依存なし）
- OpenAIクライアントをモックし、以下11件を検証:
  - プロンプト生成（件数・本文の埋め込み）
  - 応答パース（正常系・ソート、コードフェンス対応、異常系5種）
  - `classifyFeedbacks` の組み立て・空入力エラー・全カテゴリ受付
  - 出力フォーマット（分類行・要約行）

### 2. スモークテスト（実APIを1回だけ呼び出し）

```bash
node smoke-test.mjs
```

- 架空フィードバック1件の分類をJSON形式で要求し、空でない応答・正規カテゴリ・非空要約を確認
- 成功時は `SMOKE PASS` と表示

## 実装の要点

- 依存は `openai` 公式パッケージのみ。`.env` 読み込みも自前実装し依存を最小化
- `response_format: { type: 'json_object' }` でJSON応答を強制し、コードフェンス混入時も抜き出してパース
- 件数不一致・不正カテゴリ・要約欠落は例外にして fail-fast
- APIキーの値はログ出力しない（有無のみ真偽値で扱う）

## 検証済み結果（2026-09-09）

- `npm test`: 11件中11件成功
- `node smoke-test.mjs`: SMOKE PASS（model: gpt-4o-mini、category: bug）
- `node cli.mjs feedbacks.json output.txt`: 8件を分類・要約して正常終了
