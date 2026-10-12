import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REGION = process.env.AZURE_SPEECH_REGION || 'japaneast';
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const AZURE_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_VOICE = 'ja-JP-NanamiNeural';
const GEMINI_VOICE = process.env.GEMINI_TTS_VOICE || 'Aoede';
const GEMINI_STYLE = 'Warm, clear, friendly community radio presenter; gently upbeat and unhurried Japanese narration.';

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

function buildAzureSsml(text) {
  return `<speak version='1.0' xml:lang='ja-JP' xmlns:mstts='http://www.w3.org/2001/mstts'>
  <voice name='${AZURE_VOICE}'>
    <mstts:express-as style='cheerful'>
      ${escapeXml(text)}
    </mstts:express-as>
  </voice>
</speak>`;
}

async function getAzureToken() {
  const response = await fetch(`https://${REGION}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`, {
    method: 'POST', signal: AbortSignal.timeout(180000),
    headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY, 'Content-Length': '0' },
  });
  if (!response.ok) throw new Error(`トークン取得失敗: ${response.status} ${await response.text()}`);
  return response.text();
}

async function synthesizeWithAzure(token, ssml) {
  const response = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST', signal: AbortSignal.timeout(180000),
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

async function synthesizeWithGemini(text) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', signal: AbortSignal.timeout(180000),
    headers: {
      'x-goog-api-key': GEMINI_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-3.8-flash-tts',
      input: [{
        type: 'user_input',
        content: [{
          type: 'text',
          text,
          annotations: [{ type: 'speech_metadata', style: GEMINI_STYLE }],
        }],
      }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: GEMINI_VOICE }] },
      store: false,
    }),
  });
  const interaction = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini音声生成失敗: ${response.status} ${JSON.stringify(interaction)}`);
  }

  const audioBlock = (interaction.steps || [])
    .flatMap((step) => step.content || [])
    .findLast((content) => content.type === 'audio' && content.data);
  const audioData = audioBlock?.data || interaction.output_audio?.data;
  if (!audioData) throw new Error('Gemini APIの応答に音声データがありません。');
  return Buffer.from(audioData, 'base64');
}

function convertWavToMp3(wav) {
  const result = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-vn',
    '-codec:a', 'libmp3lame', '-b:a', '128k', '-ac', '1', '-ar', '24000',
    '-f', 'mp3', 'pipe:1',
  ], { input: wav, maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw new Error(`ffmpegを起動できません: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`WAVからMP3への変換に失敗しました: ${result.stderr.toString('utf8')}`);
  }
  return result.stdout;
}

async function main() {
  if (!GEMINI_KEY && !AZURE_KEY) {
    throw new Error('環境変数 GEMINI_API_KEY または AZURE_SPEECH_KEY を設定してください。');
  }

  const text = (await readFile(SCRIPT_PATH, 'utf8')).trim();
  if (!text) throw new Error(`台本が空です: ${SCRIPT_PATH}`);

  // 長い番組を段落単位（最大約900文字）で音声化。全区間成功後にだけ公開ファイルを置換。
  const chunks = [];
  let current = '';
  for (const paragraph of text.split(/\n+/).filter(Boolean)) {
    for (let offset = 0; offset < paragraph.length; offset += 900) {
      const part = paragraph.slice(offset, offset + 900);
      if (current && current.length + part.length > 900) { chunks.push(current); current = ''; }
      current += (current ? '\n' : '') + part;
    }
  }
  if (current) chunks.push(current);
  const temp = await mkdtemp(join(tmpdir(), 'izumi-radio-'));
  let audio;
  const provider = GEMINI_KEY ? `Gemini (${GEMINI_VOICE})` : `Azure Speech (${AZURE_VOICE})`;
  try {
    const token = GEMINI_KEY ? null : await getAzureToken();
    for (let i = 0; i < chunks.length; i++) {
      const part = GEMINI_KEY ? convertWavToMp3(await synthesizeWithGemini(chunks[i])) : await synthesizeWithAzure(token, buildAzureSsml(chunks[i]));
      if (!part.length) throw new Error('生成音声が空です');
      await writeFile(join(temp, `part-${i}.mp3`), part);
      console.log(`音声 ${i + 1}/${chunks.length} を生成`);
    }
    await writeFile(join(temp, 'list.txt'), chunks.map((_, i) => `file 'part-${i}.mp3'`).join('\n'));
    const combined = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(temp, 'list.txt'), '-codec:a', 'libmp3lame', '-b:a', '128k', '-ac', '1', '-ar', '24000', '-f', 'mp3', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
    if (combined.error || combined.status !== 0) throw new Error('音声の結合に失敗しました');
    audio = combined.stdout;
  } finally { await rm(temp, { recursive: true, force: true }); }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, audio);
  console.log(`${provider}で音声を生成しました: ${OUTPUT_PATH} (${audio.length} bytes)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

