// 安城市サイトなどからテキストを取得する共通処理。
// - タイムアウト付き
// - 失敗したら間隔をあけて再試行
// - "fetch failed" の本当の原因（error.cause）をログに出す

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function describeError(error) {
  const cause = error?.cause;
  if (!cause) return error?.message || String(error);
  const parts = [cause.code, cause.message].filter(Boolean);
  return `${error.message} (原因: ${parts.join(' ') || String(cause)})`;
}

export async function fetchText(url, { userAgent, retries = 4, timeoutMs = 30000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': userAgent || 'Mozilla/5.0 (compatible; izuminavi-bot/1.0; +https://anjo-izumi.life/)',
          'accept-language': 'ja,en;q=0.8',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      console.warn(`[${attempt}/${retries}] 取得失敗: ${url} → ${describeError(error)}`);
      if (attempt < retries) await sleep(5000 * attempt);
    }
  }
  throw new Error(`取得失敗: ${url} → ${describeError(lastError)}`);
}
