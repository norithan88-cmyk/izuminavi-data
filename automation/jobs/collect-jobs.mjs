import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_PATH = fileURLToPath(new URL('./jobs.json', import.meta.url));
const SOURCES = [
  {
    title: '安城市 正規職員',
    type: '職員採用',
    summary: '事務職・技術職・保健師・保育士など',
    url: 'https://www.city.anjo.aichi.jp/shisei/shokuinboshu/',
    active: /職員採用候補者試験[\s\S]{0,100}実施します/,
  },
  {
    title: 'パートタイム職員（会計年度任用職員）',
    type: '随時募集',
    summary: '保育士・児童クラブ職員・保健師など',
    url: 'https://www.city.anjo.aichi.jp/shisei/shokuinboshu/kaikeinendo.html',
    active: /随時募集しています/,
  },
  {
    title: '学校給食補助員',
    type: '随時募集',
    summary: '市内小中学校・給食配膳などの補助',
    url: 'https://www.city.anjo.aichi.jp/manabu/gakko/kyusyoku/documents/documents/gakkokyusyokuhojyoinn.html',
    active: /登録を随時募集しています/,
  },
  {
    title: '公民館職員',
    type: '随時募集',
    summary: '公民館などで働く会計年度任用職員',
    url: 'https://www.city.anjo.aichi.jp/manabu/kominkan/documents/syokuinbosyu.html',
    active: /随時募集しています/,
  },
];

function stripHtml(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function updatedDate(text) {
  const match = text.match(/更新日[:：]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;
  return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
}

async function checkSource(source) {
  const response = await fetch(source.url, {
    headers: { 'user-agent': 'izuminavi-jobs-collector/1.0 (+https://anjo-izumi.life/)' },
  });
  if (!response.ok) throw new Error(`取得失敗: ${response.status} ${source.url}`);
  const text = stripHtml(await response.text());
  if (!source.active.test(text)) return null;
  return {
    title: source.title,
    type: source.type,
    summary: source.summary,
    url: source.url,
    updated_date: updatedDate(text),
    organization: '安城市',
    source: '安城市公式サイト',
  };
}

async function main() {
  const jobs = (await Promise.all(SOURCES.map(checkSource))).filter(Boolean);
  if (jobs.length === 0) throw new Error('募集中の情報を取得できなかったため、既存データを保持します。');
  jobs.sort((a, b) => (b.updated_date || '').localeCompare(a.updated_date || ''));
  const payload = {
    updated_at: new Date().toISOString(),
    source_name: '安城市公式サイト 職員募集',
    job_count: jobs.length,
    jobs,
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`${jobs.length}件の求人・募集情報を更新しました。`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
