import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const files = [
  {
    path: 'automation/events/events.json',
    key: 'events',
    heading: '📅 新着イベント',
  },
  {
    path: 'automation/news/news.json',
    key: 'news',
    heading: '📰 新着ニュース',
  },
  {
    path: 'automation/jobs/jobs.json',
    key: 'jobs',
    heading: '💼 求人情報',
  },
];

const compareRef = process.env.LINE_COMPARE_REF || 'HEAD^';
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const dryRun = process.env.LINE_DRY_RUN === '1';

function readPrevious(path) {
  try {
    return JSON.parse(
      execFileSync('git', ['show', `${compareRef}:${path}`], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
  } catch {
    return {};
  }
}

function comparable(item) {
  const copy = { ...item };
  delete copy.updated_at;
  return JSON.stringify(copy);
}

function changedItems(previous, current, key) {
  const oldItems = Array.isArray(previous[key]) ? previous[key] : [];
  const newItems = Array.isArray(current[key]) ? current[key] : [];
  const oldByUrl = new Map(oldItems.map((item) => [item.url, comparable(item)]));

  return newItems.filter((item) => oldByUrl.get(item.url) !== comparable(item));
}

function shorten(text, max = 58) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

const sections = [];
let totalChanges = 0;

for (const file of files) {
  const current = JSON.parse(await readFile(file.path, 'utf8'));
  const previous = readPrevious(file.path);
  const changed = changedItems(previous, current, file.key);

  if (changed.length === 0) continue;

  totalChanges += changed.length;
  const lines = changed.slice(0, 3).map((item) => `・${shorten(item.title)}`);
  if (changed.length > 3) lines.push(`・ほか${changed.length - 3}件`);
  sections.push(`${file.heading}\n${lines.join('\n')}`);
}

if (totalChanges === 0) {
  console.log('LINEへ送る新着情報はありません');
  process.exit(0);
}

const message = [
  '【いずみなび更新】',
  '安城市の新しい地域情報を掲載しました。',
  '',
  sections.join('\n\n'),
  '',
  '詳しくはこちら',
  'https://anjo-izumi.life/',
].join('\n');

if (dryRun) {
  console.log(message);
  process.exit(0);
}

if (!token) {
  throw new Error('LINE_CHANNEL_ACCESS_TOKENが設定されていません');
}

const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ type: 'text', text: message }],
    notificationDisabled: false,
  }),
});

if (!response.ok) {
  const detail = await response.text();
  throw new Error(`LINE投稿に失敗しました (${response.status}): ${detail}`);
}

console.log(`LINEへ新着情報${totalChanges}件を投稿しました`);
