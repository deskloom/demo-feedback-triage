// .env を標準機能だけで読み込むための最小ヘルパー。
// dotenv パッケージを使わず、KEY=VALUE 形式の行だけを process.env に補完する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function loadDotEnv(dotEnvPath) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const target = dotEnvPath ?? path.join(here, '.env');
  let text;
  try {
    text = fs.readFileSync(target, 'utf8');
  } catch {
    return false; // .env が無くても落とさない（環境変数直指定の運用を許容）
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
  return true;
}
