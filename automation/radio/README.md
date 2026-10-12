# いずみラジオ：曜日別・約10分

月：暮らしの工夫 / 火：食べ物・台所 / 水：地元の歴史 / 木：科学・自然 / 金：週末 / 土：懐かしい暮らし＋創作小話 / 日：季節・趣味。

`generate-daily-script.mjs` は Gemini と Google検索で資料を集め、資料に沿って3〜5話題、追加コーナー込み約3,000文字（上限3,300文字）を編集します。約10分は目安で、声・話速により変わります。直近30回の話題をプロンプトで除外し、同名の再使用も検査します。言い換えによる類似話題を完全には検出できません。

土曜には `saturday-stories.json` の創作小話30本を2026年10月17日から週替わりで1本追加します。実話としては紹介しません。30週で一巡します。

## 実行

環境変数 `GEMINI_API_KEY` を設定した上で：

```sh
node automation/radio/generate-daily-script.mjs automation/radio/daily-script.txt
node automation/radio/generate-audio.mjs automation/radio/daily-script.txt automation/radio/daily.mp3
```

Node.js 22、ffmpeg が必要。台本モデルは `GEMINI_SCRIPT_MODEL`（標準 `gemini-3.8-flash`）で変更可。音声はMicrosoft AzureのNanami固定。GEMINI_API_KEYが存在しても音声には使用しません。台本の検索・編集に1日2回のGemini呼び出しと検索利用が加わります。

音声は約900文字ごとに生成し、全部成功したときだけMP3を結合・保存。途中失敗では公開音声を上書きしません。

- `daily-sources.json`：採用話題・本文・検索資料・検索出典・生成モード。
- `broadcast-history.json`：直近30回の話題。音声成功後、台本・音声と一緒にコミット。
- `generate-basic-script.mjs`：APIエラー・出典不足・長さ不正時に使う従来版。短い地域情報版に戻り、Actionsにwarningを残します。

出典URLが取得資料にあることを検査しますが、全主張の正確性を保証するものではありません。元資料と生成台本は `daily-sources.json` で確認できます。Google検索のgroundingMetadataも保存します。

日次実行は既存の `update-events.yml`（日本時間6:15）に統合。手動実行用は `update-radio.yml` でラジオだけを更新します。こちらはLINE送信を行いません。生成済みファイルのコミットでは再起動しません。

`listener-notes.json` は運営者・住民の提供話。出典と掲載期間を記録し、放送履歴に記録済みの話は翌日以降繰り返しません。今回のフェルナの価格の話は、運営者の観察として収録します。

## 費用を抑える設定
コード変更による音声の自動再生成を廃止。通常は朝の定時処理で1日1回、手動実行は必要時のみ。土曜の小話・お便り・告知も10分の文字数予算に含めます。実際の時間は話速に依存します。税込月1,000円は運用目標であり、課金上限の強制設定ではありません。
Google検索付き台本生成には利用可能なAPI課金設定が必要です。今回、支払い設定は変更していません。利用できなければ短い従来版になります。
