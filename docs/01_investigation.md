# アカヌケ 現状調査・セキュリティ評価(2026-10-25 時点)

> このファイルは「調査結果」です。秘密情報(キー・パスワード等)は一切書いていません。
> 凡例: ✅=確認済みの事実 / ❓=未確認(外部画面でしか確認できない等)

## 1. 現状調査

### 1-1. 技術構成(✅)
| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16.3.2(App Router, Turbopack)/ React 19.2.8 / TypeScript 5 / Tailwind CSS v4 / recharts 3 |
| 実行環境(開発PC) | Node v24.19.0 / npm 11.17.0 / Windows 11 |
| ホスティング | Vercel(GitHub の main に push で自動デプロイ) |
| DB・認証・画像保存 | Supabase(無料枠)。Postgres + RLS + Auth + Storage |
| AI | Anthropic API(`@anthropic-ai/sdk`、モデル `claude-sonnet-5`)。サーバー側(/api)からのみ呼ぶ |
| PHP | **使っていない(リポジトリ内に PHP ファイル・設定なし)** |
| テスト | **なし**(テストファイル 0 件、CI なし) |

### 1-2. 画面・機能(✅)
ホーム(今日のAI ToDo・目標進捗)/ 食事(写真→AIで料理名・カロリー推定)/ 体重グラフ / 筋トレ記録 / 美容相談(顔タップ→AIプラン)/ AIチャット / プロフィール(機能ON/OFF・ログアウト)/ ログイン・新規登録。

### 1-3. 認証・データ・API の実装(✅)
- **ログインは実装済み・本番反映済み**(コミット e22c2af)。Supabase Auth のメール+パスワード。
- `src/proxy.ts`(Next.js 16 では middleware の後継)が全ページと `/api/*` を門番する。未ログインは、ページは `/login` へ、API は 401。
- 全テーブル(profile / meal_records / weight_records / workout_records / beauty_consultations / daily_todos)に `user_id` と RLS「自分の行だけ」。匿名キーでは読み書き不可(検証済み)。
- 食事写真は非公開バケット `meal-photos` の `ユーザーID/` フォルダ。RLS で自分のフォルダだけ。
- API キーは `ANTHROPIC_API_KEY`(`NEXT_PUBLIC_` なし=ブラウザに出ない)。Supabase の公開キーはブラウザに出る設計(RLS で守る前提)。
- Vercel の環境変数名: `ANTHROPIC_API_KEY` / `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / **`NOTION_API_KEY` / `NOTION_SNS_DATABASE_ID`(機能削除済みなのに残っている)**。値は確認・表示していない。

### 1-4. ビルド・コード品質
- ✅ ESLint: 3 エラー + 1 警告(`react-hooks/set-state-in-effect`。beauty/meals/workout の `useEffect` 内で load 関数を呼ぶ書き方)。動作には影響しないが、`npm run lint` は失敗する。
- ✅ `dangerouslySetInnerHTML` の使用 0 件(XSS の典型経路なし)。
- ✅ `next/image` 未使用(食事ページで素の `<img>` を2か所)。`next/og`・`use cache`・Server Actions(`'use server'`)・`generateStaticParams`・`revalidate` すべて未使用。
- ✅ `next.config.ts` は空設定(`images.remotePatterns` なし、セキュリティヘッダーなし)。
- ✅ ルートに catch-all(`[...slug]`)なし。

## 2. セキュリティ評価

### 2-1. PHP の脆弱性
**このアプリは PHP を使っていないため、PHP の脆弱性は直接関係しない**(確認済み)。PHP 関連の更新は行わない。

### 2-2. 発見事項(優先度順)

| # | 内容 | 状態 | 優先度 |
|---|---|---|---|
| A | **AI の利用回数制限がない**。ログインさえすれば誰でも /api/* を無制限に叩け、Anthropic の料金が膨らむ(新規登録は誰でも可能・メール確認オフの可能性) | ✅ 確認 | **最高** |
| B | **/api/* の入力に長さ上限がない**。`chat` の質問・`todos` の `context`・`beauty` の `concern`・画像の `mediaType` が無検証でそのまま AI に渡る(料金の水増し・プロンプト注入の足がかり) | ✅ 確認 | **高** |
| C | API ルート自体はログインを確認していない(門番は proxy のみ)。proxy の設定ミス 1 つで全 API が無認証になる(多層防御の欠如) | ✅ 確認 | 中 |
| D | **AI の安全ルールが不足**。`beauty` のみ配慮文あり。整形/医療の推奨禁止・診断禁止・容姿の採点/ランク付け禁止・特定の実在人物との類似断定/約束禁止・極端な食事制限の禁止は、どのプロンプトにも明文化されていない | ✅ 確認 | **高**(公開前に必須) |
| E | **Next.js 16.3.2 に既知の脆弱性**(npm audit)。詳細は 2-3 | ✅ 確認 | 高(ただし多くは本アプリに該当しない) |
| F | `sharp` 0.35.3(推奨 0.35.5 以上)。Next の更新で同時に解決する | ✅ 確認 | 高(Eと一体) |
| G | 間接依存の脆弱性(brace-expansion / js-yaml / source-map-js / zod)。ビルド・開発時ツール経由が中心で、本番の実行経路への影響は小さい | ✅ 確認(影響度は ❓) | 低〜中 |
| H | チャットに貼られた Anthropic キー(旧)・Notion キーの**ローテーション(再発行)が未確認** | ❓ | 高 |
| I | 使っていない `NOTION_*` が Vercel に残っている | ✅ 確認 | 低(掃除) |
| J | セキュリティヘッダー(CSP / X-Frame-Options / Referrer-Policy 等)なし | ✅ 確認 | 中 |
| K | 公開時の Supabase Auth 設定(メール確認 ON・独自 SMTP・パスワード強度)は画面でしか見えない | ❓ | 高(公開前) |
| L | プライバシーポリシー・利用規約・アカウント削除機能がない。顔の部位・体重・食事写真は個人情報 | ✅ 確認 | 公開前に必須 |
| M | ログイン分離の「2アカウント相互に見えない」実機テストをユーザーが完了したか未確認(匿名キーでの検証は済) | ❓ | 中 |
| N | テスト・CI がない(変更の安全確認が手動) | ✅ 確認 | 中 |

### 2-3. Next.js の脆弱性が本アプリに当たるか(公式 GitHub Advisory で確認)
現在 16.3.2。修正版は **16.4.1 以上で9件すべて解消**(npm audit の提案は 16.4.3)。

| Advisory | 概要 | 発動条件 | 本アプリへの該当 |
|---|---|---|---|
| GHSA-p293-qw3h-jr36 | Windows サーバーでの RCE | サーバーが Windows のファイルシステム | **該当しない**(Vercel は Linux。※自分の PC の `next dev` は外部公開しない限り無関係) |
| GHSA-2xp9-vwfh-vxw4 | 画像最適化 API の AVIF RCE | 画像最適化が AVIF を処理 | ❓ 公式は Vercel 可否を明記せず。本アプリは `next/image` 未使用だが `/_next/image` は既定で存在しうる → **未確認なので更新で解消する** |
| GHSA-2464-fhr4-w9xw | 画像最適化 API の SVG RCE(glibc Linux) | 画像最適化+sharp<0.35.5 | ❓ 同上。`public/` に SVG がある。**更新で解消する** |
| GHSA-vcvr-r3jv-pc5j | next/og の RCE | next/og に攻撃者の値を渡す | **該当しない**(未使用) |
| GHSA-673q-mjm6-r5xr | `use cache` の RCE | Cache Components + `use cache` | **該当しない**(未使用。ただし公式は「関数がなくても更新を」) |
| GHSA-p3m5-59mp-jv5r | Server Actions の DoS | Server Action がある | **該当しない**(未使用) |
| GHSA-cjq9-62q9-8jv4 | 画像最適化の SSRF | `images.remotePatterns` 設定あり | **該当しない**(未設定) |
| GHSA-4jqv-mc3x-m676 | SSG/ISR のキャッシュ汚染 | セルフホスト+Pages Router | **該当しない**(Vercel は対象外と公式が明記) |
| GHSA-mcj8-r9mp-w47p | SSG/ISR のキャッシュ汚染 | ルート直下の catch-all + SSG/ISR | **該当しない**(catch-all なし) |

結論: 「今すぐ被害が出る」可能性は低いが、画像最適化系 2 件は未確認で、`16.4.x` への更新は **非メジャー(マイナー/パッチ)更新で破壊的変更リスクが小さい**ため、**確認後に実施する価値が高い**。無差別な全パッケージ更新はしない(`next` と `sharp` のみ対象)。

### 2-4. 更新のリスクと進め方(変更計画)
- 影響: `next` を 16.3.2 → 16.4.x に上げると、`eslint-config-next` も同じバージョンに合わせる必要がある。proxy.ts・Supabase の cookie 処理が動き続けるか確認が必要。
- 安全策: ブランチを切る → 更新 → `npm run build` → ローカルでログイン〜各画面〜AI を確認 → Vercel のプレビューで確認 → main へ。問題があれば git revert(タグ `backup-before-auth` もある)。
- 破壊的操作(DB 削除・認証設定変更・環境変数上書き)は含まない。

## 3. 確認できていないこと(次の担当者へ)
- Supabase ダッシュボードの Auth 設定(メール確認、パスワード強度、SMTP)、Storage バケットが実際に非公開か(SQL 上は非公開に設定済み)。
- Anthropic / Notion キーの再発行済みか(コンソールでのみ確認可能)。
- 2 アカウントでの相互非表示テストの実施結果。
- `/_next/image` が本番で AVIF/SVG を実際に処理するか(Next 更新で解消するため追試は不要と判断)。

## 4. 参考(公式)
- https://github.com/advisories/GHSA-p293-qw3h-jr36
- https://github.com/advisories/GHSA-2xp9-vwfh-vxw4
- https://github.com/advisories/GHSA-2464-fhr4-w9xw
- https://github.com/advisories/GHSA-vcvr-r3jv-pc5j
- https://github.com/advisories/GHSA-673q-mjm6-r5xr
- https://github.com/advisories/GHSA-p3m5-59mp-jv5r
- https://github.com/advisories/GHSA-cjq9-62q9-8jv4
- https://github.com/advisories/GHSA-4jqv-mc3x-m676
- https://github.com/advisories/GHSA-mcj8-r9mp-w47p
