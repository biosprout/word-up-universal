# WORD UP! 教材データ仕様（CONTENT_SPEC）

このファイルを読めば、アプリ本体（index.html）を読まなくても単語や「質問に答える」の問題を追加できる。
教材データの source of truth は `data/` 配下の JSON だけ。

WORD UP! の教材は2種類ある。

- **単語（レベル別）**: 中1〜準1級の英単語。グループごとに [英語, 日本語] のペア
- **質問に答える（talk）**: 英語の質問に返答する練習。4択（pick）/ 穴埋め（fill）/ ならべる（build）

## 1. ファイル一覧

| ファイル | 種類 | 役割 |
|---|---|---|
| `data/index.json` | manifest | レベル一覧と件数。`talk.json` はここに載せず、アプリが固定名で読む |
| `data/m1.json` | 単語 | 中1 |
| `data/m2.json` | 単語 | 中2 |
| `data/m3.json` | 単語 | 中3・高校受験 |
| `data/p2.json` | 単語 | 準2級レベル |
| `data/e2.json` | 単語 | 2級レベル |
| `data/p1.json` | 単語 | 準1級レベル |
| `data/talk.json` | talk | 質問に答える |
| `scripts/validate-content.mjs` | | データ検証（Node.js、追加パッケージ不要） |
| `scripts/format-content.mjs` | | データ整形（同上） |
| `sw.js` | | Service Worker。オフライン用にデータをキャッシュする |


## source of truth

**教材の唯一の source of truth は `data/*.json` である。** 単語も talk 問題も JSON を直接編集し、`format-content.mjs` → `validate-content.mjs` を通して commit する。

引き継ぎ資料にある `talk_data.js`（と `patch_talk.py` の変換）は、`data/talk.json` を最初に生成したときの元原稿で、今後の source of truth ではない。repo には含めない。talk 問題を直すときは `data/talk.json` を直接編集し、talk_data.js は更新しない（JSON と元原稿を別々に更新する運用はしない）。作問の方針（第4節）は talk_data.js の先頭コメントから CONTENT_SPEC に転記済みなので、元原稿を参照する必要はない。

## 2. manifest（data/index.json）の schema

```json
{
  "version": 3,
  "contentVersion": "snapshot-fff3529",
  "levels": [
    {"id":"m1","name":"中1","file":"m1.json","count":899,"groups":28},
    {"id":"m2","name":"中2","file":"m2.json","count":1135,"groups":24},
    {"id":"m3","name":"中3・高校受験","file":"m3.json","count":1285,"groups":21},
    {"id":"p2","name":"準2級レベル","file":"p2.json","count":1418,"groups":23},
    {"id":"e2","name":"2級レベル","file":"e2.json","count":1656,"groups":25},
    {"id":"p1","name":"準1級レベル","file":"p1.json","count":1579,"groups":23}
  ],
  "total": 7972
}
```

| property | 必須 | 意味 |
|---|---|---|
| `version` | 必須 | `3` 固定 |
| `contentVersion` | 必須 | 教材の版 ID（文字列、空にしない）。batch 取込で `batch_id` に更新される。アプリの教材更新バーがこの値の変化を検出する |
| `levels[].id` | 必須 | レベル ID。`all` と `my` はアプリが予約している |
| `levels[].name` | 必須 | 表示名。アプリのレベル選択に出る |
| `levels[].file` | 必須 | `data/` からの相対ファイル名 |
| `levels[].count` | 必須 | そのファイルの単語数（全グループの `w` の合計） |
| `levels[].groups` | 必須 | そのファイルのグループ数 |
| `total` | 必須 | count の合計。ホームの見出し「〇〇語」に表示される |

`levels` の順番がアプリのレベル選択の順番になる。

## 3. 単語ファイルの schema

```json
{
  "id": "m1",
  "name": "中1",
  "groups": [
    {
      "id": "g_greet",
      "name": "あいさつ・基本",
      "w": [
        ["hello","こんにちは"],
        ["hi","やあ"]
      ]
    }
  ]
}
```

ファイルの `id` と `name` は manifest の同じ level と一致させる。

| property | 型 | 必須 | 意味 |
|---|---|---|---|
| `groups[].id` | string | 必須 | グループ ID。**全レベルを通して一意**。`my` で始めない（マイ単語帳 `my1` `my2` と衝突する） |
| `groups[].name` | string | 必須 | グループ名（画面に出る） |
| `groups[].w` | array | 必須 | 単語ペアの配列。1件以上 |
| `w[n]` | [string, string] | 必須 | `[英語, 日本語]`。どちらも空にしない |

### 単語 ID と学習記録

単語 ID はデータには書かず、アプリが `グループID + "|" + 英語の小文字` で作る（例 `g_greet|hello`）。学習記録（正解数・誤答数・学習済み・最終日）はこの ID をキーに保存される。したがって:

- 同じグループ内で同じ英語（大文字小文字を区別しない）を2回入れない
- 同じ英語が別のグループや別のレベルにあるのは問題ない（それぞれ別の単語として扱われる。既存データにもある）
- 公開後にグループ ID や英語のつづりを変えると、その単語の記録が消える。日本語訳は変えても記録に影響しない

ペアの並び順はグループ内の表示順になる。

## 4. 質問に答える（data/talk.json）の schema

```json
{
  "id": "talk",
  "name": "質問に答える",
  "items": [
    {"id":"p01","lv":"e1","t":"do","mode":"pick","q":"Do you like music?","ch":["Yes, I do.","Yes, I am.","At home.","Every day."],"a":0,"ex":"Do you …? には do を使って答える。No なら No, I don't."},
    {"id":"f01","lv":"e1","t":"do","mode":"fill","q":"Do you play any sports?","s":"Yes, I ___. I play tennis.","ans":["do"],"ex":"Do you …? には do で答える。そのあと種目を足すと会話が続く。"},
    {"id":"b01","lv":"e1","t":"what","mode":"build","q":"What do you usually do after school?","bank":["I","usually","play","soccer","after","school","at","home","am","do"],"ans":[["I","usually","play","soccer","after","school"],["I","play","soccer","after","school"]],"ex":"What do you do …? には、「何をするか」を動詞を使って答える。at / home / am / do は使わない。"}
  ]
}
```

### 共通 property（すべて必須）

| property | 型 | 意味 |
|---|---|---|
| `id` | string | 問題 ID。一意。学習記録 `tstat[id]` のキー |
| `lv` | string | 難易度。`e1` / `e2` / `e3` |
| `t` | string | 質問の型。`do` `be` `can` `what` `where` `when` `who` `which` `how` `howoften` `howmany` `howold` `why` `whattime` `past` `prog` `future` `howlong` `wouldlike` `shall` `must` `perfect` `passive` `opinion` `whose` `compare` `relative`。新しい型を使うときは validator の `TALK_TYPES` にも足す |
| `mode` | string | `pick` / `fill` / `build` |
| `q` | string | 質問文（英語） |
| `ex` | string | 解説（日本語） |

### mode ごとの property

| mode | property | 型 | 意味 |
|---|---|---|---|
| pick | `ch` | string[4] | 返答の選択肢。**正解を先頭に書く**（表示時にアプリがシャッフルする）。重複なし |
| pick | `a` | integer | 正答 index。**0 始まり**。慣例として `0` |
| fill | `s` | string | 返答文。空欄は `___`（下線3つ）をちょうど1か所 |
| fill | `ans` | string[] | 空欄に入る語。複数書けばどれでも正解（大文字小文字と前後空白は無視して比較） |
| build | `bank` | string[] | 並べる語の候補。正解に使わないダミー語も入れる。同じ語を2回使う文では bank にも2回入れる（重複可） |
| build | `ans` | string[][] | 正解の語順。複数の並びを認めるときは複数書く。各語は bank に含まれていること（回数も） |

作問の方針（元原稿 `talk_data.js` の先頭コメントより）: 誤答も自然な英語にして質問の型だけを違える。Yes/No を省いた自然な返答も正解にする（`I have tried it twice.` は正解、`Twice.` は不正解）。穴埋めで隠すのは文の骨組みが要求する語（be 動詞・助動詞・to・than・冠詞）だけにする。

### talk の ID 命名規則

- pick: `p` + 2桁番号（`p01`）
- fill: `f` + 2桁番号（`f01`）、または build の返答文から派生した穴埋めは `b11f` `b11f1` `b11f2`
- build: `b` + 2桁番号（`b01`）

`b11` `b11f1` `b11f2` のように同じ元文から作った問題は、アプリが1回の出題で1問までにまとめる（ID から `f…` を除いた部分で判定）。この仕組みを保つため、派生問題の ID は元の build の ID に `f` を付けた形にする。

## 5. 文字コードと JSON 形式

- UTF-8（BOM なし）、LF。日本語はそのまま書き、`\uXXXX` に escape しない
- 単語ファイルはグループを複数行にし、単語ペア1件を1行にする。talk.json と index.json は1件を1行にする（`node scripts/format-content.mjs` が整える）
- 制御文字を入れない

## 6. 追加する手順

### 単語を足す

1. 該当レベルの `data/<level>.json` で、既存グループの `w` に足すか、新しいグループ（一意な `id`）を末尾に追加する
2. `data/index.json` の該当 `count`（と新グループなら `groups`）、`total` を増やす
3. `node scripts/format-content.mjs` → `node scripts/validate-content.mjs` で `✓ OK`
4. ローカルサーバで確認（第8節）。ホームの語数表示が `total` と一致することも見る
5. 必要なら index.html の `APP_VER` を上げる。commit する。push は田中が行う

### talk 問題を足す

1. `data/talk.json` の `items` 末尾に足す（manifest の件数更新は不要）
2. 以下は単語と同じ

## 7. validator と formatter

```
node scripts/validate-content.mjs
node scripts/format-content.mjs
node scripts/format-content.mjs --check
```

Node.js 18 以上、npm install 不要。validator は JSON / UTF-8 / manifest の参照 / count と groups と total / 必須 property と型 / グループ ID の一意性と予約語 / 同一グループ内の英語重複（word ID の衝突） / 空文字と制御文字 / talk の mode ごとの schema、ID の形、選択肢4件と重複、正答 index、空欄の数、bank と ans の整合 / 未参照 JSON や `.DS_Store` を見る。

## 8. ローカルで動かす

```
cd word-up-universal
python3 -m http.server 8000
# http://localhost:8000/
```

file:// では fetch が動かないので、必ずサーバ経由で開く。

## contentVersion と教材更新バー

`data/index.json` の `contentVersion` は教材の版 ID。アプリは起動時に読んだ値を覚えておき、window の focus / タブが visible に戻ったとき / visible 中は 30 分ごと（同一タブでは最低 60 秒間隔）に `data/index.json` を `cache: "no-store"` で読み直す。値が変わっていれば、学習を止めない小さなバー「🆕 新しい問題があります　[更新] [あとで]」を出す。

- 値は不透明な文字列。大小比較はせず、等しいかどうかだけを見る
- 初期値は `snapshot-<HEAD 短縮 hash>`。batch 取込時は importer がその batch の `batch_id` に更新する（WORD で talk.json だけを更新した場合も更新する）
- 手で教材を直したときも、必ず `contentVersion` を新しい値（例: `manual-YYYYMMDD-a`）に変える。変えないと開きっぱなしの端末に更新が伝わらない
- `更新` は reload、`あとで` は同じタブ・同じ version では再表示しない（別の version なら再表示する）。バーを出すだけでは Q や localStorage は変わらない
- network error・offline・non-OK・JSON error は静かに無視する
- `APP_VER` はコード・UI・学習ロジックの更新通知用。教材だけの更新では原則 `APP_VER` を変えず、`contentVersion` だけを更新する

## 9. Service Worker と教材更新の関係

- `sw.js` は index.html と `data/*.json` を network-first で取得する。オンラインなら常に最新 JSON が届き、取得できたものをキャッシュに保存する。オフライン時だけキャッシュを返す
- JSON を更新するだけなら `sw.js` の `CACHE` 名を変えなくてよい
- `data/` にファイルを増やしたら `sw.js` の `ASSETS` に追加し、`CACHE` の版数を上げる（precache に失敗すると新しい Service Worker は install されず、旧版が使われ続ける。ASSETS の path 間違いに注意）
- cache 名は `wordup-` で始まり（`CACHE_PREFIX`）、古い cache の掃除はこの prefix を持つものだけを対象にする。同じ origin にある他の BioSprout アプリの cache には触れない
- 404 や 500 などの error response は cache に保存しない。network が error を返したときは、正常な cache があればそちらを返す

## 10. してはいけない変更

- 公開済みのグループ ID、英語のつづり、talk の `id` の変更・再利用
- `a` を 1 始まりにする、`ch` を4件以外にする
- 単語ペアを3要素にする、グループやレベルに未定義の property を足す
- 別の共通 schema へ変換する
- `data/index.json` の `total` を実件数と食い違わせる（ホームの語数表示が狂う）
