# いずみラジオ 音声生成

`script.txt` に書いた台本を、Azure AI Speech（Nanami・cheerfulスタイル）で音声化し、`latest.mp3` として書き出します。

## 使い方（ローカル）

```
set AZURE_SPEECH_KEY=（Azureのキー1）
node automation/radio/generate-audio.mjs
```

- 第1引数：台本ファイルのパス（省略時は `automation/radio/script.txt`）
- 第2引数：出力先mp3のパス（省略時は `automation/radio/latest.mp3`）

## GitHub Actionsで自動化する場合

リポジトリの Settings → Secrets and variables → Actions で `AZURE_SPEECH_KEY` を登録し、
ワークフローのstepで `env: { AZURE_SPEECH_KEY: ${{ secrets.AZURE_SPEECH_KEY }} }` を渡す
（`automation/line/send-update.mjs` が `LINE_CHANNEL_ACCESS_TOKEN` を使っているのと同じやり方）。

台本（`script.txt`）は、設計図に沿って「AIが台本を作る→管理者が確認する」を経てから
このスクリプトで音声化する想定。台本のAI自動生成はまだ未実装。

## 声を変える場合

`generate-audio.mjs` 冒頭の `VOICE` / `STYLE` を書き換える。
Azureの日本語Neuralボイス・スタイル一覧は公式ドキュメント参照。
