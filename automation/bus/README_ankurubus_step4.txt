あんくるバス便利帳 Googleマップ連携 第4段階
================================================

目的
----
バス停が移設されたとき、WordPressの長いコードを直さず、
ankurubus_stop_coordinates.json の座標だけで更新できるようにします。

同梱ファイル
------------
1. ankurubus_googlemaps_step4_maintainable.html
   WordPressの「カスタムHTML」ブロックへ貼るコードです。

2. ankurubus_stop_coordinates.json
   170停留所の座標データです。今後の位置変更は主にこのファイルを直します。


導入手順
--------
1. ankurubus_stop_coordinates.json を次の場所へコピーします。

   C:\Users\norit\OneDrive\デスクトップ\AIの作業場\いずみなび\automation\bus\ankurubus_stop_coordinates.json

2. GitHubへ同期・反映します。公開後、次のURLでJSONが見られれば準備完了です。

   https://raw.githubusercontent.com/norithan88-cmyk/izuminavi-data/main/automation/bus/ankurubus_stop_coordinates.json

3. WordPressの「あんくるバス便利帳」編集画面を開きます。

4. 第3段階で追加したGoogleマップ用カスタムHTMLだけを、
   ankurubus_googlemaps_step4_maintainable.html の全文に貼り替えます。

   注意：元からある検索・時刻表のメインコードは消さないでください。

5. 更新して、検索結果の「乗車」「降車」ボタンを確認します。

JSONがまだGitHubに無い場合や、一時的に取得できない場合も、
HTML内蔵の170地点へ自動的に戻るため、ボタンはそのまま使用できます。


通常の位置を少し動かす場合
--------------------------
たとえば「和泉丈山苑」の代表地点を変更するときは、stops 内の該当箇所の
lat（緯度）と lng（経度）だけを変更します。

  "和泉丈山苑": {
    "lat": 34.923304,
    "lng": 137.047308,
    "official_name": "和泉丈山苑",
    "position_type": "official_representative",
    "source_url": "https://ankuru-bus.com/..."
  }

保存してGitHubへ反映すると、WordPressを貼り直さなくても新しい位置を読み込みます。


方向別の乗り場を登録する場合
----------------------------
direction_points に次の形式で追加します。

キーの形式：路線名|進行方向|停留所名

例：

  "南部線|安城更生病院→碧南市民病院|和泉丈山苑": {
    "lat": 34.923304,
    "lng": 137.047308,
    "status": "verified",
    "note": "現地確認済み"
  }

ここに登録した方向別座標は、stops の代表地点より優先されます。
未確認の方向別地点は追加せず、確認できたものから登録してください。


臨時移設を登録する場合
----------------------
  "南部線|安城更生病院→碧南市民病院|和泉丈山苑": {
    "lat": 34.923500,
    "lng": 137.047600,
    "status": "temporary",
    "valid_from": "2026-09-10",
    "valid_until": "2026-10-31",
    "note": "工事のため約30m南へ臨時移設"
  }

status が temporary の間は、検索結果にも「臨時停留所」と注記が出ます。
valid_from より前、または valid_until より後はその臨時座標を使わず、
自動的に通常の代表地点へ戻ります。


運用上の注意
------------
- Googleマップの赤いピンだけで「上り・下り」と判断しないでください。
- 方向別座標は、現地・公式案内・停留所標識で確認できたものを登録します。
- 緯度・経度は半角数字で入力します。
- JSONでは最後の項目の後ろに余分なカンマを付けないでください。
- 更新後は実際の検索結果から、該当する乗車・降車ボタンを1回確認してください。

