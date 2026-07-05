# からだのカルテ（karada-carte.jp）

健康・からだの悩みを「数値で診る」総合診断メディア（母屋）と、その配下に診断サブを
サブディレクトリで量産していくプラットフォーム。第1弾サブは薄毛診断 `/usuge/`。

```
/
├─ index.html          # 母屋：健康・からだの総合診断メディア（ハブ）
├─ usuge/index.html    # サブ①：薄毛・頭皮環境チェック（Esrosso LTV接続）
├─ config.json         # 全ページ共通の設定（母屋コンテンツ一覧・診断ロジック・Esrosso・免責・GAS/Turnstile）
├─ gas/receiver.gs     # フォーム受信（GAS・Turnstile検証・シート蓄積・通知）
├─ sitemap.xml / robots.txt
├─ design/             # デザイントークン・自己批評（実装前の設計記録）
├─ CNAME               # karada-carte.jp（絶対に触らない）
└─ README.md
```

- ホスティング：GitHub Pages（`main` ブランチ、独自ドメイン `karada-carte.jp`）。
- サーバー言語なし（静的）。診断計算は**全てブラウザ内**で完結し、外部API・生成AIを呼ばない＝**継続課金ゼロ**。
- 設定は `config.json` に外出し。非エンジニアが安全に書き換え可能（`__…__` はプレースホルダ）。
- 母屋は `config.json?t=…` を、`/usuge/` は `../config.json?t=…` を読む（相対パス・サブディレクトリ移設可）。

---

## 1. 拡張のしかた（診断サブを増やす）
母屋トップの「いま使える診断／これから広げる診断」は `config.json` の `home` セクションで管理する。
新しい診断を公開したら、`home.tiles` の該当項目を `home.feature` 相当のカードに昇格するか、
新しいサブディレクトリ（例 `/suimin/`）を作って母屋のカード導線を1件追加するだけでよい。
`sitemap.xml` にも1行追加する。母屋・診断フローの構造は共通なので、`/usuge/` を雛形に複製できる。

---

## 2. 薄毛診断のロジック（根拠と簡略化）
**目的**：薄毛の原因は一つではないため、原因の「傾向」を4タイプに分類し、頭皮/毛髪環境スコア
（目安）とあわせて **カルテ結果票** として発行する。医療診断ではなく、傾向の目安。

### 採点（`config.json > usuge.diagnosis`）
- 各設問の選択肢は4軸に重み `w`（0–3）を持つ：`internal`（内的要因＝ホルモン・加齢）／
  `scalp`（頭皮環境＝皮脂・洗浄）／`nutrition`（栄養・ダメージ＝ハリコシ）／`lifestyle`（生活習慣）。
- 軸ごと `raw =` 選んだ選択肢の重み合計、`max =` 各設問の最大重みの合計 → `riskPct = raw / max × 100`。
- **環境スコア（目安）** ＝ `100 −（全軸合算の riskPct）` を `scoreClampMin〜Max` で丸める。高いほど健やかな傾向。
- 軸別の `riskPct` は結果票の「原因の傾向（軸別）」バーで可視化する。

### タイプ判定
- **性別で候補軸を調整**：
  - 男性 … 栄養軸の一部（0.5）をインナーケア＝内的側へ寄せ、候補軸を `internal / scalp` に限定
    （女性向け Verde に誘導しない）。
  - 女性 … 候補軸に `nutrition`（＝ Verde/Ladies）を含める。
- `highThreshold`（既定50）を超える候補軸の数で分岐：
  - 2軸以上 → **④ 複合要因型**
  - 1軸のみ、かつ生活軸も高い（`lifestyleAmplifies`）→ **④ 複合要因型**
  - 1軸のみ → その軸のタイプ（①内的／②頭皮／③栄養）
  - 該当なし → 最も高い候補軸のタイプ（軽度でも方向づけ）

閾値・係数・重みはすべて `config.json` で調整可能。変更時は下記「薬機法」を厳守すること。

### カルテ結果票（シグネチャー）
- カルテ番号 `KRD-YYYYMMDD-XXXX`（XXXX は回答内容のハッシュ）と発行日を付与。
- **localStorage は使わない**。結果は URL パラメータ（`?type=&score=&kn=`）に保存し、
  「印刷／PDFで保存」ボタンで結果票を残せる（`window.print` ＋ 印刷用CSS）。
- 再診断時、LINE経由などで `?prev=NN`（前回スコア）付きで開くと、スコア差分を表示する。

---

## 3. Esrosso 製品接続表（原因タイプ → 製品）
診断は「商品LP」ではなく「本人の数値を発行し、継続改善の必然性を作る装置」。比較・並列はせず、
**本人の原因タイプに論理接続**する。区分は薬機法に従う（サプリ＝健康補助食品／シャンプー等＝化粧品・医薬部外品）。

| 原因タイプ | 主因 | 接続する Esrosso 製品 | 区分 |
|---|---|---|---|
| ① 内的要因型（ホルモン・加齢） | 体の内側 | **BOSTON**（ノコギリヤシ由来オイル等のインナーケア） | 健康補助食品（食品） |
| ② 頭皮環境型（皮脂・洗浄） | 頭皮 | **Men's アミノ酸系シャンプー ＋ スカルプエッセンス** | 化粧品／医薬部外品 |
| ③ ハリ・コシ／栄養型（女性に多い） | 髪質 | **Verde（Ladies）シリーズ** | 化粧品（一部 健康補助食品） |
| ④ 複合要因型 | 内＋外 | **サプリ ＋ シャンプー/エッセンス併用**（客単価最大） | 併用 |

- 各製品のURL・らくトク便URL・LINE URL は `config.json`（`usuge.productUrls`／`esrosso.rakutoku.url`
  ／`esrosso.line.url`）にプレースホルダで外出し。**BOSSが実URLに差し替える**（`__…__` のまま公開しない）。
- LTV設計：毛周期（数ヶ月〜年単位）の観点から「一定期間続けて経過をみる」ことを事実の範囲で説明し、
  **らくトク便（定期）** と **数ヶ月後の経過チェック診断（再診断・LINE）** を導線化する。全額返金保証でリスクゼロ訴求。

---

## 4. 薬機法（最優先・厳守）
薄毛・育毛は薬機法の最重要注意領域。**効果効能を断定しない**。
- 「生える」「治る」「発毛」等の**断定は禁止**（コード・UI・config・READMEすべてで）。
- 診断は「傾向の目安」「医療診断ではない」を明示（ヒーロー・免責・結果票・FAQに記載済み）。
- 継続の必然性は「毛周期の観点から継続的なケアが一般に推奨される」等、**事実の範囲**に留める。
- サプリ＝健康補助食品（食品）、シャンプー/エッセンス＝化粧品/医薬部外品の**区分に応じた表現**のみ。
- 体験談・口コミを効果保証に使わない。気になる症状は医療機関へ、と案内する。
- `config.json` を編集して文言を足す場合も、上記に反する表現を**絶対に追記しない**。

---

## 5. GAS バックエンド（フォーム受信）デプロイ手順
1. [script.google.com](https://script.google.com/) で新規プロジェクト作成、`gas/receiver.gs` の内容を貼り付け。
2. **スクリプト プロパティ**（プロジェクトの設定 → スクリプト プロパティ）に4件を登録：
   | キー | 値 |
   |---|---|
   | `NOTIFY_TO` | 通知先メール（グループ共有アドレス。個人アドレス不可） |
   | `SHEET_ID` | 蓄積先スプレッドシートのID（URLの `/d/` と `/edit` の間） |
   | `TURNSTILE_SECRET` | Cloudflare Turnstile のシークレットキー |
   | `ALLOWED_HOSTS` | `karada-carte.jp,www.karada-carte.jp` |
3. **デプロイ → 新しいデプロイ → 種類「ウェブアプリ」**／実行するユーザー=自分／アクセスできるユーザー=**全員**。
4. 発行された `/exec` URL を `config.json > gas.endpoint` に設定。
5. Cloudflare Turnstile のサイトキーを `config.json > gas.turnstileSitekey` に設定。
   - HTML には宛先メール・シークレットを一切書かない（すべてスクリプトプロパティ側）。
   - 受信データ：ご希望・原因タイプ・環境スコア・軸別値・性別・年齢・カルテ番号・連絡先・相談内容。
   - honeypot・ALLOWED_HOSTS・Turnstile の3段でスパム/踏み台を防止（`no-cors` fire-and-forget 送信）。

---

## 6. 公開手順（go-live）とセキュリティ
制作時から SEO/GEO/AEO・セキュリティを標準装備（CSP(meta)＋frame-busting、画像は全てインラインSVG＝
外部ホットリンクなし、フォーム honeypot＋Turnstile、秘密情報は非同梱）。本番サーバーでは可能なら
`.htaccess` 等で `X-Frame-Options`／`HSTS`／`X-Content-Type-Options: nosniff`／`Referrer-Policy`／
`Permissions-Policy` を付与する（GitHub Pages では付与不可のため meta と frame-busting で補完）。

**公開の順序（不可逆な公開は BOSS 確認のうえ）：**
1. 事前に社内で表示・動作確認（noindex のまま）。GAS・Turnstile・各URLを実値に設定。
2. **公開ボタン＝各 HTML の `<meta name="robots">` を `index, follow` に切替**（`index.html` と `usuge/index.html` の両方）。
3. Google Search Console で `karada-carte.jp` の所有権を確認し、`sitemap.xml` を送信。
4. （任意）メール到達性のため SPF/DKIM/DMARC を設定。
5. 接続情報（FTP/Pages/トークン）は AI に渡さない。GitHub は 2FA 必須。

### Search Console への sitemap 提出
1. [search.google.com/search-console](https://search.google.com/search-console) でプロパティ `https://karada-carte.jp/` を追加。
2. 所有権確認（DNS TXT もしくは HTML ファイル）。
3. 「サイトマップ」に `sitemap.xml` を送信。

---

## 6.5 GEO/AEO・セキュリティ強化（2026-07-05）
**GEO/AEO：**
- 構造化データを拡充：`BreadcrumbList`（/usuge/）、`WebPage`＋`SpeakableSpecification`（直接回答・FAQを音声/AEO対象に）、
  `WebApplication` に `publisher`（アートナップ株式会社）・`isPartOf`（WebSite）・`inLanguage`・`isAccessibleForFree` を追加。
  母屋にも可視FAQ＋`FAQPage` を追加（`config.json > home.faq`）。既存の WebSite/Organization/FAQPage/HowTo と一致。
- **llms.txt** を新設（`/llms.txt`）＝AI検索/生成エンジン向けの引用しやすい要約（薬機法の注意文つき）。
- **robots.txt** のAIクローラー許可を拡張（GPTBot/OAI-SearchBot/ChatGPT-User/ClaudeBot/Claude-SearchBot/anthropic-ai/
  PerplexityBot/Perplexity-User/Google-Extended/Applebot(-Extended)/bingbot/Meta-ExternalAgent/FacebookBot/CCBot/
  cohere-ai/YouBot/DuckAssistBot/Amazonbot/Diffbot）。
- メタ拡充：`og:locale=ja_JP`・`theme-color`・`author`。

**セキュリティ：**
- 実行JSを外部ファイル化（`js/home.js`・`usuge/app.js`）し、**CSPから `script-src 'unsafe-inline'` を排除**
  （母屋=`script-src 'self'`／usuge=`script-src 'self' https://challenges.cloudflare.com`）。XSS耐性を大幅強化。
  ※JSON-LD（`type=application/ld+json`）は非実行データのためCSPの制限を受けず、そのままインラインで機能します。
  ※`style-src` は要素の inline style を使うため `'unsafe-inline'` を維持（スクリプト実行経路ではない残存項目）。
- CSPに `upgrade-insecure-requests` と `form-action`（母屋=`'none'`／usuge=`'self' https://script.google.com`）を追加。
- フォームに **最短送信時間チェック**（`elapsedMs`）を追加。GASが2.5秒未満の送信をbotとして破棄（honeypot＋Turnstile＋ホスト制限と多層防御）。
- 将来のサーバ移設用に **`_headers`（Cloudflare Pages/Netlify）** と **`.htaccess`（Apache）** を同梱：
  HSTS・X-Frame-Options・X-Content-Type-Options(nosniff)・Referrer-Policy・Permissions-Policy・COOP/CORP・HTTPS強制・
  機微ファイル(.gs/.md)配信禁止。**GitHub Pages では両ファイルは無効**（HTTPヘッダ不可）で、稼働中は meta CSP＋frame-busting が同等の防御を担う。

## 7. 免責
本サイトは健康・からだに関する情報提供および傾向の目安を示すものであり、医療診断・治療・
特定の効果効能を保証するものではありません。エスロッソ製品は健康補助食品または化粧品・
医薬部外品の区分に応じた範囲でご案内しています。気になる症状がある場合は医療機関にご相談ください。
