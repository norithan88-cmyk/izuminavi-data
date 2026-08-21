import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'https://www.city.anjo.aichi.jp';
const OUTPUT_PATH = fileURLToPath(new URL('./events.json', import.meta.url));
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstDateParts(date = new Date()) {
  const jst = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
  };
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addMonth(year, month, amount) {
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function decodeHtml(text) {
  const entities = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'",
    nbsp: ' ', '#160': ' ',
  };
  return text
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

function parseCalendar(html, year) {
  const rows = [];
  const rowPattern = /<tr[^>]*>\s*<td class="cal_date[^"]*">\s*<p>(\d+)月(\d+)日[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  const linkPattern = /<li>\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/li>/gi;

  for (const rowMatch of html.matchAll(rowPattern)) {
    const month = Number(rowMatch[1]);
    const day = Number(rowMatch[2]);
    const date = isoDate(year, month, day);
    for (const linkMatch of rowMatch[3].matchAll(linkPattern)) {
      const url = new URL(decodeHtml(linkMatch[1]), BASE_URL).href;
      const title = decodeHtml(linkMatch[2]);
      if (title) rows.push({ date, title, url });
    }
  }
  return rows;
}

function mergeEvents(rows, today) {
  const grouped = new Map();
  for (const row of rows) {
    if (row.date < today) continue;
    const key = `${row.title}\n${row.url}`;
    const current = grouped.get(key) || {
      title: row.title,
      url: row.url,
      dates: [],
      category: '安城市公式',
      source: '安城市イベントカレンダー',
    };
    current.dates.push(row.date);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((event) => {
      event.dates.sort();
      return {
        title: event.title,
        url: event.url,
        start_date: event.dates[0],
        end_date: event.dates[event.dates.length - 1],
        category: event.category,
        source: event.source,
      };
    })
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.title.localeCompare(b.title, 'ja'))
    .slice(0, 40);
}

async function fetchMonth(year, month) {
  const sourceUrl = `${BASE_URL}/cgi-bin/event_cal_multi/calendar.cgi?month=${month}&type=2&year=${year}`;
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': 'izuminavi-event-collector/1.0 (+https://anjo-izumi.life/)' },
  });
  if (!response.ok) throw new Error(`取得失敗: ${response.status} ${sourceUrl}`);
  return { sourceUrl, html: await response.text() };
}

async function main() {
  const now = new Date();
  const todayParts = jstDateParts(now);
  const today = isoDate(todayParts.year, todayParts.month, todayParts.day);
  const targets = [addMonth(todayParts.year, todayParts.month, 0), addMonth(todayParts.year, todayParts.month, 1)];
  const pages = await Promise.all(targets.map((target) => fetchMonth(target.year, target.month)));
  const rows = pages.flatMap((page, index) => parseCalendar(page.html, targets[index].year));
  const events = mergeEvents(rows, today);

  if (events.length === 0) throw new Error('イベントを1件も取得できなかったため、既存データを保持します。');

  const payload = {
    updated_at: new Date(now.getTime() + JST_OFFSET_MS).toISOString().replace('Z', '+09:00'),
    source_name: '安城市イベントカレンダー',
    source_urls: pages.map((page) => page.sourceUrl),
    event_count: events.length,
    events,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`${events.length}件のイベントを更新しました。`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
