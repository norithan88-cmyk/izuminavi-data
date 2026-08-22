import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_PATH = fileURLToPath(new URL('./news.json', import.meta.url));
const SOURCES = [
  { label: 'くらし', url: 'https://www.city.anjo.aichi.jp/kurasu/shinchaku.xml' },
  { label: '学び', url: 'https://www.city.anjo.aichi.jp/manabu/shinchaku.xml' },
  { label: '文化・スポーツ', url: 'https://www.city.anjo.aichi.jp/tanoshimu/shinchaku.xml' },
  { label: '市政', url: 'https://www.city.anjo.aichi.jp/shisei/shinchaku.xml' },
];
const SKIP_TITLES = /^(概要・報告書|イベント等のお知らせ|メンテナンス情報|園からのお知らせ)$|公示送達/;

function decodeHtml(text) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' ', '#160': ' ' };
  return text
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, name) => {
      const key = name.toLowerCase();
      if (entities[key] !== undefined) return entities[key];
      if (key.startsWith('#x')) return String.fromCodePoint(parseInt(key.slice(2), 16));
      if (key.startsWith('#')) return String.fromCodePoint(parseInt(key.slice(1), 10));
      return all;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function field(block, tag) {
  const escaped = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function parseRss(xml, source) {
  const items = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = field(block, 'title');
    const url = field(block, 'link');
    const description = field(block, 'description');
    const date = field(block, 'dc:date');
    if (!title) continue;
    if (!url) continue;
    if (!date) continue;
    items.push({
      title,
      url,
      summary: description,
      category: source.label,
      published_at: date,
      source: '安城市公式サイト',
    });
  }
  return items;
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: { 'user-agent': 'izuminavi-news-collector/1.0 (+https://anjo-izumi.life/)' },
  });
  if (!response.ok) throw new Error(`取得失敗: ${response.status} ${source.url}`);
  return parseRss(await response.text(), source);
}

async function main() {
  const collected = (await Promise.all(SOURCES.map(fetchSource))).flat();
  const seen = new Set();
  const news = collected
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .filter((item) => {
      if (SKIP_TITLES.test(item.title)) return false;
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, 40);

  if (news.length === 0) throw new Error('新着情報を1件も取得できなかったため、既存データを保持します。');

  const payload = {
    updated_at: new Date().toISOString(),
    source_name: '安城市公式サイト 新着情報RSS',
    source_urls: SOURCES.map((source) => source.url),
    news_count: news.length,
    news,
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`${news.length}件の地域ニュースを更新しました。`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
