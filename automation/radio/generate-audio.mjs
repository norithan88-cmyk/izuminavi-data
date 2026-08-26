import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REGION = process.env.AZURE_SPEECH_REGION || 'japaneast';
const KEY = process.env.AZURE_SPEECH_KEY;
const VOICE = 'ja-JP-NanamiNeural';
const STYLE = 'cheerful';

const SCRIPT_PATH = process.argv[2] || join(HERE, 'script.txt');
const OUTPUT_PATH = process.argv[3] || join(HERE, 'latest.mp3');

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSsml(text) {
  return `<speak version='1.0' xml:lang='ja-JP' xmlns:mstts='http://www.w3.org/2001/mstts'>
  <voice name='${VOICE}'>
    <mstts:express-as style='${STYLE}'>
      ${escapeXml(text)}
    </mstts:express-as>
  </voice>
</speak>`;
}

async function getToken() {
  const response = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': KEY, 'Content-Length': '0' },
  });
  if (!response.ok) throw new Error(`トークン取得失敗: ${response.status} ${await response.text()}`);
  return response.text();
}

async function synthesize(token, ssml) {
  const response = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      'User-Agent': 'izuminavi-radio/1.0 (+https://anjo-izumi.life/)',
    },
    body: ssml,
  });
  if (!response.ok) throw new Error(`音声生成失敗: ${response.status} ${await response.text()}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  if (!KEY) throw new Error('環境変数 AZURE_SPEECH_KEY が設定されていません。');

  const text = (await readFile(SCRIPT_PATH, 'utf8')).trim();
  if (!text) throw new Error(`台本が空です: ${SCRIPT_PATH}`);

  const token = await getToken();
  const audio = await synthesize(token, buildSsml(text));

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, audio);
  console.log(`音声を生成しました: ${OUTPUT_PATH} (${audio.length} bytes)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
